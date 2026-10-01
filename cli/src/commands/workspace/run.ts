import { Command } from "commander";
import * as os from 'os';
import { CompileOutput } from "@bscript/lang";
import { logger, runStep, formatStepResult } from "../../core/logger";
import { LineOutput, createTags } from "../../core/program-output";
import { cwd } from "../../core/command-exec";
import { settleAll } from "../../core/async";
import { terminal } from "../../core/terminal";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";
import { WorkspaceConfigHandler, WorkspaceProject } from "../../config/workspace-config";
import { ProjectSession, SessionDisconnectedError } from "../../platforms/project-session";
import { MessageRouter } from "../../platforms/messaging";
import { CommandHandlerWithUpdateCheck } from "../command";

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
    private readonly failed = new Set<string>();

    constructor(
        private workspaceConfigHandler: WorkspaceConfigHandler,
        private projectNames: string[],
    ) {
        super();
    }

    /** @returns true when every project finished without failing or disconnecting. */
    async run(): Promise<boolean> {
        this.setup();
        // ESP32 boards connect one at a time (see BleConnection); host projects connect in parallel.
        await this.runPhase('Connecting...', 'connect', (m) => m.session.connect());
        await this.runPhase('Initializing...', 'initialize', (m) => m.session.prepare());
        await this.runPhase('Compiling...', 'compile', async (m) => {
            m.compileOutput = await m.session.build();
        }, os.cpus().length);
        await this.loadAll();
        // Every project is loaded at this point, so they can all start together.
        await this.executeAll();

        if (this.failed.size > 0) {
            logger.error(`Some projects did not finish successfully: ${[...this.failed].join(', ')}`);
        }
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
        const router = new MessageRouter(projects.map((p) => p.name));
        this.router = router;

        this.members = projects.map((p) => {
            const tag = tags.get(p.name)!;
            const output = new LineOutput(tag);
            const session = new ProjectSession(p.project, this.globalConfigHandler, output, p.deviceName);
            session.setMessagePort(router.portFor(p.name));
            session.on('disconnected', () => {
                router.close(p.name);
                this.failed.add(p.name);
                output.flush();
                logger.error(tag, 'Disconnected.');
            });
            return { name: p.name, tag, session, output };
        });

        const summary = projects.map(describeProject).join(', ');
        logger.info(`Workspace ${this.workspaceConfigHandler.name}: ${summary}`);
    }

    /**
     * Runs `action` for every project. When any of them fails, waits for the
     * rest to settle and then throws, so nothing is still in flight on close.
     */
    private async runPhase(
        label: string,
        verb: string,
        action: (member: Member) => Promise<void>,
        concurrency?: number,
    ) {
        const results = await settleAll(this.members, async (m) => {
            try {
                await action(m);
                logger.info(m.tag, formatStepResult(label, 'ok'));
            } catch (error) {
                logger.info(m.tag, formatStepResult(label, 'failed'));
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
        for (const m of this.members) {
            try {
                await runStep(`${m.tag} Loading...`, (step) =>
                    m.session.load(m.compileOutput!, (percent) => step.progress(`${percent}%`)));
            } catch (error) {
                throw new Error(`Failed to load ${m.name}.`, { cause: error });
            }
        }
    }

    /** Ends when every program has finished or disconnected, or when Ctrl-D is typed. */
    private async executeAll() {
        logger.info("Start executing programs. Type 'Ctrl-D' to exit.");
        let requestStop!: () => void;
        const stopRequested = new Promise<void>((resolve) => {
            requestStop = resolve;
        });
        const disposeControlKeys = terminal.listenKeys({
            onCtrlC: () => process.exit(0),
            onCtrlD: () => requestStop(),
        });

        try {
            // Send every execute command in the same tick so the programs start as close together as possible.
            const running = this.members.map((m) => this.executeOne(m));
            await Promise.race([Promise.all(running), stopRequested]);
        } finally {
            disposeControlKeys();
            for (const m of this.members) {
                m.output.flush();
            }
        }
    }

    /** Never throws, so one failing project does not stop the others. */
    private async executeOne(m: Member) {
        try {
            await m.session.execute(m.compileOutput!);
            this.router?.close(m.name);
            m.output.flush();
            logger.success(m.tag, 'Finished.');
        } catch (error) {
            this.router?.close(m.name);
            this.failed.add(m.name);
            // A disconnection is already reported by the 'disconnected' listener.
            if (!(error instanceof SessionDisconnectedError)) {
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
