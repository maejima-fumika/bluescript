/**
 * Splits text into lines. Program output may arrive split in the middle of
 * a line, so the text after the last newline is kept until the next push.
 */
export class LineBuffer {
    private pending = '';

    /** Returns the lines completed by `text`. */
    push(text: string): string[] {
        const lines = (this.pending + text).split(/\r?\n/);
        this.pending = lines.pop()!;
        return lines;
    }

    /** Returns the text still waiting for a newline, if any, and forgets it. */
    flush(): string | undefined {
        const rest = this.pending;
        this.pending = '';
        return rest || undefined;
    }
}
