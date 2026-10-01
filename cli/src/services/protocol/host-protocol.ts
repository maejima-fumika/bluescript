import { Buffer } from "node:buffer";
import { isArrayElement, isInt32, MessageType, MessageValue } from "./message-value";

export enum HostProtocol {
    None = 0,
    Load = 1,
    Call = 2,

    Log = 3,
    Error = 4,
    Exectime = 5,
    Loadtime = 6,

    // Messages between the projects in a workspace.
    Send = 7,
    Receive = 8,
    Reply = 9,
    ReplyError = 10,
    Broadcast = 11,
    Max
}

// Must match MAX_PAYLOAD_SIZE in microcontroller/ports/host/comm.h.
export const HOST_MAX_PAYLOAD_SIZE = 4096;

export function hostProtocolBuilder(protocol: HostProtocol, payload: string) {
    // The shell reads the payload length in bytes.
    const byteLength = Buffer.byteLength(payload, 'utf8');
    if (byteLength > HOST_MAX_PAYLOAD_SIZE) {
        throw new Error(
            `Host protocol payload exceeds ${HOST_MAX_PAYLOAD_SIZE} bytes ` +
            `(got ${byteLength}): ${payload}`,
        );
    }
    const protocolStr = String(protocol).padStart(2, '0');
    const payloadLen = String(byteLength).padStart(4, '0');
    return `${protocolStr} ${payloadLen} ${payload}\n`;
}

const NAME_LENGTH_DIGITS = 3;
// The shell reads a whole command into a fixed-size line buffer (see comm.h), so keep it short.
const REPLY_ERROR_MAX_LENGTH = 200;

// The type char that starts a value; must match comm.h.
const TYPE_CHARS: Record<MessageType, string> = {
    'integer': 'i',
    'float': 'f',
    'boolean': 'b',
    'string': 's',
    'null': 'n',
    'integer[]': 'I',
    'float[]': 'F',
    'boolean[]': 'B',
    'any[]': 'A',
};

const TYPES_BY_CHAR = Object.fromEntries(
    Object.entries(TYPE_CHARS).map(([type, char]) => [char, type]),
) as Record<string, MessageType>;

/**
 * <type char><text>. Integers and floats are decimal (floats may be `inf`, `-inf` or `nan`),
 * booleans are 0 / 1, strings are the hex of their bytes, arrays are comma-separated
 * (boolean[] is a run of 0 / 1 digits; any[] is a list of values with their type chars,
 * which never contain a comma), and null has no text.
 */
export function formatHostValue(message: MessageValue): string {
    const char = TYPE_CHARS[message.type];
    switch (message.type) {
        case 'integer':
            return `${char}${message.value}`;
        case 'float':
            return `${char}${formatFloat(message.value)}`;
        case 'boolean':
            return `${char}${message.value ? 1 : 0}`;
        case 'null':
            return char;
        case 'string':
            return `${char}${message.value.toString('hex')}`;
        case 'integer[]':
            return `${char}${message.value.join(',')}`;
        case 'float[]':
            return `${char}${message.value.map(formatFloat).join(',')}`;
        case 'boolean[]':
            return `${char}${message.value.map((v) => (v ? 1 : 0)).join('')}`;
        case 'any[]':
            return `${char}${message.value.map(formatHostValue).join(',')}`;
    }
}

function formatFloat(value: number): string {
    if (Number.isNaN(value)) return 'nan';
    if (value === Infinity) return 'inf';
    if (value === -Infinity) return '-inf';
    if (Object.is(value, -0)) return '-0';
    // Enough digits to give back the same float32 (the C side parses it with strtof).
    return String(value);
}

