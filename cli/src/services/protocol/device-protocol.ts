import { Buffer } from "node:buffer";
import { MemoryLayout } from "@bscript/lang";
import { isArrayElement, MessageType, MessageValue } from "./message-value";


export enum Protocol {
    None,
    Load,
    Jump,
    Reset,

    Log,
    Error,
    Memory,
    Exectime,
    Profile,

    // Messages between the projects in a workspace.
    Send,
    Receive,
    Reply,
    ReplyError,
    Broadcast,
}

/** The type code of a value carried by the messaging commands. Must match messaging.h on ESP32. */
export enum MessageValueType {
    Integer = 0,
    Float = 1,
    Boolean = 2,
    String = 3,
    Null = 4,
    IntegerArray = 5,
    FloatArray = 6,
    BooleanArray = 7,
    AnyArray = 8,
}

const TYPE_CODES: Record<MessageType, MessageValueType> = {
    'integer': MessageValueType.Integer,
    'float': MessageValueType.Float,
    'boolean': MessageValueType.Boolean,
    'string': MessageValueType.String,
    'null': MessageValueType.Null,
    'integer[]': MessageValueType.IntegerArray,
    'float[]': MessageValueType.FloatArray,
    'boolean[]': MessageValueType.BooleanArray,
    'any[]': MessageValueType.AnyArray,
};

const TYPE_NAMES = Object.fromEntries(
    Object.entries(TYPE_CODES).map(([name, code]) => [code, name]),
) as Record<MessageValueType, MessageType>;

const MAX_ELEMENT_COUNT = 0xffff;   // count(2)

/**
 * | type(1) | value |
 * Fixed-size values are written as is (int32, float32, u8, or nothing for null).
 * Variable-size values are | count(2) | elements |: bytes for a string, u8 for boolean[],
 * int32 / float32 for integer[] / float[], and | type(1) | value | for any[].
 * Everything is little-endian.
 */
export function encodeMessageValue(message: MessageValue): Buffer {
    const type = Buffer.from([TYPE_CODES[message.type]]);
    switch (message.type) {
        case 'integer': {
            const b = Buffer.allocUnsafe(4);
            b.writeInt32LE(message.value, 0);
            return Buffer.concat([type, b]);
        }
        case 'float': {
            const b = Buffer.allocUnsafe(4);
            b.writeFloatLE(message.value, 0);
            return Buffer.concat([type, b]);
        }
        case 'boolean':
            return Buffer.concat([type, Buffer.from([message.value ? 1 : 0])]);
        case 'null':
            return type;
        case 'string':
            return Buffer.concat([type, encodeCount(message.value.length), message.value]);
        case 'integer[]':
        case 'float[]': {
            const b = Buffer.allocUnsafe(4 * message.value.length);
            message.value.forEach((v, i) => {
                if (message.type === 'integer[]') {
                    b.writeInt32LE(v, 4 * i);
                } else {
                    b.writeFloatLE(v, 4 * i);
                }
            });
            return Buffer.concat([type, encodeCount(message.value.length), b]);
        }
        case 'boolean[]':
            return Buffer.concat([
                type, encodeCount(message.value.length), Buffer.from(message.value.map((v) => (v ? 1 : 0))),
            ]);
        case 'any[]':
            return Buffer.concat([
                type, encodeCount(message.value.length), ...message.value.map(encodeMessageValue),
            ]);
    }
}

function encodeCount(count: number): Buffer {
    if (count > MAX_ELEMENT_COUNT) {
        throw new Error(`A message cannot carry more than ${MAX_ELEMENT_COUNT} elements.`);
    }
    const b = Buffer.allocUnsafe(2);
    b.writeUInt16LE(count, 0);
    return b;
}


// Headers
const FIRST_HEADER_SIZE = 2;
const FIRST_HEADER = Buffer.from([0x03, 0x00]);

// Command sizes
const LOAD_HEADER_SIZE = 9;   // cmd(1) + address(4) + size(4)
const JUMP_HEADER_SIZE = 9;   // cmd(1) + id(4) + address(4)
const RESET_HEADER_SIZE = 1;  // cmd(1)
// The device keeps the reason in a 64-byte buffer (REPLY_ERROR_SIZE in main-thread.c).
const REPLY_ERROR_MAX_LENGTH = 63;

