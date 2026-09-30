import chalk from 'chalk';
import { terminal } from '../terminal';

/** Where the output of a program running on a board goes. */
export interface ProgramOutput {
    write(message: string): void;
    writeError(message: string): void;
}

/** Prints program output as is, between the lines drawn by `open` and `close`. Output outside them is dropped. */
export class BoxedOutput implements ProgramOutput {
    private isOpen = false;
    private readonly boxWidth = (terminal.columns || 60) & ~1;

    open(): void {
        this.isOpen = true;
        const lineLength = (this.boxWidth - 8) / 2;
        terminal.write(`\n${'='.repeat(lineLength)} OUTPUT ${'='.repeat(lineLength)}\n`);
    }

    close(): void {
        if (!this.isOpen) return;
        terminal.write(`${'='.repeat(this.boxWidth)}\n\n`);
        this.isOpen = false;
    }

    write(message: string): void {
        if (!this.isOpen) return;
        terminal.write(message);
    }

    writeError(message: string): void {
        if (!this.isOpen) return;
        terminal.write(chalk.red.bold(message));
    }
}

/** Sends program output to the notebook. */
export class WebSocketOutput implements ProgramOutput {
    constructor(private readonly service: {
        log(message: string): void | Promise<void>;
        error(message: string): void | Promise<void>;
    }) {}

    write(message: string): void {
        void this.service.log(message);
    }

    writeError(message: string): void {
        void this.service.error(message);
    }
}