/** Reads a value written by {@link formatHostValue} or by the shell. */
export function parseHostValue(text: string): MessageValue {
    const type = TYPES_BY_CHAR[text[0]];
    const body = text.substring(1);
    const fail = () => new Error(`Failed to parse message. Invalid value: ${text}`);
    switch (type) {
        case 'integer':
            return { type, value: parseInteger(body, fail) };
        case 'float':
            return { type, value: parseFloat32(body, fail) };
        case 'boolean':
            if (body !== '0' && body !== '1') throw fail();
            return { type, value: body === '1' };
        case 'null':
            if (body !== '') throw fail();
            return { type };
        case 'string':
            if (!/^([0-9a-fA-F]{2})*$/.test(body)) throw fail();
            return { type, value: Buffer.from(body, 'hex') };
        case 'integer[]':
            return { type, value: splitList(body).map((v) => parseInteger(v, fail)) };
        case 'float[]':
            return { type, value: splitList(body).map((v) => parseFloat32(v, fail)) };
        case 'boolean[]':
            if (!/^[01]*$/.test(body)) throw fail();
            return { type, value: [...body].map((v) => v === '1') };
        case 'any[]':
            return {
                type,
                value: splitList(body).map((v) => {
                    const element = parseHostValue(v);
                    if (!isArrayElement(element)) throw fail();
                    return element;
                }),
            };
        default:
            throw new Error(`Failed to parse message. Unknown value type: ${text}`);
    }
}

function splitList(body: string): string[] {
    return body === '' ? [] : body.split(',');
}

function parseInteger(text: string, fail: () => Error): number {
    const value = /^-?\d+$/.test(text) ? Number(text) : NaN;
    if (!isInt32(value)) throw fail();
    return value;
}

function parseFloat32(text: string, fail: () => Error): number {
    const lower = text.toLowerCase();
    if (lower === 'nan' || lower === '-nan') return NaN;
    if (lower === 'inf' || lower === 'infinity') return Infinity;
    if (lower === '-inf' || lower === '-infinity') return -Infinity;
    const value = text.trim() === '' ? NaN : Number(text);
    if (Number.isNaN(value)) throw fail();
    return Math.fround(value);
}

/** The payload size of a reply carrying `message`, to check it against {@link HOST_MAX_PAYLOAD_SIZE}. */
export function hostValueSize(message: MessageValue): number {
    return formatHostValue(message).length;
}

/** Answers a Send, Broadcast or Receive request from the process. */
export function hostReplyBuilder(message: MessageValue) {
    return hostProtocolBuilder(HostProtocol.Reply, formatHostValue(message));
}

/** Makes a pending Send or Receive request in the process throw `reason`. */
export function hostReplyErrorBuilder(reason: string) {
    // The process reads one line per command.
    const oneLine = reason.replace(/[\r\n]+/g, ' ');
    return hostProtocolBuilder(HostProtocol.ReplyError, oneLine.substring(0, REPLY_ERROR_MAX_LENGTH));
}


type HostProtocolPayloads = {
    [HostProtocol.None]: {};
    [HostProtocol.Load]: {};
    [HostProtocol.Call]: {};
    [HostProtocol.Log]: { log: string };
    [HostProtocol.Error]: { error: string };
    [HostProtocol.Exectime]: { time: number };
    [HostProtocol.Loadtime]: { time: number };
    [HostProtocol.Send]: { dst: string; tag: string; message: MessageValue };
    [HostProtocol.Receive]: { src: string; tag: string; expected: MessageType };
    [HostProtocol.Reply]: {};
    [HostProtocol.ReplyError]: {};
    [HostProtocol.Broadcast]: { tag: string; message: MessageValue };
    [HostProtocol.Max]: {};
}

export type HostParseResult<T extends HostProtocol = HostProtocol> = {
    [K in T]: { protocol: K } & HostProtocolPayloads[K]
}[T];

type HostParserFunction<K extends HostProtocol> = (payload: string) => HostProtocolPayloads[K];

export class HostProtocolParser {
    private readonly parsers: {[K in HostProtocol]?: HostParserFunction<K>};

    constructor() {
        this.parsers = {
            [HostProtocol.Log]: HostProtocolParser.parseLog,
            [HostProtocol.Error]: HostProtocolParser.parseError,
            [HostProtocol.Exectime]: HostProtocolParser.parseExectime,
            [HostProtocol.Loadtime]: HostProtocolParser.parseLoadtime,
            [HostProtocol.Send]: HostProtocolParser.parseSend,
            [HostProtocol.Receive]: HostProtocolParser.parseReceive,
            [HostProtocol.Broadcast]: HostProtocolParser.parseBroadcast,
        }
    }

