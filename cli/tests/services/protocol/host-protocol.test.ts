import {
    HostProtocol,
    HostProtocolParser,
    hostProtocolBuilder,
    hostReplyBuilder,
    hostReplyErrorBuilder,
    formatHostValue,
    parseHostValue,
} from '../../../src/services/protocol/host-protocol';
import { MessageValue } from '../../../src/services/protocol/message-value';


describe('host protocol messaging commands', () => {
    test('should parse send command', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '004beta004tempi-42');
        const { parsed, remain } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{
            protocol: HostProtocol.Send, dst: 'beta', tag: 'temp', message: { type: 'integer', value: -42 },
        }]);
        expect(remain).toBe('\n');
    });

    test('should parse receive command', () => {
        const line = hostProtocolBuilder(HostProtocol.Receive, '005alpha000i');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Receive, src: 'alpha', tag: '', expected: 'integer' }]);
    });

    test('should parse broadcast command', () => {
        const line = hostProtocolBuilder(HostProtocol.Broadcast, '004tempi-3');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Broadcast, tag: 'temp', message: { type: 'integer', value: -3 } }]);
    });

    test('should keep the command numbers the shell uses', () => {
        // Must match host_protocol_t in microcontroller/ports/host/comm.h.
        expect(HostProtocol.Broadcast).toBe(11);
    });

    test('should parse names that contain digits and spaces', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '0071 2 3 4003tagi7');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{
            protocol: HostProtocol.Send, dst: '1 2 3 4', tag: 'tag', message: { type: 'integer', value: 7 },
        }]);
    });

    test('should count bytes, not chars, for non-ASCII text', () => {
        // What the shell writes (frames without a newline), read as latin1 like ProcessConnection does.
        const asRead = (line: string) => Buffer.from(line.replace(/\n/g, ''), 'utf8').toString('latin1');
        const log = hostProtocolBuilder(HostProtocol.Log, "'héllo'");
        expect(log).toBe("03 0008 'héllo'\n");
        // "béta" is 5 bytes in UTF-8.
        const send = hostProtocolBuilder(HostProtocol.Send, '005béta001ti1');
        const { parsed } = new HostProtocolParser().parse(asRead(log) + asRead(send));
        expect(parsed).toEqual([
            { protocol: HostProtocol.Log, log: "'héllo'" },
            { protocol: HostProtocol.Send, dst: 'béta', tag: 't', message: { type: 'integer', value: 1 } },
        ]);
    });

    test('should reject a malformed send command', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '009beta');
        expect(() => new HostProtocolParser().parse(line)).toThrow();
    });

    test('should build reply commands', () => {
        expect(hostReplyBuilder({ type: 'integer', value: 42 })).toBe('09 0003 i42\n');
        expect(hostReplyBuilder({ type: 'null' })).toBe('09 0001 n\n');
    });

    test('should build a reply error on a single line', () => {
        expect(hostReplyErrorBuilder('a\nb')).toBe('10 0003 a b\n');
        const long = hostReplyErrorBuilder('x'.repeat(300));
        expect(long.split('\n')).toHaveLength(2);
        expect(long.length).toBeLessThan(256);
    });
});

describe('host message value text', () => {
    test.each<[MessageValue, string]>([
        [{ type: 'integer', value: -7 }, 'i-7'],
        [{ type: 'float', value: 1.5 }, 'f1.5'],
        [{ type: 'boolean', value: false }, 'b0'],
        [{ type: 'string', value: Buffer.from('a\nb') }, 's610a62'],
        [{ type: 'null' }, 'n'],
        [{ type: 'integer[]', value: [1, -2, 3] }, 'I1,-2,3'],
        [{ type: 'integer[]', value: [] }, 'I'],
        [{ type: 'float[]', value: [0.5, Infinity, -Infinity] }, 'F0.5,inf,-inf'],
        [{ type: 'boolean[]', value: [true, false, true] }, 'B101'],
        [{
            type: 'any[]',
            value: [
                { type: 'integer', value: 1 }, { type: 'float', value: -0.5 }, { type: 'boolean', value: true },
                { type: 'null' }, { type: 'string', value: Buffer.from('a,b') },
            ],
        }, 'Ai1,f-0.5,b1,n,s612c62'],
        [{ type: 'any[]', value: [] }, 'A'],
    ])('formats and parses %j as %s', (value, text) => {
        expect(formatHostValue(value)).toBe(text);
        expect(parseHostValue(text)).toEqual(value);
    });

    test('parses the text printed by C', () => {
        expect(parseHostValue('f0.100000001')).toEqual({ type: 'float', value: Math.fround(0.1) });
        expect(parseHostValue('fnan')).toEqual({ type: 'float', value: NaN });
        expect(parseHostValue('F-nan,1e+10')).toEqual({ type: 'float[]', value: [NaN, Math.fround(1e10)] });
        expect(parseHostValue('s68c3a9')).toEqual({ type: 'string', value: Buffer.from('hé') });
    });

    test('rejects malformed values', () => {
        for (const text of ['i1.5', 'i99999999999', 'b2', 'nx', 's6', 'Ia', 'B12', 'x1', '', 'AI1', 'Ai1,']) {
            expect(() => parseHostValue(text)).toThrow();
        }
    });

    test('parses receive requests for every type', () => {
        const line = hostProtocolBuilder(HostProtocol.Receive, '001a001tB');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Receive, src: 'a', tag: 't', expected: 'boolean[]' }]);
    });
});
