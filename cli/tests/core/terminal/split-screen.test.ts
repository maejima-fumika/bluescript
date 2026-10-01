import { SplitScreen } from '../../../src/core/terminal';

function createStdout(isTTY = true, rows: number | undefined = 10) {
    const chunks: string[] = [];
    const stream = {
        isTTY,
        rows,
        columns: 20,
        write: jest.fn((chunk: string) => {
            chunks.push(chunk);
            return true;
        }),
    } as unknown as NodeJS.WriteStream;
    return {
        stream,
        text: () => chunks.join(''),
        clear: () => { chunks.length = 0; },
    };
}

/** Moves the cursor to (x, y), as readline.cursorTo writes it (1-based). */
const at = (x: number, y: number) => `\x1b[${y + 1};${x + 1}H`;

describe('SplitScreen', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('draws the fixed rows and sets the scroll region between them', () => {
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);

        expect(screen.open(['h1', 'h2'], ['f1', 'f2', 'f3'])).toBe(true);

        const text = stdout.text();
        expect(text).toContain(`${at(0, 0)}\x1b[2Kh1`);
        expect(text).toContain(`${at(0, 1)}\x1b[2Kh2`);
        expect(text).toContain(`${at(0, 7)}\x1b[2Kf1`);
        expect(text).toContain(`${at(0, 9)}\x1b[2Kf3`);
        expect(text.endsWith(`\x1b[3;7r${at(0, 2)}`)).toBe(true);
        expect(screen.isOpen).toBe(true);
        expect(screen.scrollRows).toBe(5);
        screen.close();
    });

    it('draws fixed rows without wrapping and puts the cursor back', () => {
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);
        screen.open(['h'], ['f']);
        stdout.clear();

        screen.setBottom(['new']);

        expect(stdout.text()).toBe(`\x1b7\x1b[?7l${at(0, 9)}\x1b[2Knew\x1b[?7h\x1b8`);
        screen.close();
    });

    it('does nothing and returns false without a TTY or with too few rows', () => {
        const notTTY = createStdout(false);
        expect(new SplitScreen(notTTY.stream).open(['h'], ['f'])).toBe(false);
        expect(notTTY.text()).toBe('');

        const small = createStdout(true, 6);
        expect(new SplitScreen(small.stream).open(['h1', 'h2'], ['f1', 'f2'], 3)).toBe(false);
        expect(small.text()).toBe('');
    });

    it('clears only the scrolling area', () => {
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);
        screen.open(['h'], ['f']);
        stdout.clear();

        screen.clearScroll();

        const text = stdout.text();
        for (let row = 1; row <= 8; row++) {
            expect(text).toContain(`${at(0, row)}\x1b[2K`);
        }
        expect(text).not.toContain(at(0, 0));
        expect(text).not.toContain(at(0, 9));
        expect(text.endsWith(at(0, 1))).toBe(true);
        screen.close();
    });

    it('replaces the bottom rows on close and moves the cursor below them', () => {
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);
        screen.open(['h'], ['f1', 'f2', 'f3']);
        stdout.clear();

        screen.close(['last']);

        const text = stdout.text();
        expect(text).toContain(`${at(0, 7)}\x1b[2Klast`);
        expect(text).toContain(`${at(0, 8)}\x1b[2K${at(0, 9)}\x1b[2K`);
        expect(text).toContain('\x1b[r\x1b[?25h');
        expect(text.endsWith(at(0, 8))).toBe(true);
        expect(screen.isOpen).toBe(false);
    });

    it('starts a new line below the last row when the bottom rows are kept', () => {
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);
        screen.open(['h'], ['f']);
        stdout.clear();

        screen.close();

        expect(stdout.text().endsWith(`${at(0, 9)}\n`)).toBe(true);
    });

    it('resets the terminal when the process exits while open', () => {
        const onSpy = jest.spyOn(process, 'on');
        const offSpy = jest.spyOn(process, 'off');
        const stdout = createStdout();
        const screen = new SplitScreen(stdout.stream);

        screen.open(['h'], ['f']);
        const [event, listener] = onSpy.mock.calls.at(-1)!;
        expect(event).toBe('exit');
        stdout.clear();
        (listener as () => void)();
        expect(stdout.text()).toBe('\x1b[r\x1b[?7h\x1b[?25h');

        screen.close();
        expect(offSpy).toHaveBeenCalledWith('exit', listener);
    });
});
