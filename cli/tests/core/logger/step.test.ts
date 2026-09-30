import { formatStepResult, runStep, skip } from '../../../src/core/logger/step';
import { terminal } from '../../../src/core/terminal';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, '');

describe('formatStepResult', () => {
    it('appends the result to the message', () => {
        expect(stripAnsi(formatStepResult('Loading...', 'ok'))).toBe('Loading... OK');
        expect(stripAnsi(formatStepResult('Loading...', 'failed'))).toBe('Loading... Failed');
        expect(stripAnsi(formatStepResult('Loading...', skip('not needed')))).toBe('Loading... Skipped - not needed');
    });
});

describe('runStep', () => {
    let updateSpy: jest.SpyInstance;
    let persistentSpy: jest.SpyInstance;
    const lastPersistent = () => stripAnsi(persistentSpy.mock.calls.at(-1)!.join(' '));

    beforeEach(() => {
        updateSpy = jest.spyOn(terminal.status, 'update').mockImplementation(() => {});
        persistentSpy = jest.spyOn(terminal.status, 'persistent').mockImplementation(() => {});
    });

    afterEach(() => {
        updateSpy.mockRestore();
        persistentSpy.mockRestore();
    });

    it('returns the result and shows OK', async () => {
        await expect(runStep('Compiling...', async () => 42)).resolves.toBe(42);
        expect(lastPersistent()).toBe('INFO: Compiling... OK');
    });

    it('shows progress after the message', async () => {
        await runStep('Loading...', async (step) => {
            step.progress('50%');
        });
        expect(stripAnsi(updateSpy.mock.calls.at(-1)!.join(' '))).toBe('INFO: Loading... 50%');
    });

    it('returns undefined when the step is skipped', async () => {
        await expect(runStep('Updating...', async () => skip('not needed'))).resolves.toBeUndefined();
        expect(lastPersistent()).toBe('INFO: Updating... Skipped - not needed');
    });

    it('shows Failed and rethrows', async () => {
        await expect(runStep('Connecting...', async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');
        expect(lastPersistent()).toBe('INFO: Connecting... Failed');
    });
});
