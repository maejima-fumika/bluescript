import { ProtocolPacketBuilder, ProtocolParser, Protocol, MessageValueType } from '../../../src/services/protocol/device-protocol'


const BUFFER_SIZE =  17;

describe('ProtocolPacketBuilder', () => {
    test('should add jump command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.jump(1, 0x1234);
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Jump,
            0x01, 0x00, 0x00, 0x00, // id
            0x34, 0x12, 0x00, 0x00, // address
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add reset command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.reset();
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Reset,
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add short load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03]));
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add long load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
        const expectedBuffer1 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        const expectedBuffer2 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x38, 0x12, 0x00, 0x00, // address
            0x03, 0x00, 0x00, 0x00, // size
            0x04, 0x05, 0x06, // data
        ]);
        expect(builder.build()).toEqual([expectedBuffer1, expectedBuffer2]);
    });

    test('should add reset command after full load command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.load(0x1234, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06]));
        builder.reset();
        const expectedBuffer1 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x34, 0x12, 0x00, 0x00, // address
            0x04, 0x00, 0x00, 0x00, // size
            0x00, 0x01, 0x02, 0x03, // data
        ]);
        const expectedBuffer2 = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Load,
            0x38, 0x12, 0x00, 0x00, // address
            0x03, 0x00, 0x00, 0x00, // size
            0x04, 0x05, 0x06, // data
            Protocol.Reset,
        ]);
        expect(builder.build()).toEqual([expectedBuffer1, expectedBuffer2]);
    })
})

describe('ProtocolPacketBuilder messaging commands', () => {
    test('should add reply command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.reply(-2);
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.Reply,
            MessageValueType.Integer,
            0xfe, 0xff, 0xff, 0xff, // value
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should add reply error command', () => {
        const builder = new ProtocolPacketBuilder(BUFFER_SIZE);
        builder.replyError('oops');
        const expectedBuffer = Buffer.from([
            0x03, 0x00, // First Header
            Protocol.ReplyError,
            0x04, // length
            ...Buffer.from('oops'),
        ]);
        expect(builder.build()).toEqual([expectedBuffer]);
    });

    test('should truncate a long reply error', () => {
        const builder = new ProtocolPacketBuilder(512);
        builder.replyError('x'.repeat(300));
        const [unit] = builder.build();
        expect(unit[3]).toBe(63);
        expect(unit.length).toBe(2 + 2 + 63);
    });
});

describe('ProtocolParser messaging commands', () => {
    const name = (s: string) => [s.length, ...Buffer.from(s)];

    test('should parse send command', () => {
        const buffer = Buffer.from([
            Protocol.Send,
            ...name('beta'),
            ...name('temp'),
            MessageValueType.Integer,
            0x2a, 0x00, 0x00, 0x00,
        ]);
        expect(new ProtocolParser().parse(buffer)).toEqual({
            protocol: Protocol.Send, dst: 'beta', tag: 'temp', value: 42,
        });
    });

    test('should parse negative values', () => {
        const buffer = Buffer.from([
            Protocol.Send, ...name('a'), ...name(''), MessageValueType.Integer, 0xff, 0xff, 0xff, 0xff,
        ]);
        expect(new ProtocolParser().parse(buffer)).toMatchObject({ dst: 'a', tag: '', value: -1 });
    });

    test('should parse receive command', () => {
        const buffer = Buffer.from([
            Protocol.Receive,
            ...name('alpha'),
            ...name('temp'),
            MessageValueType.Integer,
        ]);
        expect(new ProtocolParser().parse(buffer)).toEqual({
            protocol: Protocol.Receive, src: 'alpha', tag: 'temp',
        });
    });

    test('should reject a truncated name', () => {
        const buffer = Buffer.from([Protocol.Receive, 10, ...Buffer.from('abc')]);
        expect(() => new ProtocolParser().parse(buffer)).toThrow();
    });

    test('should keep the command numbers the device firmware uses', () => {
        // Must match protocol_t in microcontroller/core/src/protocol.c.
        expect([Protocol.Send, Protocol.Receive, Protocol.Reply, Protocol.ReplyError]).toEqual([9, 10, 11, 12]);
    });
});
