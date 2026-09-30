import { Command, Option } from "commander";
import chalk from "chalk";
import * as readline from 'readline';
import http from 'http';
import sirv from 'sirv';
import path from 'path';
import { logger, ProgramOutput, createBoxedOutput, createConsoleOutput, createWebSocketOutput, 
    runStep, LoadStepLogger } from "../../core/logger";
import { DEFAULT_DEVICE_NAME, ProjectConfigHandler } from "../../config/project-config";
import { cwd, simpleExec } from "../../core/command-exec";
import { CommandHandlerWithUpdateCheck } from "../command";
import { ProjectSession } from "../../platforms/project-session";
import { CompileError, CompileOutput } from "@bscript/lang";
import { WebSocketConnection } from "../../services/websocket";
import { AsyncLock } from "../../core/async";

class RunHandler extends CommandHandlerWithUpdateCheck {
    protected session: ProjectSession;
    protected programOutput: ProgramOutput;

    private globalKeypressHandler?: (str: string, key: any) => void;
    private ctrlDKeypressHandler?: (str: string, key: any) => void;

    constructor(protected projectConfigHandler: ProjectConfigHandler, deviceName?: string) {
        super();

        this.programOutput = createBoxedOutput();
        this.session = new ProjectSession(
            this.projectConfigHandler, this.globalConfigHandler, this.programOutput, deviceName,
        );
        this.session.on('disconnected', () => {
            this.programOutput.onRunEnd?.();
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
        const loadLogger = new LoadStepLogger();
        loadLogger.start();
        try {
            await this.session.load(compileOutput, (percent) => loadLogger.update(percent));
            loadLogger.endWithSuccess();
        } catch (error) {
            loadLogger.endWithFailure();
            throw error;
        }
    }

    async close() {
        await runStep('Disconnecting...', () => this.session.close());
    }

    protected setupStdin() {
        if (!process.stdin.isTTY) {
            return;
        }
        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);
        this.globalKeypressHandler = (str, key) => {
            if (key && key.ctrl && key.name === 'c') {
                process.exit(0);
            }
            if (str) process.stdout.write(str);
        };
        process.stdin.on('keypress', this.globalKeypressHandler);
    }

    private resetStdin() {
        if (!process.stdin.isTTY) {
            return;
        }
        if (this.globalKeypressHandler) {
            process.stdin.off('keypress', this.globalKeypressHandler);
            this.globalKeypressHandler = undefined;
        }
        if (this.ctrlDKeypressHandler) {
            process.stdin.off('keypress', this.ctrlDKeypressHandler);
            this.ctrlDKeypressHandler = undefined;
        }
        process.stdin.setRawMode(false);
    }

    private async executeProgram(output: CompileOutput) {
        logger.info("Start executing program. Type 'Ctrl-D' to exit.");
        this.programOutput.onRunStart?.();
        try {
            if (!process.stdin.isTTY) {
                await this.session.execute(output);
                return false;
            }

            this.setupStdin();
            const interrupted = await new Promise<boolean>((resolve, reject) => {
                this.ctrlDKeypressHandler = (str, key) => {
                    if (key && key.ctrl && key.name === 'd') {
                        resolve(true);
                        if (str) process.stdout.write(str);
                    }
                };
                process.stdin.on('keypress', this.ctrlDKeypressHandler);

                this.session.execute(output)
                    .then(() => resolve(false))
                    .catch(reject);
            });
            return interrupted;
        } finally {
            this.programOutput.onRunEnd?.();
            this.resetStdin();
        }
    }
}

class RunWithReplHandler extends RunHandler {
    private rl?: readline.Interface;
    private readonly taskLock = new AsyncLock();

    async run() {
        const interrupted = await super.run();
        if (interrupted) {
            return interrupted;
        }

        this.session.setOutput(createConsoleOutput());
        await this.runRepl();
        return false;
    }

    async close() {
        this.rl?.close();
        await super.close();
    }

    private runRepl() {
        logger.info("Start REPL. Type 'Ctrl-D' to exit.");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue.bold('> '),
        });
        this.rl = rl;
        rl.prompt();
        return new Promise<void>((resolve, reject) => {
            rl.on('line', (line) => {
                rl.pause();
                void this.taskLock.runExclusive(async () => {
                    try {
                        const output = await this.session.compileFragment(line);
                        await this.session.load(output);
                        await this.session.execute(output);
                    } catch (error) {
                        if (error instanceof CompileError) {
                            logger.error("** compile error: " + error.toString());
                        } else {
                            reject(error);
                            return;
                        }
                    } finally {
                        rl.resume();
                        rl.prompt();
                    }
                });
            });
            rl.on('close', () => {
                resolve();
            });
        });
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

        this.setupStdin();
        return new Promise<boolean>((resolve) => {
            process.stdin.on('keypress', (str, key) => {
                if (key && key.ctrl && key.name === 'd') {
                    resolve(true);
                }
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
        this.session.setOutput(createWebSocketOutput(service));
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
