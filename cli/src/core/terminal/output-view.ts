import chalk from 'chalk';
import { terminal } from './terminal';
import { countRows } from './status-line';

export type RunState = 'running' | 'finished' | 'failed' | 'disconnected' | 'stopped';

export type OutputViewMember = {
    name: string;
    /** Shown in the footer, such as a colored `[name]`. */
    tag: string;
};

type HistoryLine = { seq: number; line: string };

const MIN_SCROLL_ROWS = 5;
const BOTTOM_ROWS = 3;
const FALLBACK_COLUMNS = 80;
const MAX_KEYED_MEMBERS = 9;

const STATE_LABELS: Record<RunState, string> = {
    running: chalk.cyan('● running'),
    finished: chalk.green('✔ finished'),
    failed: chalk.red('✖ failed'),
    disconnected: chalk.red('✖ disconnected'),
    stopped: chalk.yellow('■ stopped'),
};

/**
 * Shows the output of several programs running at the same time.
 * The screen is split into a header that stays in place, a log area between
 * two lines, and a footer listing the state of each program. Keys switch the
 * log area between every program and one of them: the log area is then
 * redrawn with the recent lines of the chosen view.
 * The log area shows program output only: anything else written to the
 * terminal meanwhile, such as an error from the logger, is held back and
 * printed below the screen on `stop`.
 * Without a TTY, or when the screen is too small, every line is printed as is.
 */
export class OutputView {
    private readonly history = new Map<string, HistoryLine[]>();
    /** Text written to the terminal by others while the screen is split. */
    private heldBack: string[] = [];
    private readonly states = new Map<string, RunState>();
    /** The member whose output is shown, or undefined to show every member. */
    private focus?: string;
    private seq = 0;
    private header: string[] = [];
    /** The part of the header that fits on the screen. */
    private shownHeader: string[] = [];
    private opened = false;
    private disposers: (() => void)[] = [];

    constructor(
        private readonly members: readonly OutputViewMember[],
        private readonly historySize: number = 1000,
    ) {
        for (const m of members) {
            this.history.set(m.name, []);
            this.states.set(m.name, 'running');
        }
    }

    /** Whether the screen is split, so the footer shows the state of each member. */
    get isOpen(): boolean {
        return this.opened;
    }

    /** Returns the function that prints a line of `name`'s output. */
    printerFor(name: string): (line: string) => void {
        return (line) => {
            this.remember(this.history.get(name)!, line);
            if (this.focus === undefined || this.focus === name) {
                this.print(line);
            }
        };
    }

    setState(name: string, state: RunState): void {
        this.states.set(name, state);
        if (this.opened) {
            terminal.screen.setBottom(this.bottomRows());
        }
    }

    /**
     * Clears the screen and lays it out, with `header` at the top.
     * Does nothing without a TTY or when the screen is too small.
     */
    start(header: string[]): void {
        if (!terminal.supportsFooter) {
            return;
        }
        this.header = header.flatMap((text) => text.split('\n'));
        if (!this.layOut()) {
            return;
        }
        this.disposers = [
            terminal.intercept((text) => this.heldBack.push(text)),
            terminal.onResize(() => {
                if (!this.layOut()) {
                    this.stop();
                }
            }),
        ];
    }

    /**
     * Marks the members still running as stopped, switches the log area to
     * every member and gives the screen back, leaving it in place. Then prints the text held back, and from now on the output
     * of every member is printed as is.
     */
    stop(): void {
        for (const dispose of this.disposers) {
            dispose();
        }
        this.disposers = [];
        for (const [name, state] of this.states) {
            if (state === 'running') {
                this.states.set(name, 'stopped');
            }
        }
        if (this.opened) {
            this.setFocus(undefined);
            this.opened = false;
            // Without the key help, which no longer applies.
            terminal.screen.close(this.bottomRows().slice(0, 2));
        }
        this.focus = undefined;
        for (const text of this.heldBack) {
            terminal.write(text);
        }
        this.heldBack = [];
    }

