import * as readline from 'readline';
import chalk from 'chalk';
import { AsyncLock } from '../async';
import { StatusLine } from './status-line';
import { SplitScreen } from './split-screen';

export type ControlKeyHandlers = {
    onCtrlC?: () => void;
    onCtrlD?: () => void;
    /** Called with the typed character for any other key without Ctrl or Meta, such as `'1'` or `'\t'`. */
    onKey?: (char: string) => void;
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
    /** Writes to stdout directly, so it is not affected by `intercept`. */
    readonly screen: SplitScreen;
    private inputOwner?: 'keys' | 'prompt';
    /** The prompt waiting for the user to type a line, if any. */
    private waitingPrompt?: readline.Interface;
    /** Text kept below everything written, drawn on the status line. */
    private footer?: string;
    /** Receives everything written instead of stdout, if set. */
    private interceptor?: (text: string) => void;

    constructor(
        private readonly stdin: NodeJS.ReadStream,
        private readonly stdout: NodeJS.WriteStream,
    ) {
        this.status = new StatusLine(stdout);
        this.screen = new SplitScreen(stdout);
    }

    get isInteractive(): boolean {
        return Boolean(this.stdin.isTTY);
    }

    get columns(): number | undefined {
        return this.stdout.columns;
    }

    get rows(): number | undefined {
        return this.stdout.rows;
    }

    /** Whether `setFooter` shows anything. A footer is redrawn in place, so it needs a TTY. */
    get supportsFooter(): boolean {
        return Boolean(this.stdout.isTTY);
    }

    /**
     * Shows `text` below everything written, until `clearFooter` is called.
     * Calling it again replaces the footer. Does nothing when stdout is not a TTY.
     * The footer uses the status line, so `status` must not be used while it is shown.
     */
    setFooter(text: string): void {
        if (!this.supportsFooter) {
            return;
        }
        this.footer = text;
        this.status.update(text);
    }

    /** Removes the footer. With `keep`, its last text is left in place as ordinary output. */
    clearFooter(options: { keep?: boolean } = {}): void {
        if (this.footer === undefined) {
            return;
        }
        this.footer = undefined;
        if (options.keep) {
            this.status.done();
        } else {
            this.status.clear();
        }
    }

    /**
     * Passes everything written with `write` and `writeLine` to `handler` instead
     * of stdout, until the returned function is called. Used while something else,
     * such as `screen`, controls where text appears.
     */
    intercept(handler: (text: string) => void): () => void {
        if (this.interceptor) {
            throw new Error('The terminal output is already intercepted.');
        }
        this.interceptor = handler;
        return () => {
            if (this.interceptor === handler) {
                this.interceptor = undefined;
            }
        };
    }

    /** Calls `listener` when the terminal is resized. Returns a function that stops it. */
    onResize(listener: () => void): () => void {
        this.stdout.on('resize', listener);
        return () => {
            this.stdout.off('resize', listener);
        };
    }

    /**
     * Writes `text` as is, or passes it to the `intercept` handler. A status line is kept,
     * a footer is redrawn below the text, and a waiting prompt is redrawn below the text.
     */
    write(text: string): void {
        if (this.interceptor) {
            this.interceptor(text);
            return;
        }
        if (this.footer !== undefined) {
            this.status.clear();
            this.stdout.write(text);
            this.status.update(this.footer);
            return;
        }
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
     * Puts stdin into raw mode and calls the handlers on Ctrl-C / Ctrl-D and other keys.
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

        const onKeypress = (str: string | undefined, key: readline.Key | undefined) => {
            if (key?.ctrl && key.name === 'c') {
                handlers.onCtrlC?.();
            } else if (key?.ctrl && key.name === 'd') {
                handlers.onCtrlD?.();
            } else if (str && !key?.ctrl && !key?.meta) {
                handlers.onKey?.(str);
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
