import { ProgressTable } from '../../../src/core/logger/progress-table';
import { terminal } from '../../../src/core/terminal';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, '');

const ROWS = [{ name: 'a', tag: '[a]' }, { name: 'bb', tag: '[bb]' }];
const PHASES = [{ name: 'connect', label: 'Connecting...' }, { name: 'load', label: 'Loading...' }];

describe('ProgressTable', () => {
    let setFooterSpy: jest.SpyInstance;
    let clearFooterSpy: jest.SpyInstance;
    let writeLineSpy: jest.SpyInstance;
    const lastFooter = () => stripAnsi(setFooterSpy.mock.calls.at(-1)![0]);
    const printedLines = () => writeLineSpy.mock.calls.map((args) => stripAnsi(args.join(' ')));

    beforeEach(() => {
        setFooterSpy = jest.spyOn(terminal, 'setFooter').mockImplementation(() => {});
        clearFooterSpy = jest.spyOn(terminal, 'clearFooter').mockImplementation(() => {});
        writeLineSpy = jest.spyOn(terminal, 'writeLine').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('with a TTY', () => {
        it('shows one line per row with the state of each phase', () => {
            const table = new ProgressTable(ROWS, PHASES, true);

            table.start('a', 'connect');
            expect(lastFooter()).toBe('[a] … connect  · load\n[bb] · connect  · load');

            table.succeed('a', 'connect');
            table.start('a', 'load', '42%');
            table.fail('bb', 'connect');
            expect(lastFooter()).toBe('[a] ✔ connect  … load 42%\n[bb] ✖ connect  · load');
            expect(writeLineSpy).not.toHaveBeenCalled();
        });

        it('leaves the table in place on finish', () => {
            const table = new ProgressTable(ROWS, PHASES, true);

            table.start('a', 'connect');
            table.finish();

            expect(clearFooterSpy).toHaveBeenCalledWith({ keep: true });
        });
    });

    describe('without a TTY', () => {
        it('prints a line for each finished phase', () => {
            const table = new ProgressTable(ROWS, PHASES, false);

            table.start('a', 'connect');
            table.succeed('a', 'connect');
            table.start('bb', 'load', '50%');
            table.fail('bb', 'load');
            table.finish();

            expect(printedLines()).toEqual([
                'INFO: [a] Connecting... OK',
                'INFO: [bb] Loading... Failed',
            ]);
            expect(setFooterSpy).not.toHaveBeenCalled();
            expect(clearFooterSpy).not.toHaveBeenCalled();
        });
    });
});