const ALIGNMENT = 4;

/** The largest command that fits in one unit (BLE write) of `unitSize` bytes. */
export function maxCommandSize(unitSize: number): number {
    return unitSize - FIRST_HEADER_SIZE;
}

export class ProtocolPacketBuilder {
    private readonly unitSize: number;
    private units: Buffer[] = [];
    private lastUnit: Buffer;
    private lastUnitRemain: number;

    constructor(unitSize: number, useFirstHeader = true) {
        this.checkUnitSize(unitSize);
        if (useFirstHeader) {
            this.unitSize = unitSize - FIRST_HEADER_SIZE;
            this.lastUnit = Buffer.from(FIRST_HEADER);
        } else {
            this.unitSize = unitSize;
            this.lastUnit = Buffer.from([]);
        }
        this.lastUnitRemain = this.unitSize;
    }

    private checkUnitSize(size: number) {
        if (size < 15) {
            throw new Error('Unit size is smaller than minimum unit size.');
        }
    }

    public build(): Buffer[] {
        if (this.lastUnit.length > FIRST_HEADER_SIZE) {
            this.units.push(this.lastUnit);
        }
        const result = this.units;

        // Reset state
        this.units = [];
        this.lastUnit = Buffer.from(FIRST_HEADER);
        this.lastUnitRemain = this.unitSize;

        return result;
    }

    public load(address: number, data: Buffer) {
        let dataOffset = 0;
        let currentAddress = address;

        while (dataOffset < data.length) {
            const dataRemain = data.length - dataOffset;
            let writtenBytes = this.loadChunk(currentAddress, data.subarray(dataOffset), dataRemain);
            
            if (writtenBytes <= 0) {
                this.flushUnit();
                writtenBytes = this.loadChunk(currentAddress, data.subarray(dataOffset), dataRemain);
                if (writtenBytes === 0) {
                    throw new Error("Failed to make progress in load method. Check data and unit sizes.");
                }
            }
            
            dataOffset += writtenBytes;
            currentAddress += writtenBytes;
        }
        return this;
    }

    private loadChunk(address: number, data: Buffer, dataRemain: number): number {
        if (this.lastUnitRemain < LOAD_HEADER_SIZE) {
            return 0;
        }

        const availableSpace = this.lastUnitRemain - LOAD_HEADER_SIZE;
        const alignedSpace = this.alignDown(availableSpace, ALIGNMENT);

        const chunkSize = Math.min(dataRemain, alignedSpace);

        if (chunkSize <= 0) {
            return 0;
        }
        
        const header = this.createLoadHeader(address, chunkSize);
        const chunk = data.subarray(0, chunkSize);

        this.appendToCurrentUnit(header);
        this.appendToCurrentUnit(chunk);

        return chunkSize;
    }

    private alignDown(value: number, alignment: number): number {
        return value & ~(alignment - 1);
    }

    private createLoadHeader(address: number, size: number) {
        const header = Buffer.allocUnsafe(LOAD_HEADER_SIZE);
        header.writeUInt8(Protocol.Load, 0); // cmd(1)
        header.writeUInt32LE(address, 1);    // address(4)
        header.writeUInt32LE(size, 5);       // size(4)
        return header;
    }

    public jump(id: number, address: number) {
        const header = Buffer.allocUnsafe(JUMP_HEADER_SIZE);
        header.writeUInt8(Protocol.Jump, 0);     // cmd(1)
        header.writeInt32LE(id, 1);              // id(4)
        header.writeUInt32LE(address, 5);        // address(4)
        return this.appendCommand(header);
    }

    public reset() {
        const header = Buffer.allocUnsafe(RESET_HEADER_SIZE);
        header.writeUInt8(Protocol.Reset, 0);
        return this.appendCommand(header);
    }

    /** Answers a Send, Broadcast or Receive request from the device. */
    public reply(message: MessageValue) {
        // | cmd(1) | type(1) | value |
        return this.appendCommand(Buffer.concat([Buffer.from([Protocol.Reply]), encodeMessageValue(message)]));
    }

