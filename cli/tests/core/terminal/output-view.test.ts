import { OutputView, terminal } from '../../../src/core/terminal';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, '');

const MEMBERS = [{ name: 'a', tag: '[a]' }, { name: 'b', tag: '[b]' }, { name: 'c', tag: '[c]' }];
/** The line above the log area, as wide as the 20-column terminal. */
const viewLine = (name: string) => `── view: ${name} `.padEnd(20, '─');
const HEADER = ['INFO: Workspace ws', '[a] ✔ load\n[b] ✔ load\n[c] ✔ load', 'INFO: Start'];

describe('OutputView', () => {
    let screen: {
        open: jest.SpyInstance;
        setTop: jest.SpyInstance;
        setBottom: jest.SpyInstance;
        clearScroll: jest.SpyInstance;
        writeLine: jest.SpyInstance;
        close: jest.SpyInstance;
    };
    let writeLineSpy: jest.SpyInstance;
    let writeSpy: jest.SpyInstance;
    let supportsFooterSpy: jest.SpyInstance;
    let rowsSpy: jest.SpyInstance;
    let columnsSpy: jest.SpyInstance;
    let scrollRows: number;
    let intercepted: ((text: string) => void) | undefined;
    let resizeListener: (() => void) | undefined;

    const screenLines = () => screen.writeLine.mock.calls.map(([line]) => stripAnsi(line));
    const printedLines = () => writeLineSpy.mock.calls.map((args) => stripAnsi(args.join(' ')));
    const lastTop = () => (screen.setTop.mock.calls.at(-1)?.[0] ?? screen.open.mock.calls.at(-1)![0]).map(stripAnsi);
    const lastBottom = () => (screen.setBottom.mock.calls.at(-1)?.[0] ?? screen.open.mock.calls.at(-1)![1]).map(stripAnsi);

    beforeEach(() => {
        scrollRows = 20;
        screen = {
            open: jest.spyOn(terminal.screen, 'open').mockImplementation((top, bottom, minScrollRows = 1) => {
                scrollRows = (terminal.rows ?? 0) - top.length - bottom.length;
                return scrollRows >= minScrollRows;
            }),
            setTop: jest.spyOn(terminal.screen, 'setTop').mockImplementation(() => {}),
            setBottom: jest.spyOn(terminal.screen, 'setBottom').mockImplementation(() => {}),
            clearScroll: jest.spyOn(terminal.screen, 'clearScroll').mockImplementation(() => {}),
            writeLine: jest.spyOn(terminal.screen, 'writeLine').mockImplementation(() => {}),
            close: jest.spyOn(terminal.screen, 'close').mockImplementation(() => {}),
        };
        jest.spyOn(terminal.screen, 'scrollRows', 'get').mockImplementation(() => scrollRows);
        intercepted = undefined;
        jest.spyOn(terminal, 'intercept').mockImplementation((handler) => {
            intercepted = handler;
            return () => { intercepted = undefined; };
        });
        resizeListener = undefined;
        jest.spyOn(terminal, 'onResize').mockImplementation((listener) => {
            resizeListener = listener;
            return () => { resizeListener = undefined; };
        });
        writeLineSpy = jest.spyOn(terminal, 'writeLine').mockImplementation(() => {});
        writeSpy = jest.spyOn(terminal, 'write').mockImplementation(() => {});
        supportsFooterSpy = jest.spyOn(terminal, 'supportsFooter', 'get').mockReturnValue(true);
        rowsSpy = jest.spyOn(terminal, 'rows', 'get').mockReturnValue(30);
        columnsSpy = jest.spyOn(terminal, 'columns', 'get').mockReturnValue(20);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('before start or without a TTY', () => {
        it('prints the lines of every member to the terminal', () => {
            const view = new OutputView(MEMBERS);

            view.printerFor('a')('a1');
            view.printerFor('b')('b1');

            expect(printedLines()).toEqual(['a1', 'b1']);
        });

        it('does not lay out the screen or handle keys without a TTY', () => {
            supportsFooterSpy.mockReturnValue(false);
            const view = new OutputView(MEMBERS);

            view.start(HEADER);
            view.handleKey('1');
            view.printerFor('b')('b1');
            view.stop();

            expect(screen.open).not.toHaveBeenCalled();
            expect(intercepted).toBeUndefined();
            expect(printedLines()).toEqual(['b1']);
        });

        it('falls back to printing lines when the screen is too small', () => {
            rowsSpy.mockReturnValue(8);
            const view = new OutputView(MEMBERS);

            view.start(HEADER);
            view.printerFor('a')('a1');

            expect(screen.open).toHaveBeenCalled();
            expect(printedLines()).toEqual(['a1']);
        });
    });

    describe('after start', () => {
        it('keeps the header at the top, above a line naming the view', () => {
            const view = new OutputView(MEMBERS);

            view.start(HEADER);

            expect(lastTop()).toEqual([
                'INFO: Workspace ws', '[a] ✔ load', '[b] ✔ load', '[c] ✔ load', 'INFO: Start',
                viewLine('all'),
            ]);
            expect(screen.open.mock.calls[0][2]).toBe(5);
        });

        it('drops the top of the header when the screen is short', () => {
            rowsSpy.mockReturnValue(12);
            const view = new OutputView(MEMBERS);

            view.start(HEADER);

            // 12 rows - 3 bottom rows - 1 line - 5 scroll rows leaves 3 rows for the header.
            expect(lastTop().slice(0, -1)).toEqual(['[b] ✔ load', '[c] ✔ load', 'INFO: Start']);
        });

        it('shows the state of each member below the log area', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);

            view.setState('b', 'finished');
            view.setState('c', 'disconnected');

            expect(lastBottom()).toEqual([
                '─'.repeat(20),
                ' 1 [a] ● running   2 [b] ✔ finished   3 [c] ✖ disconnected',
                ' 1-3: focus  Tab: next  a: all  Ctrl-D: exit',
            ]);
        });

        it('writes the lines of every member into the log area', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);

            view.printerFor('a')('a1');
            view.printerFor('b')('b1');

            expect(screenLines()).toEqual(['a1', 'b1']);
            expect(writeLineSpy).not.toHaveBeenCalled();
        });

        it('fills the log area with the lines written before start', () => {
            const view = new OutputView(MEMBERS);
            view.printerFor('a')('a1');
            writeLineSpy.mockClear();

            view.start(HEADER);

            expect(screenLines()).toEqual(['a1']);
        });

        it('holds back text from others, such as the logger, until stop', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);

            intercepted!('ERROR: [a] Exec');
            intercepted!('ution failed.\n');
            view.printerFor('a')('a1');

            expect(screenLines()).toEqual(['a1']);
            expect(writeSpy).not.toHaveBeenCalled();

            view.stop();

            expect(writeSpy.mock.calls).toEqual([['ERROR: [a] Exec'], ['ution failed.\n']]);
            expect(writeSpy.mock.invocationCallOrder[0]).toBeGreaterThan(screen.close.mock.invocationCallOrder[0]);
        });

        it('tells whether the screen is split', () => {
            const view = new OutputView(MEMBERS);
            expect(view.isOpen).toBe(false);

            view.start(HEADER);
            expect(view.isOpen).toBe(true);

            view.stop();
            expect(view.isOpen).toBe(false);
        });
    });

    describe('switching the view', () => {
        it('redraws the log area with the lines of the focused member', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.printerFor('a')('a1');
            view.printerFor('b')('b1');
            view.printerFor('a')('a2');
            screen.writeLine.mockClear();

            view.handleKey('2');
            view.printerFor('a')('a3');
            view.printerFor('b')('b2');

            expect(screen.clearScroll).toHaveBeenCalledTimes(1);
            expect(screenLines()).toEqual(['b1', 'b2']);
            expect(lastTop().at(-1)).toBe(viewLine('b'));
            expect(lastBottom()[1]).toContain('2 [b] ● running');
        });

        it('shows every member in the order the lines arrived when going back to all', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.handleKey('1');
            view.printerFor('a')('a1');
            view.printerFor('b')('b1');
            view.printerFor('a')('a2');
            screen.writeLine.mockClear();

            view.handleKey('a');
            view.printerFor('c')('c1');

            expect(screenLines()).toEqual(['a1', 'b1', 'a2', 'c1']);
            expect(lastTop().at(-1)).toBe(viewLine('all'));
        });

        it('writes only the lines that fit, counting wrapped lines and leaving the cursor row', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            scrollRows = 4;
            const longLine = 'x'.repeat(30);
            view.printerFor('a')('a1');
            view.printerFor('a')('a2');
            view.printerFor('a')(longLine);
            screen.writeLine.mockClear();

            view.handleKey('1');

            expect(screenLines()).toEqual(['a2', longLine]);
        });

        it('keeps at most historySize lines of each member', () => {
            const view = new OutputView(MEMBERS, 2);
            view.start(HEADER);
            for (let i = 1; i <= 4; i++) {
                view.printerFor('a')(`a${i}`);
            }
            screen.writeLine.mockClear();

            view.handleKey('1');

            expect(screenLines()).toEqual(['a3', 'a4']);
        });

        it('focuses on the next member with Tab', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            const views: string[] = [];

            for (const key of ['\t', '\t', '3', '\t']) {
                view.handleKey(key);
                views.push(lastTop().at(-1)!.match(/view: (\w+)/)![1]);
            }

            expect(views).toEqual(['a', 'b', 'c', 'a']);
        });

        it('ignores other keys, keys without a member and the current view', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);

            view.handleKey('4');
            view.handleKey('x');
            view.handleKey('a');
            view.handleKey('1');
            view.handleKey('1');

            expect(screen.clearScroll).toHaveBeenCalledTimes(1);
        });
    });

    describe('resize', () => {
        it('lays out the screen again for the new size', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.printerFor('a')('a1');
            screen.writeLine.mockClear();

            resizeListener!();

            expect(screen.open).toHaveBeenCalledTimes(2);
            expect(screenLines()).toEqual(['a1']);
        });

        it('stops when the screen becomes too small', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);

            rowsSpy.mockReturnValue(8);
            resizeListener!();
            view.printerFor('a')('a1');

            expect(intercepted).toBeUndefined();
            expect(resizeListener).toBeUndefined();
            expect(printedLines()).toEqual(['a1']);
        });
    });

    describe('stop', () => {
        it('switches to every member before giving the screen back', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.printerFor('a')('a1');
            view.printerFor('b')('b1');
            view.handleKey('1');
            screen.writeLine.mockClear();

            view.stop();

            expect(screenLines()).toEqual(['a1', 'b1']);
            expect(lastTop().at(-1)).toBe(viewLine('all'));
            expect(screen.clearScroll.mock.invocationCallOrder.at(-1))
                .toBeLessThan(screen.close.mock.invocationCallOrder[0]);
        });

        it('gives the screen back without the key help and prints every member from then on', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.handleKey('1');

            view.stop();
            view.printerFor('b')('b1');

            expect(screen.close).toHaveBeenCalledTimes(1);
            expect(screen.close.mock.calls[0][0]).toHaveLength(2);
            expect(intercepted).toBeUndefined();
            expect(resizeListener).toBeUndefined();
            expect(printedLines()).toEqual(['b1']);
        });

        it('shows the members still running as stopped', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.setState('a', 'finished');
            view.setState('b', 'failed');

            view.stop();

            expect(stripAnsi(screen.close.mock.calls[0][0][1]))
                .toBe(' 1 [a] ✔ finished   2 [b] ✖ failed   3 [c] ■ stopped');
        });

        it('ignores keys after stop', () => {
            const view = new OutputView(MEMBERS);
            view.start(HEADER);
            view.stop();

            view.handleKey('1');

            expect(screen.clearScroll).not.toHaveBeenCalled();
        });
    });
});
