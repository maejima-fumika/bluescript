import chalk from 'chalk';
import { terminal } from '../terminal';
import { logger } from './cli-logger';
import { formatStepResult } from './step';

export type ProgressPhase = {
    /** Shown in the table, such as `connect`. Also identifies the phase. */
    name: string;
    /** Shown when there is no table, such as `Connecting...`. */
    label: string;
};

export type ProgressRow = {
    name: string;
    /** Shown at the start of the row, such as a colored `[name]`. */
    tag: string;
};

type PhaseStatus = 'pending' | 'running' | 'ok' | 'failed';
type PhaseState = { status: PhaseStatus; progress?: string };

/**
 * Shows the progress of several rows going through the same phases, one line
 * per row, below everything else written. The table is redrawn in place until
 * `finish` is called, and then left as ordinary output.
 * Without a TTY, each finished phase is printed as its own line instead.
 */
export class ProgressTable {
    private readonly states = new Map<string, Map<string, PhaseState>>();

    constructor(
        private readonly rows: readonly ProgressRow[],
        private readonly phases: readonly ProgressPhase[],
        private readonly interactive: boolean = terminal.supportsFooter,
    ) {
        for (const row of rows) {
            this.states.set(row.name, new Map(phases.map((p) => [p.name, { status: 'pending' }])));
        }
    }

    /** Marks `phase` of `row` as running, with `progress` such as a percentage. */
    start(row: string, phase: string, progress?: string): void {
        this.set(row, phase, { status: 'running', progress });
    }

    succeed(row: string, phase: string): void {
        this.set(row, phase, { status: 'ok' });
    }

    fail(row: string, phase: string): void {
        this.set(row, phase, { status: 'failed' });
    }

    /** Leaves the table in place as ordinary output. */
    finish(): void {
        if (this.interactive) {
            terminal.clearFooter({ keep: true });
        }
    }

    private set(rowName: string, phaseName: string, state: PhaseState) {
        this.states.get(rowName)!.set(phaseName, state);
        if (this.interactive) {
            terminal.setFooter(this.render());
        } else if (state.status === 'ok' || state.status === 'failed') {
            const row = this.rows.find((r) => r.name === rowName)!;
            const phase = this.phases.find((p) => p.name === phaseName)!;
            logger.info(row.tag, formatStepResult(phase.label, state.status));
        }
    }

    /** Returns the table as it is drawn, one line per row. */
    render(): string {
        return this.rows.map((row) => {
            const states = this.states.get(row.name)!;
            const phases = this.phases.map((p) => formatPhase(p.name, states.get(p.name)!));
            return `${row.tag} ${phases.join('  ')}`;
        }).join('\n');
    }
}

function formatPhase(name: string, state: PhaseState): string {
    switch (state.status) {
        case 'pending':
            return chalk.dim(`· ${name}`);
        case 'running':
            return chalk.cyan(`… ${name}${state.progress ? ` ${state.progress}` : ''}`);
        case 'ok':
            return `${chalk.green('✔')} ${name}`;
        case 'failed':
            return chalk.red(`✖ ${name}`);
    }
}
