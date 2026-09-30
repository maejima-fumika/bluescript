import chalk from 'chalk';
import { ProgramOutput } from './program-output';

const TAG_COLORS = [chalk.cyan, chalk.magenta, chalk.yellow, chalk.green, chalk.blue];

/** Builds a colored `[name]` tag for each name, padded to the longest name. */
export function createTags(names: readonly string[]): Map<string, string> {
    const width = Math.max(0, ...names.map((name) => name.length));
    return new Map(names.map((name, i) =>
        [name, TAG_COLORS[i % TAG_COLORS.length](`[${name.padEnd(width)}]`)]));
}

export interface PrefixedOutput extends ProgramOutput {
    /** Prints any text still waiting for a newline. */
    flush(): void;
}

/**
 * Prints program output line by line, each line prefixed with `tag`.
 * Device logs may arrive split in the middle of a line, so text is buffered
 * until a newline arrives.
 */
export function createPrefixedOutput(tag: string): PrefixedOutput {
    const pending = { out: '', err: '' };

    const print = (line: string, isError: boolean) => {
        console.log(tag, isError ? chalk.red.bold(line) : line);
    };

    const push = (stream: 'out' | 'err', message: string) => {
        const lines = (pending[stream] + message).split(/\r?\n/);
        pending[stream] = lines.pop()!;
        for (const line of lines) {
            print(line, stream === 'err');
        }
    };

    return {
        write(message: string) {
            push('out', message);
        },
        writeError(message: string) {
            push('err', message);
        },
        flush() {
            if (pending.out) {
                print(pending.out, false);
            }
            if (pending.err) {
                print(pending.err, true);
            }
            pending.out = '';
            pending.err = '';
        },
    };
}
