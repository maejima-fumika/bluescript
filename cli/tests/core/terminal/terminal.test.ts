import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as readline from 'readline';
import { Terminal } from '../../../src/core/terminal';

function createStdout(isTTY = false) {
    const chunks: string[] = [];
    const stream = {
        isTTY,
        columns: 80,
        write: jest.fn((chunk: string) => {
            chunks.push(chunk);
            return true;
        }),
    } as unknown as NodeJS.WriteStream;
    return { stream, text: () => chunks.join('') };
}

function createStdin(isTTY: boolean) {
    const stream = new PassThrough() as unknown as NodeJS.ReadStream & { setRawMode: jest.Mock };
    stream.isTTY = isTTY;
    stream.setRawMode = jest.fn();
    return stream;
}

type FakeReadline = EventEmitter & { prompt: jest.Mock; pause: jest.Mock; resume: jest.Mock; close: jest.Mock };

function createReadline(): FakeReadline {
    const rl = new EventEmitter() as FakeReadline;
    rl.prompt = jest.fn();
    rl.pause = jest.fn();
    rl.resume = jest.fn();
    rl.close = jest.fn(() => rl.emit('close'));
    return rl;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('Terminal', () => {
    describe('writeLine', () => {
        it('joins the parts with spaces and ends the line', () => {
            const stdout = createStdout();
            const terminal = new Terminal(createStdin(false), stdout.stream);

            terminal.writeLine('a', 'b');
            terminal.writeLine();

            expect(stdout.text()).toBe('a b\n\n');
        });

        it('keeps the status line above the new line', () => {
            const stdout = createStdout();
            const terminal = new Terminal(createStdin(false), stdout.stream);

            terminal.status.update('Loading...');
            terminal.writeLine('hello');

            expect(stdout.text()).toBe('Loading...\nhello\n');
        });
    });

    describe('readLines', () => {
        it('handles lines one at a time and resolves after the current line on close', async () => {
            const terminal = new Terminal(createStdin(false), createStdout().stream);
            const rl = createReadline();
            const events: string[] = [];
            let finishFirst!: () => void;

            const done = terminal.readLines(async (line) => {
                events.push(`start ${line}`);
                if (line === 'a') {
                    await new Promise<void>((resolve) => { finishFirst = resolve; });
                }
                events.push(`end ${line}`);
            }, () => rl as unknown as readline.Interface);

            rl.emit('line', 'a');
            rl.emit('line', 'b');
            await flush();
            expect(events).toEqual(['start a']);

            rl.emit('close');
            finishFirst();
            await done;

            expect(events).toEqual(['start a', 'end a']);
            expect(rl.prompt).toHaveBeenCalledTimes(1);
        });

        it('shows the prompt again after each line', async () => {
            const terminal = new Terminal(createStdin(false), createStdout().stream);
            const rl = createReadline();

            const done = terminal.readLines(async () => {}, () => rl as unknown as readline.Interface);
            rl.emit('line', 'a');
            await flush();
            rl.emit('close');
            await done;

            expect(rl.pause).toHaveBeenCalledTimes(1);
            expect(rl.resume).toHaveBeenCalledTimes(1);
            expect(rl.prompt).toHaveBeenCalledTimes(2);
        });

        it('rejects and closes the readline when a line fails', async () => {
            const terminal = new Terminal(createStdin(false), createStdout().stream);
            const rl = createReadline();

            const done = terminal.readLines(async () => {
                throw new Error('boom');
            }, () => rl as unknown as readline.Interface);
            rl.emit('line', 'a');

            await expect(done).rejects.toThrow('boom');
            expect(rl.close).toHaveBeenCalled();
        });

        it('redraws the waiting prompt below output', async () => {
            const stdout = createStdout(true);
            const terminal = new Terminal(createStdin(false), stdout.stream);
            const rl = createReadline();

            const done = terminal.readLines(async () => {}, () => rl as unknown as readline.Interface);
            terminal.writeLine('from device');

            expect(stdout.text()).toContain('from device\n');
            expect(rl.prompt).toHaveBeenLastCalledWith(true);

            rl.emit('close');
            await done;
        });

        it('does not redraw the prompt while a line is being handled', async () => {
            const stdout = createStdout(true);
            const terminal = new Terminal(createStdin(false), stdout.stream);
            const rl = createReadline();

            const done = terminal.readLines(async () => {
                terminal.writeLine('output');
            }, () => rl as unknown as readline.Interface);
            rl.emit('line', 'a');
            await flush();
            rl.emit('close');
            await done;

            expect(rl.prompt).not.toHaveBeenCalledWith(true);
        });
    });

    describe('listenKeys', () => {
        it('does nothing when stdin is not a TTY', () => {
            const stdin = createStdin(false);
            const terminal = new Terminal(stdin, createStdout().stream);

            terminal.listenKeys({})();

            expect(stdin.setRawMode).not.toHaveBeenCalled();
        });

        it('calls the handlers on Ctrl-C and Ctrl-D and restores stdin', async () => {
            const stdin = createStdin(true);
            const terminal = new Terminal(stdin, createStdout().stream);
            const onCtrlC = jest.fn();
            const onCtrlD = jest.fn();

            const dispose = terminal.listenKeys({ onCtrlC, onCtrlD });
            expect(stdin.setRawMode).toHaveBeenLastCalledWith(true);

            stdin.write('\x03');
            stdin.write('\x04');
            await flush();
            expect(onCtrlC).toHaveBeenCalledTimes(1);
            expect(onCtrlD).toHaveBeenCalledTimes(1);

            dispose();
            expect(stdin.setRawMode).toHaveBeenLastCalledWith(false);
            stdin.write('\x04');
            await flush();
            expect(onCtrlD).toHaveBeenCalledTimes(1);
        });

        it('cannot be used while a prompt is reading lines', async () => {
            const terminal = new Terminal(createStdin(true), createStdout().stream);
            const rl = createReadline();

            const done = terminal.readLines(async () => {}, () => rl as unknown as readline.Interface);
            expect(() => terminal.listenKeys({})).toThrow('already used for prompt');

            rl.emit('close');
            await done;
            terminal.listenKeys({})();
        });
    });
});