    /** `1`-`9` focus on a member, Tab focuses on the next member and `a` shows every member. */
    handleKey(char: string): void {
        if (!this.opened) {
            return;
        }
        if (char === 'a') {
            this.setFocus(undefined);
        } else if (char === '\t') {
            const index = this.members.findIndex((m) => m.name === this.focus);
            this.setFocus(this.members[(index + 1) % this.members.length].name);
        } else if (/^[1-9]$/.test(char)) {
            const member = this.members[Number(char) - 1];
            if (member) {
                this.setFocus(member.name);
            }
        }
    }

    private setFocus(name: string | undefined) {
        if (this.focus === name) {
            return;
        }
        this.focus = name;
        terminal.screen.clearScroll();
        terminal.screen.setTop(this.topRows());
        terminal.screen.setBottom(this.bottomRows());
        this.fillLogArea();
    }

    /** Lays out the screen for its current size. Returns false when it is too small. */
    private layOut(): boolean {
        const rows = terminal.rows ?? 0;
        // The header gives way first, so that the log area keeps MIN_SCROLL_ROWS rows.
        const headerRows = Math.max(0, rows - BOTTOM_ROWS - 1 - MIN_SCROLL_ROWS);
        this.shownHeader = headerRows === 0 ? [] : this.header.slice(-headerRows);
        this.opened = terminal.screen.open(this.topRows(), this.bottomRows(), MIN_SCROLL_ROWS);
        if (this.opened) {
            this.fillLogArea();
        }
        return this.opened;
    }

    /** Writes the recent lines of the current view that fit in the log area. */
    private fillLogArea() {
        const columns = terminal.columns || FALLBACK_COLUMNS;
        // The last row is left for the cursor, below the last line.
        let freeRows = terminal.screen.scrollRows - 1;
        const fitting: string[] = [];
        const lines = this.recentLines();
        for (let i = lines.length - 1; i >= 0; i--) {
            freeRows -= countRows(lines[i], columns);
            if (freeRows < 0) {
                break;
            }
            fitting.unshift(lines[i]);
        }
        for (const line of fitting) {
            terminal.screen.writeLine(line);
        }
    }

    /** The lines of the current view, in the order they arrived. */
    private recentLines(): string[] {
        const sources = this.focus === undefined ? [...this.history.values()] : [this.history.get(this.focus)!];
        return sources.flat().sort((a, b) => a.seq - b.seq).map((l) => l.line);
    }

    private remember(lines: HistoryLine[], line: string) {
        lines.push({ seq: this.seq++, line });
        if (lines.length > this.historySize) {
            lines.shift();
        }
    }

    private print(line: string) {
        if (this.opened) {
            terminal.screen.writeLine(line);
        } else {
            terminal.writeLine(line);
        }
    }

    private topRows(): string[] {
        const label = ` view: ${this.focus ?? 'all'} `;
        const width = terminal.columns || FALLBACK_COLUMNS;
        const border = chalk.dim(`──${label}${'─'.repeat(Math.max(0, width - label.length - 2))}`);
        return [...this.shownHeader, border];
    }

    private bottomRows(): string[] {
        const items = this.members.map((m, i) => {
            const key = i < MAX_KEYED_MEMBERS ? `${i + 1}` : ' ';
            const item = `${key} ${m.tag} ${STATE_LABELS[this.states.get(m.name)!]}`;
            return m.name === this.focus ? chalk.inverse(item) : item;
        });
        const keyedCount = Math.min(this.members.length, MAX_KEYED_MEMBERS);
        const keyRange = keyedCount === 1 ? '1' : `1-${keyedCount}`;
        return [
            chalk.dim('─'.repeat(terminal.columns || FALLBACK_COLUMNS)),
            ` ${items.join('   ')}`,
            chalk.dim(` ${keyRange}: focus  Tab: next  a: all  Ctrl-D: exit`),
        ];
    }
}