    /** Makes a pending Send or Receive request on the device throw `reason`. */
    public replyError(reason: string) {
        let message = Buffer.from(reason, 'utf-8');
        if (message.length > REPLY_ERROR_MAX_LENGTH) {
            message = message.subarray(0, REPLY_ERROR_MAX_LENGTH);
        }
        const header = Buffer.from([Protocol.ReplyError, message.length]); // cmd(1) + len(1)
        return this.appendCommand(Buffer.concat([header, message]));
    }

    private appendCommand(commandData: Buffer) {
        if (commandData.length > this.lastUnitRemain) {
            this.flushUnit();
        }
        this.appendToCurrentUnit(commandData);
        return this;
    }

    private flushUnit() {
        if (this.lastUnit.length > FIRST_HEADER_SIZE) {
            this.units.push(this.lastUnit);
        }
        this.lastUnit = Buffer.from(FIRST_HEADER);
        this.lastUnitRemain = this.unitSize;
    }

    private appendToCurrentUnit(data: Buffer) {
        this.lastUnit = Buffer.concat([this.lastUnit, data]);
        this.lastUnitRemain -= data.length;
    }
}


type ProtocolPayloads = {
    [Protocol.None]: {};
    [Protocol.Load]: {};
    [Protocol.Jump]: {};
    [Protocol.Reset]: {};
    [Protocol.Log]: { log: string };
    [Protocol.Error]: { error: string };
    [Protocol.Memory]: { layout: MemoryLayout };
    [Protocol.Exectime]: { id: number; time: number };
    [Protocol.Profile]: { fid: number; paramtypes: string[] };
    [Protocol.Send]: { dst: string; tag: string; message: MessageValue };
    [Protocol.Receive]: { src: string; tag: string; expected: MessageType };
    [Protocol.Reply]: {};
    [Protocol.ReplyError]: {};
    [Protocol.Broadcast]: { tag: string; message: MessageValue };
}

export type ParseResult<T extends Protocol = Protocol> = {
    [K in T]: { protocol: K } & ProtocolPayloads[K]
}[T];

type ParserFunction<K extends Protocol> = (buffer: Buffer, offset: number) => ProtocolPayloads[K];

export class ProtocolParser {
    private readonly parsers: {[K in Protocol]?: ParserFunction<K>};

    constructor() {
        this.parsers = {
            [Protocol.Log]: ProtocolParser.parseLog,
            [Protocol.Error]: ProtocolParser.parseError,
            [Protocol.Memory]: ProtocolParser.parseMemory,
            [Protocol.Exectime]: ProtocolParser.parseExectime,
            [Protocol.Profile]: ProtocolParser.parseProfile,
            [Protocol.Send]: ProtocolParser.parseSend,
            [Protocol.Receive]: ProtocolParser.parseReceive,
            [Protocol.Broadcast]: ProtocolParser.parseBroadcast,
        }
    }

    public parse(buffer: Buffer): ParseResult {
        if (buffer.length === 0) {
            throw new Error('Failed to parse buffer. The buffer is empty.');
        }
        const protocol = buffer.readUInt8(0);
        if (!this.isParseableProtocol(protocol)) {
            throw new Error(`Failed to parse buffer. The protocol ${protocol} is not parsable.`);
        }
        const parser = this.parsers[protocol]!;
        const payload = parser(buffer, 1);
        return {protocol, ...payload} as ParseResult;
    }

    private isParseableProtocol(value: number): value is keyof typeof this.parsers {
        return value in this.parsers;
    }

    static parseLog(buffer: Buffer, offset: number): {log: string} {
        const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
        const log = buffer.toString('utf-8', offset, end);
        return { log };
    }

    static parseError(buffer: Buffer, offset: number): {error: string} {
        const end = buffer[buffer.length - 1] === 0 ? buffer.length - 1 : buffer.length;
        const error = buffer.toString('utf-8', offset, end);
        return { error };
    }

    static parseMemory(buffer: Buffer, offset: number): {layout: MemoryLayout} {
        const readMemory = () => {
            const address = buffer.readUInt32LE(offset); offset += 4;
            const size = buffer.readUInt32LE(offset); offset += 4;
            return { address, size };
        };
        const layout = {
            iram: readMemory(),
            dram: readMemory(),
            iflash: readMemory(),
            dflash: readMemory(),
        };
        return { layout };
    }

