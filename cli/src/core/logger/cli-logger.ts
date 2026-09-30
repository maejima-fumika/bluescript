import chalk from 'chalk';
import { terminal } from '../terminal';
import { collectErrorMessages } from './error-format';


const ERROR_PREFIX = chalk.red.bold('ERROR:');
const WARN_PREFIX = chalk.yellow.bold('WARN:');
export const INFO_PREFIX = chalk.blue.bold('INFO:');
const SUCCESS_PREFIX = chalk.green.bold('SUCCESS:');

export interface CliLogger {
    error(...messages: string[]): void;
    warn(...messages: string[]): void;
    info(...messages: string[]): void;
    success(...messages: string[]): void;
    log(...messages: string[]): void;
    br(): void;
    showError(error: unknown, indent?: number): void;
}

export const logger: CliLogger = {
    error(...messages: string[]): void {
        terminal.writeLine(ERROR_PREFIX, ...messages);
    },

    warn(...messages: string[]): void {
        terminal.writeLine(WARN_PREFIX, ...messages);
    },

    info(...messages: string[]): void {
        terminal.writeLine(INFO_PREFIX, ...messages);
    },

    success(...messages: string[]): void {
        terminal.writeLine(SUCCESS_PREFIX, ...messages);
    },

    log(...messages: string[]): void {
        terminal.writeLine(...messages);
    },

    br(): void {
        terminal.writeLine();
    },

    showError(error: unknown, indent: number = 2): void {
        for (const message of collectErrorMessages(error)) {
            terminal.writeLine(' '.repeat(indent) + message);
        }
    },
};
