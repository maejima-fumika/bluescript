import chalk from "chalk";
import { terminal } from "../../core/terminal";
import { GcStats } from "../../services/protocol/host-protocol";

export { GcStats } from "../../services/protocol/host-protocol";

/** The result of running a program's entry points. */
export type ExecResult = {
    /** Milliseconds. */
    exectime: number;
    /** Whether the program ended with a runtime error that it did not catch. */
    error: boolean;
    /** Absent when the board does not send it (esp32). */
    gcStats?: GcStats;
};

/** Adds up the statistics of two runs. Absent when either is absent. */
export function addGcStats(a: GcStats | undefined, b: GcStats | undefined): GcStats | undefined {
    if (!a || !b) {
        return undefined;
    }
    return {
        runs: a.runs + b.runs,
        gcMs: a.gcMs + b.gcMs,
        allocWords: a.allocWords + b.allocWords,
        allocObjects: a.allocObjects + b.allocObjects,
        heapWords: b.heapWords,
    };
}

/**
 * How a program ended:
 * - `finished`: it completed.
 * - `error`: it ended with a runtime error that it did not catch.
 * - `failed`: the CLI failed to run it.
 * - `disconnected`: the board was disconnected before it completed.
 * - `stopped`: it was still running when Ctrl-D was typed.
 */
export type RunStatus = 'finished' | 'error' | 'failed' | 'disconnected' | 'stopped';

/** `finished` or `error`, for a program that ran to the end. */
export function statusOf(result: ExecResult): RunStatus {
    return result.error ? 'error' : 'finished';
}

/**
 * The line printed by `--stats` when a project ends. It has one fixed format
 * so that a script can parse it. `NA` stands for the statistics a board does not send,
 * and for every value when the program did not run to the end (no `result`).
 */
export function formatStatsLine(projectName: string, status: RunStatus, result?: ExecResult): string {
    const stats = result?.gcStats;
    const field = (value: number | undefined, digits = 0) =>
        value === undefined ? 'NA' : value.toFixed(digits);
    return `STATS ${projectName}`
        + ` status=${status}`
        + ` exec_ms=${field(result?.exectime, 3)}`
        + ` gc_runs=${field(stats?.runs)}`
        + ` gc_ms=${field(stats?.gcMs, 3)}`
        + ` alloc_words=${field(stats?.allocWords)}`
        + ` alloc_objects=${field(stats?.allocObjects)}`
        + ` heap_words=${field(stats?.heapWords)}`;
}

const STATS_COLUMNS = ['project', 'exec ms', 'GC runs', 'GC ms', 'alloc objects', 'alloc words', 'heap words'];

/**
 * The table printed by `--stats` in a terminal, one row per project: the header first,
 * then the rows. The numbers are aligned to the right, and `–` stands for the statistics
 * a board does not send.
 */
export function formatStatsTable(rows: { projectName: string; result: ExecResult }[]): string[] {
    const integer = (value: number | undefined) =>
        value === undefined ? '–' : value.toLocaleString('en-US');
    const ms = (value: number | undefined) => value === undefined ? '–'
        : value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    const cells = rows.map(({ projectName, result }) => {
        const stats = result.gcStats;
        return [
            projectName,
            ms(result.exectime),
            integer(stats?.runs),
            ms(stats?.gcMs),
            integer(stats?.allocObjects),
            integer(stats?.allocWords),
            integer(stats?.heapWords),
        ];
    });
    const widths = STATS_COLUMNS.map((title, i) =>
        Math.max(title.length, ...cells.map((row) => row[i].length)));
    const formatRow = (row: string[]) => row
        .map((cell, i) => i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))
        .join('   ')
        .trimEnd();
    return [formatRow(STATS_COLUMNS), ...cells.map(formatRow)];
}

/** Writes the table of `formatStatsTable`, with the header in bold. */
export function writeStatsTable(rows: { projectName: string; result: ExecResult }[]) {
    const [header, ...lines] = formatStatsTable(rows);
    terminal.writeLine(chalk.bold(header));
    for (const line of lines) {
        terminal.writeLine(line);
    }
}
