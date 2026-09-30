import { createPrefixedOutput, createTags } from '../../../src/core/logger/prefixed-output';

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const stripAnsi = (text: string) => text.replace(ANSI_PATTERN, '');

describe('createTags', () => {
    it('pads every tag to the longest name', () => {
        const tags = createTags(['sensor', 'sim']);

        expect(stripAnsi(tags.get('sensor')!)).toBe('[sensor]');
        expect(stripAnsi(tags.get('sim')!)).toBe('[sim   ]');
    });
});

describe('createPrefixedOutput', () => {
    let logSpy: jest.SpyInstance;
    const printedLines = () => logSpy.mock.calls.map((args) => stripAnsi(args.join(' ')));

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('prints each complete line with the tag', () => {
        const output = createPrefixedOutput('[a]');

        output.write('first\nsecond\n');

        expect(printedLines()).toEqual(['[a] first', '[a] second']);
    });

    it('waits for a newline when a line arrives in pieces', () => {
        const output = createPrefixedOutput('[a]');

        output.write('hel');
        expect(printedLines()).toEqual([]);

        output.write('lo\r\nwor');
        expect(printedLines()).toEqual(['[a] hello']);

        output.write('ld\n');
        expect(printedLines()).toEqual(['[a] hello', '[a] world']);
    });

    it('buffers errors separately from normal output', () => {
        const output = createPrefixedOutput('[a]');

        output.write('out-');
        output.writeError('err\n');
        output.write('line\n');

        expect(printedLines()).toEqual(['[a] err', '[a] out-line']);
    });

    it('prints pending text on flush', () => {
        const output = createPrefixedOutput('[a]');

        output.write('no newline');
        output.flush();
        output.flush();

        expect(printedLines()).toEqual(['[a] no newline']);
    });
});
