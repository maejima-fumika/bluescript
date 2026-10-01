import { LineOutput, createTags } from '../../../src/core/program-output';
import { terminal } from '../../../src/core/terminal';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, '');

describe('createTags', () => {
    it('pads every tag to the longest name, without color', () => {
        const tags = createTags(['sensor', 'sim']);

        expect(tags.get('sensor')).toBe('[sensor]');
        expect(tags.get('sim')).toBe('[sim   ]');
    });
});

describe('LineOutput with a tag', () => {
    let logSpy: jest.SpyInstance;
    const printedLines = () => logSpy.mock.calls.map((args) => stripAnsi(args.join(' ')));

    beforeEach(() => {
        logSpy = jest.spyOn(terminal, 'writeLine').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('prints each complete line with the tag', () => {
        const output = new LineOutput('[a]');

        output.write('first\nsecond\n');

        expect(printedLines()).toEqual(['[a] first', '[a] second']);
    });

    it('waits for a newline when a line arrives in pieces', () => {
        const output = new LineOutput('[a]');

        output.write('hel');
        expect(printedLines()).toEqual([]);

        output.write('lo\r\nwor');
        expect(printedLines()).toEqual(['[a] hello']);

        output.write('ld\n');
        expect(printedLines()).toEqual(['[a] hello', '[a] world']);
    });

    it('buffers errors separately from normal output', () => {
        const output = new LineOutput('[a]');

        output.write('out-');
        output.writeError('err\n');
        output.write('line\n');

        expect(printedLines()).toEqual(['[a] err', '[a] out-line']);
    });

    it('prints pending text on flush', () => {
        const output = new LineOutput('[a]');

        output.write('no newline');
        output.flush();
        output.flush();

        expect(printedLines()).toEqual(['[a] no newline']);
    });
});

describe('LineOutput without a tag', () => {
    let logSpy: jest.SpyInstance;
    const printedLines = () => logSpy.mock.calls.map((args) => stripAnsi(args.join(' ')));

    beforeEach(() => {
        logSpy = jest.spyOn(terminal, 'writeLine').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('joins a line that arrives in pieces', () => {
        const output = new LineOutput();

        output.write('hel');
        output.write('lo\nwor');
        output.write('ld\n');

        expect(printedLines()).toEqual(['hello', 'world']);
    });

    it('prints errors and pending text on flush', () => {
        const output = new LineOutput();

        output.writeError('failed\n');
        output.write('no newline');
        output.flush();

        expect(printedLines()).toEqual(['failed', 'no newline']);
    });
});

describe('LineOutput with a custom printer', () => {
    it('passes each finished line, with the tag, to the printer', () => {
        const lines: string[] = [];
        const output = new LineOutput('[a]', (line) => lines.push(stripAnsi(line)));

        output.write('first\nsec');
        output.writeError('oops\n');
        output.flush();

        expect(lines).toEqual(['[a] first', '[a] oops', '[a] sec']);
    });
});
