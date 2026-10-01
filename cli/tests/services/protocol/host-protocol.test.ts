import {
    HostProtocol,
    HostProtocolParser,
    hostProtocolBuilder,
    hostReplyBuilder,
    hostReplyErrorBuilder,
} from '../../../src/services/protocol/host-protocol';


describe('host protocol messaging commands', () => {
    test('should parse send command', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '004beta004tempi-42');
        const { parsed, remain } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Send, dst: 'beta', tag: 'temp', value: -42 }]);
        expect(remain).toBe('\n');
    });

    test('should parse receive command', () => {
        const line = hostProtocolBuilder(HostProtocol.Receive, '005alpha000i');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Receive, src: 'alpha', tag: '' }]);
    });

    test('should parse names that contain digits and spaces', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '0071 2 3 4003tagi7');
        const { parsed } = new HostProtocolParser().parse(line);
        expect(parsed).toEqual([{ protocol: HostProtocol.Send, dst: '1 2 3 4', tag: 'tag', value: 7 }]);
    });

    test('should reject a malformed send command', () => {
        const line = hostProtocolBuilder(HostProtocol.Send, '009beta');
        expect(() => new HostProtocolParser().parse(line)).toThrow();
    });

    test('should build reply commands', () => {
        expect(hostReplyBuilder(42)).toBe('09 0003 i42\n');
        expect(hostReplyBuilder(-1)).toBe('09 0003 i-1\n');
    });

    test('should build a reply error on a single line', () => {
        expect(hostReplyErrorBuilder('a\nb')).toBe('10 0003 a b\n');
        const long = hostReplyErrorBuilder('x'.repeat(300));
        expect(long.split('\n')).toHaveLength(2);
        expect(long.length).toBeLessThan(256);
    });
});
