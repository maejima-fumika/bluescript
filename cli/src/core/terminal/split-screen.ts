import readline from 'readline';

const SAVE_CURSOR = '\x1b7';
const RESTORE_CURSOR = '\x1b8';
const NO_WRAP = '\x1b[?7l';
const WRAP = '\x1b[?7h';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const RESET_SCROLL_REGION = '\x1b[r';

/**
 * Splits the screen into fixed rows at the top and at the bottom, and a
 * scrolling area between them, using the terminal's scroll region.
 * Each fixed line takes exactly one row: the part beyond the width is cut off.
 * Lines written with `writeLine` scroll inside the scrolling area only.
 */
export class SplitScreen {
    private top: string[] = [];
    private bottom: string[] = [];
    private rows = 0;
    private opened = false;
    /** Gives the terminal back in a usable state even if the process exits while open. */
    private readonly resetOnExit = () => this.stream.write(RESET_SCROLL_REGION + WRAP + SHOW_CURSOR);

    constructor(private readonly stream: NodeJS.WriteStream) {}

    get isOpen(): boolean {
        return this.opened;
    }

    /** The number of rows between the fixed rows. */
    get scrollRows(): number {
        return this.rows - this.top.length - this.bottom.length;
    }

    /**
     * Clears the screen, draws the fixed rows and moves the cursor to the top of
     * the scrolling area. Call it again to lay out the screen for a new size.
     * Returns false, and leaves the screen as it was, when stdout is not a TTY or
     * there would be fewer than `minScrollRows` rows to scroll. A screen that was
     * open is then closed.
     */
    open(top: string[], bottom: string[], minScrollRows = 1): boolean {
        const rows = this.stream.rows;
        if (!this.stream.isTTY || !rows || rows - top.length - bottom.length < minScrollRows) {
            if (this.opened) {
                this.resetOnExit();
                this.release();
            }
            return false;
        }
        if (!this.opened) {
            process.on('exit', this.resetOnExit);
        }
        this.opened = true;
        this.rows = rows;
        this.top = top;
        this.bottom = bottom;
        this.stream.write(RESET_SCROLL_REGION + HIDE_CURSOR);
        readline.cursorTo(this.stream, 0, 0);
        readline.clearScreenDown(this.stream);
        this.drawRows(0, top);
        this.drawRows(rows - bottom.length, bottom);
        // Setting the scroll region moves the cursor, so move it back afterwards.
        this.stream.write(`\x1b[${top.length + 1};${rows - bottom.length}r`);
        readline.cursorTo(this.stream, 0, top.length);
        return true;
    }

    /** Redraws the fixed rows at the top. `top` must have as many lines as before. */
    setTop(top: string[]): void {
        if (!this.opened) {
            return;
        }
        this.top = top;
        this.drawRows(0, top);
    }

    /** Redraws the fixed rows at the bottom. `bottom` must have as many lines as before. */
    setBottom(bottom: string[]): void {
        if (!this.opened) {
            return;
        }
        this.bottom = bottom;
        this.drawRows(this.rows - bottom.length, bottom);
    }

    /** Clears the scrolling area and moves the cursor to its top. */
    clearScroll(): void {
        if (!this.opened) {
            return;
        }
        for (let row = this.top.length; row < this.rows - this.bottom.length; row++) {
            readline.cursorTo(this.stream, 0, row);
            readline.clearLine(this.stream, 0);
        }
        readline.cursorTo(this.stream, 0, this.top.length);
    }

    /** Writes `line` into the scrolling area. */
    writeLine(line: string): void {
        this.stream.write(line + '\n');
    }

    /**
     * Gives the whole screen back. Everything drawn stays on the screen, except
     * that the bottom rows are replaced with `bottom` (fewer lines leave blank rows).
     * The cursor moves below the last line of `bottom`.
     */
    close(bottom: string[] = this.bottom): void {
        if (!this.opened) {
            return;
        }
        const firstRow = this.rows - this.bottom.length;
        const padded = this.bottom.map((_, i) => bottom[i] ?? '');
        this.drawRows(firstRow, padded);
        this.stream.write(RESET_SCROLL_REGION + SHOW_CURSOR);
        const nextRow = firstRow + Math.min(bottom.length, this.bottom.length);
        if (nextRow < this.rows) {
            readline.cursorTo(this.stream, 0, nextRow);
        } else {
            readline.cursorTo(this.stream, 0, this.rows - 1);
            this.stream.write('\n');
        }
        this.release();
    }

    private release() {
        this.opened = false;
        this.top = [];
        this.bottom = [];
        process.off('exit', this.resetOnExit);
    }

    /** Draws `lines` from `firstRow`, one row each, and puts the cursor back where it was. */
    private drawRows(firstRow: number, lines: string[]) {
        this.stream.write(SAVE_CURSOR + NO_WRAP);
        lines.forEach((line, i) => {
            readline.cursorTo(this.stream, 0, firstRow + i);
            readline.clearLine(this.stream, 0);
            this.stream.write(line);
        });
        this.stream.write(WRAP + RESTORE_CURSOR);
    }
}
