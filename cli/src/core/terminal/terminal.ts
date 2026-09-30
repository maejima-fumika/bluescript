import * as readline from 'readline';
import chalk from 'chalk';
import { AsyncLock } from '../async';
import { StatusLine } from './status-line';

export type ControlKeyHandlers = {
    onCtrlC?: () => void;
    onCtrlD?: () => void;
};

export type ReadlineFactory = (input: NodeJS.ReadStream, output: NodeJS.WriteStream) => readline.Interface;

const createDefaultReadline: ReadlineFactory = (input, output) =>
    readline.createInterface({ input, output, prompt: chalk.blue.bold('> ') });

/**
 * The only place that reads stdin and writes stdout, so that the status line,
 * the REPL prompt and the output printed in between do not break each other.
 * stdin is used by at most one of `listenKeys` and `readLines` at a time.
 */
export class Terminal {
    readonly status: StatusLine;
    private inputOwner?: 'keys' | 'prompt';
    /** The prompt waiting for the user to type a line, if any. */
    private waitingPrompt?: readline.Interface;

    constructor(
        private readonly stdin: NodeJS.ReadStream,
        private readonly stdout: NodeJS.WriteStream,
    ) {
        this.status = new StatusLine(stdout);
    }

    get isInteractive(): boolean {
        return Boolean(this.stdin.isTTY);
    }

    get columns(): number | undefined {
        return this.stdout.columns;
    }

    /** Writes `text` as is. A status line is kept, and a waiting prompt is redrawn below the text. */
    write(text: string): void {
        this.status.done();
        if (this.waitingPrompt && this.stdout.isTTY) {
            readline.cursorTo(this.stdout, 0);
            readline.clearLine(this.stdout, 0);
            this.stdout.write(text);
            this.waitingPrompt.prompt(true);
        } else {
            this.stdout.write(text);
        }
    }

    /** Writes `parts` joined with spaces, followed by a newline. */
    writeLine(...parts: string[]): void {
        this.write(parts.join(' ') + '\n');
    }

    /**
     * Puts stdin into raw mode and calls the handlers on Ctrl-C / Ctrl-D.
     * Typed characters are not echoed. Returns a function that restores stdin.
     * Does nothing when stdin is not a TTY.
     */
    listenKeys(handlers: ControlKeyHandlers): () => void {
        if (!this.isInteractive) {
            return () => {};
        }
        this.acquireInput('keys');
        readline.emitKeypressEvents(this.stdin);
        this.stdin.setRawMode(true);

        const onKeypress = (_str: string, key: readline.Key | undefined) => {
            if (key?.ctrl && key.name === 'c') {
                handlers.onCtrlC?.();
            } else if (key?.ctrl && key.name === 'd') {
                handlers.onCtrlD?.();
            }
        };
        this.stdin.on('keypress', onKeypress);

        let disposed = false;
        return () => {
            if (disposed) {
                return;
            }
            disposed = true;
            this.stdin.off('keypress', onKeypress);
            this.stdin.setRawMode(false);
            this.inputOwner = undefined;
        };
    }

    /**
     * Shows a prompt and passes each typed line to `onLine`, one line at a time.
     * Resolves when stdin is closed (Ctrl-D) and the current line is handled.
     * Rejects when `onLine` throws.
     */
    async readLines(
        onLine: (line: string) => Promise<void>,
        createReadline: ReadlineFactory = createDefaultReadline,
    ): Promise<void> {
        this.acquireInput('prompt');
        const rl = createReadline(this.stdin, this.stdout);
        const lock = new AsyncLock();
        let closed = false;
        try {
            await new Promise<void>((resolve, reject) => {
                rl.on('line', (line) => {
                    this.waitingPrompt = undefined;
                    rl.pause();
                    void lock.runExclusive(async () => {
                        if (closed) {
                            return;
                        }
                        try {
                            await onLine(line);
                        } catch (error) {
                            reject(error);
                            return;
                        }
                        if (!closed) {
                            rl.resume();
                            this.showPrompt(rl);
                        }
                    });
                });
                rl.on('close', () => {
                    closed = true;
                    resolve(lock.runExclusive(async () => {}));
                });
                this.showPrompt(rl);
            });
        } finally {
            closed = true;
            this.waitingPrompt = undefined;
            rl.close();
            this.inputOwner = undefined;
        }
    }

    private showPrompt(rl: readline.Interface) {
        this.waitingPrompt = rl;
        rl.prompt();
    }

    private acquireInput(owner: 'keys' | 'prompt') {
        if (this.inputOwner) {
            throw new Error(`Cannot use stdin for ${owner}: it is already used for ${this.inputOwner}.`);
        }
        this.inputOwner = owner;
    }
}

export const terminal = new Terminal(process.stdin, process.stdout);
