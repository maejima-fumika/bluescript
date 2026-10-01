import readline from 'readline';

const ANSI_PATTERN = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

/** Returns how many terminal rows `text` takes when lines wrap at `columns`. */
export function countRows(text: string, columns: number): number {
    let rows = 0;
    for (const line of text.split('\n')) {
        rows += Math.max(1, Math.ceil(line.replace(ANSI_PATTERN, '').length / columns));
    }
    return rows;
}

/** A line at the bottom of the terminal that can be rewritten in place, such as a progress message. */
export class StatusLine {
    private stream: NodeJS.WriteStream;
    private lastOutput = '';
    private isUpdating = false;

    constructor(stream: NodeJS.WriteStream) {
        this.stream = stream;
    }

    public update(...text: string[]): void {
        this.clear();
        const newOutput = text.join(' ');
        this.stream.write(newOutput);
        this.lastOutput = newOutput;
        this.isUpdating = true;
    }

    public persistent(...text: string[]): void {
        this.update(...text);
        this.done();
    }

    public done(): void {
        if (!this.isUpdating) {
            return;
        }
        this.stream.write('\n');
        this.isUpdating = false;
        this.lastOutput = '';
    }

    public clear(): void {
        if (!this.isUpdating) {
            return;
        }
        const lines = countRows(this.lastOutput, this.stream.columns || 80);
        for (let i = 0; i < lines; i++) {
            if (i > 0) {
                readline.moveCursor(this.stream, 0, -1);
            }
            readline.cursorTo(this.stream, 0);
            readline.clearLine(this.stream, 1);
        }
        this.isUpdating = false;
        this.lastOutput = '';
    }
}
