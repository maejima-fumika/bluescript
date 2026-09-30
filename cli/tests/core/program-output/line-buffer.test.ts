import { LineBuffer } from '../../../src/core/program-output/line-buffer';

describe('LineBuffer', () => {
    it('returns completed lines and keeps the rest', () => {
        const buffer = new LineBuffer();

        expect(buffer.push('a\nb')).toEqual(['a']);
        expect(buffer.push('c\r\n\n')).toEqual(['bc', '']);
        expect(buffer.flush()).toBeUndefined();
    });

    it('handles CRLF split between pushes', () => {
        const buffer = new LineBuffer();

        expect(buffer.push('a\r')).toEqual([]);
        expect(buffer.push('\nb')).toEqual(['a']);
        expect(buffer.flush()).toBe('b');
        expect(buffer.flush()).toBeUndefined();
    });
});
