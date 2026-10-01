import chalk from 'chalk';
import { terminal } from '../terminal';
import { LineBuffer } from './line-buffer';
import { ProgramOutput } from './program-output';

/** Builds a `[name]` tag for each name, padded to the longest name. */
export function createTags(names: readonly string[]): Map<string, string> {
    const width = Math.max(0, ...names.map((name) => name.length));
    return new Map(names.map((name) => [name, `[${name.padEnd(width)}]`]));
}

/**
 * Prints program output line by line, each line prefixed with `tag` if given.
 * Text is buffered until a newline arrives, separately for normal output and errors.
 * Each finished line goes to `printLine`, which writes it to the terminal by default.
 */
export class LineOutput implements ProgramOutput {
    private readonly out = new LineBuffer();
    private readonly err = new LineBuffer();

    constructor(
        private readonly tag?: string,
        private readonly printLine: (line: string) => void = (line) => terminal.writeLine(line),
    ) {}

    write(message: string): void {
        for (const line of this.out.push(message)) {
            this.print(line);
        }
    }

    writeError(message: string): void {
        for (const line of this.err.push(message)) {
            this.printError(line);
        }
    }

    /** Prints any text still waiting for a newline. */
    flush(): void {
        const restOut = this.out.flush();
        if (restOut !== undefined) {
            this.print(restOut);
        }
        const restErr = this.err.flush();
        if (restErr !== undefined) {
            this.printError(restErr);
        }
    }

    private print(line: string) {
        this.printLine(this.tag ? `${this.tag} ${line}` : line);
    }

    private printError(line: string) {
        this.print(chalk.red.bold(line));
    }
}
