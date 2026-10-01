import { Buffer } from "node:buffer";

/** The types a message between workspace projects can carry. */
export type MessageType =
    | 'integer' | 'float' | 'boolean' | 'string' | 'null'
    | 'integer[]' | 'float[]' | 'boolean[]' | 'any[]';

/** A value sent by `sendInteger`, `sendString`, `broadcastFloatArray`, ... */
export type MessageValue =
    | { type: 'integer'; value: number }
    | { type: 'float'; value: number }
    | { type: 'boolean'; value: boolean }
    // Raw bytes, so a string reaches the receiver exactly as the sender had it.
    | { type: 'string'; value: Buffer }
    | { type: 'null' }
    | { type: 'integer[]'; value: number[] }
    | { type: 'float[]'; value: number[] }
    | { type: 'boolean[]'; value: boolean[] }
    | { type: 'any[]'; value: ArrayElement[] };

/** What an `any[]` message can hold: no nested arrays or other objects. */
export type ArrayElement = Extract<MessageValue, { type: 'integer' | 'float' | 'boolean' | 'null' | 'string' }>;

export function isArrayElement(message: MessageValue): message is ArrayElement {
    return ['integer', 'float', 'boolean', 'null', 'string'].includes(message.type);
}

export const NULL_MESSAGE: MessageValue = { type: 'null' };

/** "an integer", "a float[]", "null", ... for error messages. */
export function describeMessageType(type: MessageType): string {
    if (type === 'null') {
        return 'null';
    }
    return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

export const INT32_MIN = -0x80000000;
export const INT32_MAX = 0x7fffffff;

export function isInt32(value: number): boolean {
    return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX;
}
