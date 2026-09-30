import { Command, Option } from "commander";
import http from 'http';
import sirv from 'sirv';
import path from 'path';
import { logger, runStep } from "../../core/logger";
import { BoxedOutput, LineOutput, WebSocketOutput } from "../../core/program-output";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../../config/project-config";
import { cwd, simpleExec } from "../../core/command-exec";
import { CommandHandlerWithUpdateCheck } from "../command";
import { ProjectSession } from "../../platforms/project-session";
import { CompileError, CompileOutput } from "@bscript/lang";
import { WebSocketConnection } from "../../services/websocket";
import { AsyncLock } from "../../core/async";
import { terminal } from "../../core/terminal";

class RunHandler extends CommandHandlerWithUpdateCheck {
    protected session: ProjectSession;
    private readonly boxedOutput = new BoxedOutput();

    constructor(protected projectConfigHandler: ProjectConfigHandler, deviceName?: string) {
        super();

        this.session = new ProjectSession(
            this.projectConfigHandler, this.globalConfigHandler, this.boxedOutput, deviceName,
        );
        this.session.on('disconnected', () => {
            this.boxedOutput.close();
            logger.error("Disconnected.");
            process.exit(1);
        });
    }

    async run(): Promise<boolean> {
        await runStep('Connecting...', () => this.session.connect());
        await runStep('Initializing...', () => this.session.prepare());
        const compileOutput = await runStep('Compiling...', () => this.session.build());
        await this.loadStep(compileOutput!);
        return this.executeProgram(compileOutput!);
    }

    async loadStep(compileOutput: CompileOutput) {
        await runStep('Loading...', (step) =>
            this.session.load(compileOutput, (percent) => step.progress(`${percent}%`)));
    }

    async close() {
        await runStep('Disconnecting...', () => this.session.close());
    }

    /** @returns true when the program is interrupted by Ctrl-D. */
    private async executeProgram(output: CompileOutput): Promise<boolean> {
        logger.info("Start executing program. Type 'Ctrl-D' to exit.");
        this.boxedOutput.open();
        let requestStop!: () => void;
        const stopRequested = new Promise<true>((resolve) => {
            requestStop = () => resolve(true);
        });
        const disposeControlKeys = terminal.listenKeys({
            onCtrlC: () => process.exit(0),
            onCtrlD: () => requestStop(),
        });
        try {
            return await Promise.race([
                this.session.execute(output).then(() => false),
                stopRequested,
            ]);
        } finally {
            disposeControlKeys();
            this.boxedOutput.close();
        }
    }
}

class RunWithReplHandler extends RunHandler {
    private readonly replOutput = new LineOutput();

    async run() {
        const interrupted = await super.run();
        if (interrupted) {
            return interrupted;
        }

        this.session.setOutput(this.replOutput);
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        await terminal.readLines((line) => this.processReplLine(line));
        return false;
    }

    private async processReplLine(line: string) {
        try {
            const output = await this.session.compileFragment(line);
            await this.session.load(output);
            await this.session.execute(output);
        } catch (error) {
            if (!(error instanceof CompileError)) {
                throw error;
            }
            logger.error("** compile error: " + error.toString());
        } finally {
            this.replOutput.flush();
        }
    }
}

class RunWithNotebookHandler extends RunHandler {
    private ws: WebSocketConnection | null = null;
    private server: http.Server | null = null;
    private readonly executeLock = new AsyncLock();

    async run() {
        const interrupted = await super.run();
        if (interrupted) {
            return interrupted;
        }
        this.startWebsocket();
        await this.startUiServer();
        logger.info("Type 'Ctrl-D' to exit.");

        return new Promise<boolean>((resolve) => {
            const disposeControlKeys = terminal.listenKeys({
                onCtrlC: () => process.exit(0),
                onCtrlD: () => {
                    disposeControlKeys();
                    resolve(true);
                },
            });
        });
    }

    async close(): Promise<void> {
        this.server?.close();
        this.ws?.close();
        await super.close();
    }

    private startUiServer() {
        const notebookPackageJsonPath = require.resolve('@bscript/notebook/package.json');
        const clientPath = path.join(path.dirname(notebookPackageJsonPath), 'build');

        const serveStaticFiles = sirv(clientPath, {
            dev: true,
            single: true,
        });

        this.server = http.createServer(serveStaticFiles);
        const PORT = process.env.PORT || 3000;
        return new Promise<void>((resolve) => {
            this.server?.listen(PORT, () => {
                logger.info(`Notebook server is running at: http://localhost:${PORT}`);
                this.openBrowser(PORT);
                resolve();
            });
        });

    }

    private async openBrowser(port: number | string) {
        const url = `http://localhost:${port}`;
        if (process.platform === 'win32') {
            await simpleExec('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' });
        } else if (process.platform === 'darwin') {
            await simpleExec('open', [url], { detached: true, stdio: 'ignore' });
        } else {
            await simpleExec('xdg-open', [url], { detached: true, stdio: 'ignore' });
        }
    }

    private startWebsocket() {
        const port = 8080;
        this.ws = new WebSocketConnection(port);
        const service = this.ws.getService('repl');
        this.ws.open();
        this.session.setOutput(new WebSocketOutput(service));
        service.on('execute', (code: string) => {
            void this.executeLock.runExclusive(async () => {
                try {
                    let {output, time} = await this.compile(code);
                    service.finishCompilation(time);
                    time = await this.load(output);
                    service.finishLoading(time);
                    time = await this.execute(output);
                    service.finishExecution(time);
                } catch (error) {
                    if (error instanceof CompileError) {
                        service.finishCompilation(-1, error.toString());
                    } else {
                        logger.showError(error);
                        throw error;
                    }
                }
            });
        });
        logger.info(`WebSocket server is running at ws://localhost:${port}`);
    }

    private async compile(code: string) {
        const start = performance.now();
        const output = await this.session.compileFragment(code);
        return {output, time: performance.now() - start};
    }

    private async load(output: CompileOutput) {
        const start = performance.now();
        await this.session.load(output);
        return performance.now() - start;
    }

    private async execute(output: CompileOutput) {
        return await this.session.execute(output);
    }
}

export async function handleRunCommand(
    options: {withRepl: boolean, withNotebook: boolean, deviceName?: string}
) {
    let handler: RunHandler | undefined;
    try {
        const projectConfigHandler = ProjectConfigHandler.load(cwd());
        if (options.withRepl) {
            handler = new RunWithReplHandler(projectConfigHandler, options.deviceName);
        } else if (options.withNotebook) {
            handler = new RunWithNotebookHandler(projectConfigHandler, options.deviceName);
        } else {
            handler = new RunHandler(projectConfigHandler, options.deviceName);
        }

        await handler.run();
        await handler.close();
        process.exit(0);

    } catch (error) {
        if (handler) {
            try {
                await handler.close();
            } catch {
                // Ignore cleanup errors after a run failure.
            }
        }
        logger.error(`Failed to run BlueScript program.`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerRunCommand(program: Command) {
    program
        .command('run')
        .description('run your project')
        .option('-d, --device-name <device-name>', `device name to connect to, the default is '${DEFAULT_DEVICE_NAME}'`)
        .addOption(
            new Option('--with-repl', 'start REPL after main execution finished')
            .conflicts('withNotebook')
        )
        .addOption(
            new Option('--with-notebook', 'start notebook after main execution finished')
            .conflicts('withRepl')
        )
        .action(handleRunCommand);
}