    static parseExectime(buffer: Buffer, offset: number): {id: number, time: number} {
        const id = buffer.readInt32LE(offset); offset += 4;
        const time = buffer.readFloatLE(offset); offset += 4;
        return { id, time };
    }

    static parseProfile(buffer: Buffer, offset: number): {fid:number, paramtypes:string[]} {
        const fid = buffer.readUInt8(offset); offset += 1;
        const textDecoder = new TextDecoder();
        const paramStr = textDecoder.decode(buffer.subarray(offset, buffer.length - 1));
        return { fid, paramtypes: paramStr ? paramStr.split(", ") : [] };
    }

    // | dstLen(1) | dst | tagLen(1) | tag | type(1) | value |
    static parseSend(buffer: Buffer, offset: number): {dst: string, tag: string, message: MessageValue} {
        const reader = new MessageReader(buffer, offset);
        const dst = reader.readName();
        const tag = reader.readName();
        const message = reader.readValue();
        return { dst, tag, message };
    }

    // | tagLen(1) | tag | type(1) | value |
    static parseBroadcast(buffer: Buffer, offset: number): {tag: string, message: MessageValue} {
        const reader = new MessageReader(buffer, offset);
        const tag = reader.readName();
        const message = reader.readValue();
        return { tag, message };
    }

    // | srcLen(1) | src | tagLen(1) | tag | type(1) |, where type is the type the program expects.
    static parseReceive(buffer: Buffer, offset: number): {src: string, tag: string, expected: MessageType} {
        const reader = new MessageReader(buffer, offset);
        const src = reader.readName();
        const tag = reader.readName();
        const expected = reader.readValueType();
        return { src, tag, expected };
    }
}

/** Reads the value written by {@link encodeMessageValue}. */
export function decodeMessageValue(buffer: Buffer, offset = 0): MessageValue {
    return new MessageReader(buffer, offset).readValue();
}

class MessageReader {
    constructor(private buffer: Buffer, private offset: number) {}

    readName(): string {
        const length = this.buffer.readUInt8(this.offset); this.offset += 1;
        const end = this.offset + length;
        if (end > this.buffer.length) {
            throw new Error('Failed to parse message. The name is truncated.');
        }
        const name = this.buffer.toString('utf-8', this.offset, end);
        this.offset = end;
        return name;
    }

    readValueType(): MessageType {
        const code = this.buffer.readUInt8(this.offset); this.offset += 1;
        const type = TYPE_NAMES[code as MessageValueType];
        if (type === undefined) {
            throw new Error(`Failed to parse message. Unknown value type ${code}.`);
        }
        return type;
    }

    readValue(): MessageValue {
        const type = this.readValueType();
        switch (type) {
            case 'integer':
                return { type, value: this.read(4).readInt32LE(0) };
            case 'float':
                return { type, value: this.read(4).readFloatLE(0) };
            case 'boolean':
                return { type, value: this.read(1)[0] !== 0 };
            case 'null':
                return { type };
            case 'string': {
                const count = this.readCount();
                return { type, value: Buffer.from(this.read(count)) };
            }
            case 'integer[]':
            case 'float[]': {
                const count = this.readCount();
                const bytes = this.read(4 * count);
                const value = Array.from({ length: count }, (_, i) =>
                    type === 'integer[]' ? bytes.readInt32LE(4 * i) : bytes.readFloatLE(4 * i));
                return { type, value };
            }
            case 'boolean[]': {
                const count = this.readCount();
                return { type, value: [...this.read(count)].map((b) => b !== 0) };
            }
            case 'any[]': {
                const count = this.readCount();
                const value = Array.from({ length: count }, () => {
                    const element = this.readValue();
                    if (!isArrayElement(element)) {
                        throw new Error(`Failed to parse message. An any[] cannot hold ${element.type}.`);
                    }
                    return element;
                });
                return { type, value };
            }
        }
    }

    private readCount(): number {
        return this.read(2).readUInt16LE(0);
    }

    private read(size: number): Buffer {
        const end = this.offset + size;
        if (end > this.buffer.length) {
            throw new Error('Failed to parse message. The value is truncated.');
        }
        const bytes = this.buffer.subarray(this.offset, end);
        this.offset = end;
        return bytes;
    }
}
