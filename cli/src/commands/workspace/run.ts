import { Command } from "commander";
import * as os from 'os';
import { CompileOutput } from "@bscript/lang";
import { logger, INFO_PREFIX, ProgressTable, ProgressPhase } from "../../core/logger";
import { LineOutput, createTags } from "../../core/program-output";
import { cwd } from "../../core/command-exec";
import { settleAll } from "../../core/async";
import { terminal, OutputView } from "../../core/terminal";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";
import { WorkspaceConfigHandler, WorkspaceProject } from "../../config/workspace-config";
import { ProjectSession, SessionDisconnectedError } from "../../platforms/project-session";
import { MessageRouter } from "../../platforms/messaging";
import { CommandHandlerWithUpdateCheck } from "../command";

const START_MESSAGE = "Start executing programs. Type 'Ctrl-D' to exit.";

const PHASES = {
    connect: { name: 'connect', label: 'Connecting...' },
    initialize: { name: 'init', label: 'Initializing...' },
    compile: { name: 'compile', label: 'Compiling...' },
    load: { name: 'load', label: 'Loading...' },
} satisfies Record<string, ProgressPhase>;

type Member = {
    name: string;
    tag: string;
    session: ProjectSession;
    output: LineOutput;
    compileOutput?: CompileOutput;
};

class WorkspaceRunHandler extends CommandHandlerWithUpdateCheck {
    private members: Member[] = [];
    private router?: MessageRouter;
    private progress?: ProgressTable;
    private view?: OutputView;
    private summary = '';
    private readonly failed = new Set<string>();
    private readonly finished = new Set<string>();

    constructor(
        private workspaceConfigHandler: WorkspaceConfigHandler,
        private projectNames: string[],
    ) {
        super();
    }

    /** @returns true when every project finished without failing or disconnecting. */
    async run(): Promise<boolean> {
        this.setup();
        try {
            // ESP32 boards connect one at a time (see BleConnection); host projects connect in parallel.
            await this.runPhase(PHASES.connect, 'connect', (m) => m.session.connect());
            await this.runPhase(PHASES.initialize, 'initialize', (m) => m.session.prepare());
            await this.runPhase(PHASES.compile, 'compile', async (m) => {
                m.compileOutput = await m.session.build();
            }, os.cpus().length);
            await this.loadAll();
        } finally {
            this.progress?.finish();
        }
        // Every project is loaded at this point, so they can all start together.
        await this.executeAll();
        return this.failed.size === 0;
    }

    async close() {
        const results = await Promise.allSettled(this.members.map((m) => m.session.close()));
        results.forEach((result, i) => {
            if (result.status === 'rejected') {
                logger.warn(this.members[i].tag, 'Failed to disconnect.');
                logger.showError(result.reason, 4);
            }
        });
    }

    /** Validates the whole workspace before connecting to anything. */
    private setup() {
        const projects = this.workspaceConfigHandler.resolveProjects(this.projectNames);
        const tags = createTags(projects.map((p) => p.name));
        const sessions = new Map<string, ProjectSession>();
        const router = new MessageRouter(
            projects.map((p) => p.name),
            (dst, message) => sessions.get(dst)?.canReceiveMessage(message) ?? false,
        );
        this.router = router;
        const rows = projects.map((p) => ({ name: p.name, tag: tags.get(p.name)! }));
        const view = new OutputView(rows);
        this.view = view;

        this.members = projects.map((p) => {
            const tag = tags.get(p.name)!;
            const output = new LineOutput(tag, view.printerFor(p.name));
            const session = new ProjectSession(p.project, this.globalConfigHandler, output, p.deviceName);
            sessions.set(p.name, session);
            session.setMessagePort(router.portFor(p.name));
            session.on('disconnected', () => {
                // A board that is turned off after its program has finished is not a failure.
                if (this.finished.has(p.name)) {
                    return;
                }
                router.close(p.name);
                this.failed.add(p.name);
                view.setState(p.name, 'disconnected');
                output.flush();
                // While the screen is split, the footer already shows it.
                if (!view.isOpen) {
                    logger.error(tag, 'Disconnected.');
                }
            });
            return { name: p.name, tag, session, output };
        });

        this.summary = `Workspace ${this.workspaceConfigHandler.name}: ${projects.map(describeProject).join(', ')}`;
        logger.info(this.summary);
        this.progress = new ProgressTable(rows, Object.values(PHASES));
    }

