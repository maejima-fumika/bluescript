jest.mock('../../src/services/ble/transport', () => ({
    createBleTransport: jest.fn(),
}));

import { DeviceService } from '../../src/services/ble';
import { HostService } from '../../src/services/process';
import { MessageValue } from '../../src/services/protocol/message-value';

const integers = (n: number): MessageValue => ({ type: 'integer[]', value: new Array(n).fill(1) });
const text = (n: number): MessageValue => ({ type: 'string', value: Buffer.alloc(n, 0x61) });

describe('the size of a message a board can receive', () => {
    // canReceive only looks at the message, so no connection is needed.
    const device = (message: MessageValue) => DeviceService.prototype.canReceive.call({}, message);
    const host = (message: MessageValue) => HostService.prototype.canReceive.call({}, message);

    test('ESP32 takes a reply that fits in one BLE write', () => {
        // cmd(1) + type(1) + count(2) + 4 * n <= 495 - 2
        expect(device(integers(122))).toBe(true);
        expect(device(integers(123))).toBe(false);
        expect(device(text(489))).toBe(true);
        expect(device(text(490))).toBe(false);
        expect(device({ type: 'null' })).toBe(true);
    });

    test('ESP32 rejects more elements than the count field holds', () => {
        expect(device({ type: 'boolean[]', value: new Array(70000).fill(true) })).toBe(false);
    });

    test('host takes a reply that fits in the shell line buffer', () => {
        // "s" + two hex digits per byte <= 4096
        expect(host(text(2047))).toBe(true);
        expect(host(text(2048))).toBe(false);
    });
});
