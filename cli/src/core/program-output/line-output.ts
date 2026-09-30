import chalk from 'chalk';
import { terminal } from '../terminal';
import { LineBuffer } from './line-buffer';
import { ProgramOutput } from './program-output';

const TAG_COLORS = [chalk.cyan, chalk.magenta, chalk.yellow, chalk.green, chalk.blue];

/** Builds a colored `[name]` tag for each name, padded to the longest name. */
export function createTags(names: readonly string[]): Map<string, string> {
    const width = Math.max(0, ...names.map((name) => name.length));
    return new Map(names.map((name, i) =>
        [name, TAG_COLORS[i % TAG_COLORS.length](`[${name.padEnd(width)}]`)]));
}

/**
 * Prints program output line by line, each line prefixed with `tag` if given.
 * Text is buffered until a newline arrives, separately for normal output and errors.
 */
export class LineOutput implements ProgramOutput {
    private readonly out = new LineBuffer();
    private readonly err = new LineBuffer();

    constructor(private readonly tag?: string) {}

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
        if (this.tag) {
            terminal.writeLine(this.tag, line);
        } else {
            terminal.writeLine(line);
        }
    }

    private printError(line: string) {
        this.print(chalk.red.bold(line));
    }
}