    /**
     * Runs `action` for every project. When any of them fails, waits for the
     * rest to settle and then throws, so nothing is still in flight on close.
     */
    private async runPhase(
        phase: ProgressPhase,
        verb: string,
        action: (member: Member) => Promise<void>,
        concurrency?: number,
    ) {
        const progress = this.progress!;
        const results = await settleAll(this.members, async (m) => {
            progress.start(m.name, phase.name);
            try {
                await action(m);
                progress.succeed(m.name, phase.name);
            } catch (error) {
                progress.fail(m.name, phase.name);
                logger.error(m.tag, `Failed to ${verb}.`);
                logger.showError(error, 4);
                throw error;
            }
        }, concurrency);

        const failedMembers = this.members.filter((_, i) => results[i].status === 'rejected');
        if (failedMembers.length > 0) {
            throw new Error(`Failed to ${verb} ${failedMembers.map((m) => m.name).join(', ')}.`);
        }
    }

    /** One at a time, so the boards do not compete for the Bluetooth bandwidth. */
    private async loadAll() {
        const progress = this.progress!;
        const phase = PHASES.load.name;
        for (const m of this.members) {
            progress.start(m.name, phase);
            try {
                await m.session.load(m.compileOutput!, (percent) => progress.start(m.name, phase, `${percent}%`));
                progress.succeed(m.name, phase);
            } catch (error) {
                progress.fail(m.name, phase);
                throw new Error(`Failed to load ${m.name}.`, { cause: error });
            }
        }
    }

    /**
     * Ends when Ctrl-D is typed. Meanwhile the messages so far stay at the top of
     * the screen, the footer shows each program's state, and keys choose whose
     * output is shown, also after every program has finished.
     * When keys cannot be used, it ends as soon as every program has finished or disconnected.
     */
    private async executeAll() {
        const view = this.view!;
        logger.info(START_MESSAGE);
        let requestStop!: () => void;
        const stopRequested = new Promise<void>((resolve) => {
            requestStop = resolve;
        });
        const disposeControlKeys = terminal.listenKeys({
            onCtrlC: () => {
                view.stop();
                process.exit(0);
            },
            onCtrlD: () => requestStop(),
            onKey: (char) => view.handleKey(char),
        });

        view.start([`${INFO_PREFIX} ${this.summary}`, this.progress!.render(), `${INFO_PREFIX} ${START_MESSAGE}`]);
        try {
            // Send every execute command in the same tick so the programs start as close together as possible.
            const running = this.members.map((m) => this.executeOne(m));
            if (view.isOpen && terminal.isInteractive) {
                await stopRequested;
            } else {
                await Promise.race([Promise.all(running), stopRequested]);
            }
        } finally {
            disposeControlKeys();
            for (const m of this.members) {
                m.output.flush();
            }
            view.stop();
        }
    }

    /** Never throws, so one failing project does not stop the others. */
    private async executeOne(m: Member) {
        try {
            await m.session.execute(m.compileOutput!);
            this.finished.add(m.name);
            this.router?.close(m.name);
            m.output.flush();
            this.view?.setState(m.name, 'finished');
            // While the screen is split, the footer already shows it.
            if (!this.view?.isOpen) {
                logger.success(m.tag, 'Finished.');
            }
        } catch (error) {
            this.router?.close(m.name);
            this.failed.add(m.name);
            // A disconnection is already reported by the 'disconnected' listener.
            if (!(error instanceof SessionDisconnectedError)) {
                this.view?.setState(m.name, 'failed');
                m.output.flush();
                logger.error(m.tag, 'Execution failed.');
                logger.showError(error, 4);
            }
        }
    }
}

function describeProject(p: WorkspaceProject): string {
    const boardName = p.project.getBoardName();
    if (boardName === 'esp32') {
        return `${p.name} (esp32, ${p.deviceName ?? DEFAULT_DEVICE_NAME})`;
    }
    return `${p.name} (${boardName})`;
}

export async function handleWorkspaceRunCommand(projectNames: string[]) {
    let handler: WorkspaceRunHandler | undefined;
    let succeeded = false;
    try {
        handler = new WorkspaceRunHandler(WorkspaceConfigHandler.find(cwd()), projectNames);
        succeeded = await handler.run();
    } catch (error) {
        logger.error(`Failed to run BlueScript workspace.`);
        logger.showError(error);
    }
    if (handler) {
        await handler.close();
    }
    // Exit explicitly: the BLE backend keeps the event loop alive.
    process.exit(succeeded ? 0 : 1);
}

export function registerWorkspaceRunCommand(program: Command) {
    program
        .command('run')
        .description('run the projects in the workspace at the same time')
        .argument('[project-names...]', 'names of the projects to run (default: all projects)')
        .action(handleWorkspaceRunCommand);
}
