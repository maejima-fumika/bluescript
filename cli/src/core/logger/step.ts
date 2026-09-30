import chalk from 'chalk';
import { INFO_PREFIX } from './cli-logger';
import { terminal } from '../terminal';

export class StepSkip {
    constructor(public readonly reason: string) {}
}

export function skip(reason: string): StepSkip {
    return new StepSkip(reason);
}

export type Step = {
    /** Shows `text` after the step message, such as a percentage. */
    progress(text: string): void;
};

export type StepResult = 'ok' | 'failed' | StepSkip;

/** Returns `message` followed by a colored result, for steps that are not shown with `runStep`. */
export function formatStepResult(message: string, result: StepResult): string {
    if (result instanceof StepSkip) {
        return `${message} ${chalk.yellow(`Skipped - ${result.reason}`)}`;
    }
    return `${message} ${result === 'ok' ? chalk.green('OK') : chalk.red('Failed')}`;
}

/** Runs `action` while showing `message` on the status line, then shows the result. */
export async function runStep<T>(
    message: string,
    action: (step: Step) => Promise<T | StepSkip>,
): Promise<T | undefined> {
    terminal.status.update(INFO_PREFIX, message);
    const step: Step = {
        progress: (text) => terminal.status.update(INFO_PREFIX, message, text),
    };
    try {
        const result = await action(step);
        if (result instanceof StepSkip) {
            terminal.status.persistent(INFO_PREFIX, formatStepResult(message, result));
            return undefined;
        }
        terminal.status.persistent(INFO_PREFIX, formatStepResult(message, 'ok'));
        return result;
    } catch (error) {
        terminal.status.persistent(INFO_PREFIX, formatStepResult(message, 'failed'));
        throw error;
    }
}