    /**
     * `line` is the shell's output decoded as latin1, one char per byte, since
     * the payload length counts bytes. Text in the payloads is decoded as UTF-8
     * once it has been cut out.
     */
    public parse(line: string): {parsed: HostParseResult[], remain: string} {
        // The format is [xx yyyy zz...]
        // xx is protocol, yyyy is payload length, zz... is payload 
        const headerLength = 8;
        const parsed: HostParseResult[] = [];
        let remain: string = line;
        while (remain.length >= headerLength) {
            try {
                const protocol = Number(remain.substring(0, 2));
                const payloadLength = Number(remain.substring(3, 7));
                if (remain.length < headerLength + payloadLength) {
                    return { parsed, remain };
                }
                const payload = remain.substring(headerLength, headerLength + payloadLength);
                remain = remain.substring(headerLength + payloadLength);
                parsed.push(this.parsePayload(protocol, payload));
            } catch (error) {
                throw new Error("Failed to parse message.", { cause: error });
            }
            
        }
        return { parsed, remain };
    }

    private parsePayload(protocol: number, payload: string): HostParseResult {
        if (!this.isParseableProtocol(protocol)) {
            throw new Error(`Failed to parse buffer. The protocol ${protocol} is not parsable.`);
        }
        const parser = this.parsers[protocol]!;
        const parsedPayload = parser(payload);
        return {protocol, ...parsedPayload} as HostParseResult;
    }

    private isParseableProtocol(value: number): value is keyof typeof this.parsers {
        return value in this.parsers;
    }

    static parseLog(payload: string): { log: string } {
        return { log: decodeBytes(payload) };
    }

    static parseError(payload: string): { error: string } {
        return { error: decodeBytes(payload) };
    }

    static parseExectime(payload: string): { time: number } {
        return { time: Number(payload) };
    }

    static parseLoadtime(payload: string): { time: number } {
        return { time: Number(payload) };
    }

    // <dstLen(3)><dst><tagLen(3)><tag><value>
    static parseSend(payload: string): { dst: string; tag: string; message: MessageValue } {
        const reader = new HostMessageReader(payload);
        const dst = reader.readName();
        const tag = reader.readName();
        const message = reader.readValue();
        return { dst, tag, message };
    }

    // <tagLen(3)><tag><value>
    static parseBroadcast(payload: string): { tag: string; message: MessageValue } {
        const reader = new HostMessageReader(payload);
        const tag = reader.readName();
        const message = reader.readValue();
        return { tag, message };
    }

    // <srcLen(3)><src><tagLen(3)><tag><type char>, where the type is the one the program expects.
    static parseReceive(payload: string): { src: string; tag: string; expected: MessageType } {
        const reader = new HostMessageReader(payload);
        const src = reader.readName();
        const tag = reader.readName();
        const expected = reader.readValueType();
        return { src, tag, expected };
    }
}

/** Decodes a latin1 string (one char per byte) as UTF-8. */
function decodeBytes(bytes: string): string {
    return Buffer.from(bytes, 'latin1').toString('utf8');
}

class HostMessageReader {
    private offset = 0;

    constructor(private payload: string) {}

    readName(): string {
        const length = Number(this.payload.substring(this.offset, this.offset + NAME_LENGTH_DIGITS));
        this.offset += NAME_LENGTH_DIGITS;
        const end = this.offset + length;
        if (Number.isNaN(length) || end > this.payload.length) {
            throw new Error(`Failed to parse message: ${this.payload}`);
        }
        const name = decodeBytes(this.payload.substring(this.offset, end));
        this.offset = end;
        return name;
    }

    readValueType(): MessageType {
        const rest = this.payload.substring(this.offset);
        const type = TYPES_BY_CHAR[rest];
        if (rest.length !== 1 || type === undefined) {
            throw new Error(`Failed to parse message. Unknown value type: ${this.payload}`);
        }
        return type;
    }

    readValue(): MessageValue {
        return parseHostValue(this.payload.substring(this.offset));
    }
}
