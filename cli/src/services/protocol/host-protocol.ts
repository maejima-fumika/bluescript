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
    Max
}

export const HOST_MAX_PAYLOAD_SIZE = 256;

export function hostProtocolBuilder(protocol: HostProtocol, payload: string) {
    if (payload.length > HOST_MAX_PAYLOAD_SIZE) {
        throw new Error(
            `Host protocol payload exceeds ${HOST_MAX_PAYLOAD_SIZE} bytes ` +
            `(got ${payload.length}): ${payload}`,
        );
    }
    const protocolStr = String(protocol).padStart(2, '0');
    const payloadLen = String(payload.length).padStart(4, '0');
    return `${protocolStr} ${payloadLen} ${payload}\n`;
}

const NAME_LENGTH_DIGITS = 3;
// The shell reads a whole command into a fixed-size line buffer (see comm.h), so keep it short.
const REPLY_ERROR_MAX_LENGTH = 200;
const INTEGER_VALUE_TYPE = 'i';

/** Answers a Send or Receive request from the process. */
export function hostReplyBuilder(value: number) {
    return hostProtocolBuilder(HostProtocol.Reply, `${INTEGER_VALUE_TYPE}${value}`);
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
    [HostProtocol.Send]: { dst: string; tag: string; value: number };
    [HostProtocol.Receive]: { src: string; tag: string };
    [HostProtocol.Reply]: {};
    [HostProtocol.ReplyError]: {};
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
        }
    }

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
        return { log: payload };
    }

    static parseError(payload: string): { error: string } {
        return { error: payload };
    }

    static parseExectime(payload: string): { time: number } {
        return { time: Number(payload) };
    }

    static parseLoadtime(payload: string): { time: number } {
        return { time: Number(payload) };
    }

    // <dstLen(3)><dst><tagLen(3)><tag>i<value>
    static parseSend(payload: string): { dst: string; tag: string; value: number } {
        const reader = new HostMessageReader(payload);
        const dst = reader.readName();
        const tag = reader.readName();
        const value = reader.readValue();
        return { dst, tag, value };
    }

    // <srcLen(3)><src><tagLen(3)><tag>i
    static parseReceive(payload: string): { src: string; tag: string } {
        const reader = new HostMessageReader(payload);
        const src = reader.readName();
        const tag = reader.readName();
        reader.readValueType();
        return { src, tag };
    }
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
        const name = this.payload.substring(this.offset, end);
        this.offset = end;
        return name;
    }

    readValueType(): void {
        const type = this.payload[this.offset];
        this.offset += 1;
        if (type !== INTEGER_VALUE_TYPE) {
            throw new Error(`Failed to parse message. Unknown value type: ${this.payload}`);
        }
    }

    readValue(): number {
        this.readValueType();
        const value = Number(this.payload.substring(this.offset));
        if (!Number.isInteger(value)) {
            throw new Error(`Failed to parse message. Invalid value: ${this.payload}`);
        }
        return value;
    }
}
