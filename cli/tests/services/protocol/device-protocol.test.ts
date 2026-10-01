import {
    decodeMessageValue, encodeMessageValue, MessageValueType, Protocol, ProtocolPacketBuilder, ProtocolParser,
} from '../../../src/services/protocol/device-protocol'
import { MessageValue } from '../../../src/services/protocol/message-value'


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
        builder.reply({ type: 'integer', value: -2 });
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
            protocol: Protocol.Send, dst: 'beta', tag: 'temp', message: { type: 'integer', value: 42 },
        });
    });

    test('should parse negative values', () => {
        const buffer = Buffer.from([
            Protocol.Send, ...name('a'), ...name(''), MessageValueType.Integer, 0xff, 0xff, 0xff, 0xff,
        ]);
        expect(new ProtocolParser().parse(buffer)).toMatchObject({ dst: 'a', tag: '', message: { value: -1 } });
    });

    test('should parse receive command', () => {
        const buffer = Buffer.from([
            Protocol.Receive,
            ...name('alpha'),
            ...name('temp'),
            MessageValueType.FloatArray,
        ]);
        expect(new ProtocolParser().parse(buffer)).toEqual({
            protocol: Protocol.Receive, src: 'alpha', tag: 'temp', expected: 'float[]',
        });
    });

    test('should parse broadcast command', () => {
        const buffer = Buffer.from([
            Protocol.Broadcast,
            ...name('temp'),
            MessageValueType.Integer,
            0x07, 0x00, 0x00, 0x00,
        ]);
        expect(new ProtocolParser().parse(buffer)).toEqual({
            protocol: Protocol.Broadcast, tag: 'temp', message: { type: 'integer', value: 7 },
        });
    });

    test('should reject a truncated name', () => {
        const buffer = Buffer.from([Protocol.Receive, 10, ...Buffer.from('abc')]);
        expect(() => new ProtocolParser().parse(buffer)).toThrow();
    });

    test('should keep the command numbers the device firmware uses', () => {
        // Must match protocol_t in microcontroller/core/src/protocol.c.
        expect([Protocol.Send, Protocol.Receive, Protocol.Reply, Protocol.ReplyError, Protocol.Broadcast])
            .toEqual([9, 10, 11, 12, 13]);
    });
});

describe('message value encoding', () => {
    const roundTrip = (v: MessageValue) => decodeMessageValue(encodeMessageValue(v));

    test.each<[string, MessageValue, number[]]>([
        ['integer', { type: 'integer', value: -2 }, [0, 0xfe, 0xff, 0xff, 0xff]],
        ['float', { type: 'float', value: 1.5 }, [1, 0x00, 0x00, 0xc0, 0x3f]],
        ['boolean', { type: 'boolean', value: true }, [2, 1]],
        ['string', { type: 'string', value: Buffer.from('hé') }, [3, 3, 0, 0x68, 0xc3, 0xa9]],
        ['null', { type: 'null' }, [4]],
        ['integer[]', { type: 'integer[]', value: [1, -1] }, [5, 2, 0, 1, 0, 0, 0, 0xff, 0xff, 0xff, 0xff]],
        ['float[]', { type: 'float[]', value: [] }, [6, 0, 0]],
        ['boolean[]', { type: 'boolean[]', value: [true, false, true] }, [7, 3, 0, 1, 0, 1]],
    ])('encodes and decodes %s', (_name, value, bytes) => {
        expect([...encodeMessageValue(value)]).toEqual(bytes);
        expect(roundTrip(value)).toEqual(value);
    });

    test('keeps float specials and rounds to float32', () => {
        const decoded = roundTrip({ type: 'float[]', value: [NaN, Infinity, -Infinity, 0.1] });
        expect(decoded).toEqual({ type: 'float[]', value: [NaN, Infinity, -Infinity, Math.fround(0.1)] });
    });

    test('rejects truncated values and unknown types', () => {
        expect(() => decodeMessageValue(Buffer.from([5, 2, 0, 1, 0, 0, 0]))).toThrow(/truncated/);
        expect(() => decodeMessageValue(Buffer.from([99]))).toThrow(/Unknown value type/);
    });

    test('builds a reply carrying a string', () => {
        const [unit] = new ProtocolPacketBuilder(BUFFER_SIZE).reply({ type: 'string', value: Buffer.from('ab') }).build();
        expect([...unit]).toEqual([0x03, 0x00, Protocol.Reply, MessageValueType.String, 2, 0, 0x61, 0x62]);
    });
});
