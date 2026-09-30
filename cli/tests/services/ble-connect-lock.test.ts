jest.mock('../../src/services/ble/transport', () => ({
    ...jest.requireActual('../../src/services/ble/transport'),
    createBleTransport: jest.fn(),
}));

import { BleConnection } from '../../src/services/ble';
import { createBleTransport } from '../../src/services/ble/transport';
import { EventEmitter } from '../../src/services/common';

const mockedCreateBleTransport = createBleTransport as jest.Mock;

class FakeTransport extends EventEmitter<any> {
    scannedDeviceNames: string[] = [];
    connect = jest.fn<Promise<void>, [string]>();
    abortConnect = jest.fn(async () => {});
    disconnect = jest.fn(async () => {});
    write = jest.fn(async () => {});
    isReady = () => true;
}

function setupTransports(count: number): FakeTransport[] {
    const transports = Array.from({ length: count }, () => new FakeTransport());
    for (const transport of transports) {
        mockedCreateBleTransport.mockReturnValueOnce(transport);
    }
    return transports;
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((res) => {
        resolve = res;
    });
    return { promise, resolve };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('BleConnection connect lock', () => {
    beforeEach(() => {
        mockedCreateBleTransport.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('connects one device at a time', async () => {
        const [transportA, transportB] = setupTransports(2);
        const connectA = deferred();
        const connectB = deferred();
        transportA.connect.mockReturnValue(connectA.promise);
        transportB.connect.mockReturnValue(connectB.promise);

        const pendingA = new BleConnection('A').connect();
        const pendingB = new BleConnection('B').connect();
        await flushPromises();

        expect(transportA.connect).toHaveBeenCalledWith('A');
        expect(transportB.connect).not.toHaveBeenCalled();

        connectA.resolve();
        await pendingA;
        await flushPromises();
        expect(transportB.connect).toHaveBeenCalledWith('B');

        connectB.resolve();
        await expect(pendingB).resolves.toBeUndefined();
    });

    it('starts the timeout only after the previous attempt finishes', async () => {
        jest.useFakeTimers();
        const [transportA, transportB] = setupTransports(2);
        const takes4Seconds = () => new Promise<void>((resolve) => setTimeout(resolve, 4000));
        transportA.connect.mockImplementation(takes4Seconds);
        transportB.connect.mockImplementation(takes4Seconds);

        // B waits 4 s for A, then needs 4 s itself: 8 s in total, but each attempt fits in 5 s.
        const pendingA = new BleConnection('A').connect(5000);
        const pendingB = new BleConnection('B').connect(5000);

        await jest.advanceTimersByTimeAsync(4000);
        await expect(pendingA).resolves.toBeUndefined();
        await jest.advanceTimersByTimeAsync(4000);
        await expect(pendingB).resolves.toBeUndefined();
    });

    it('lets the next device connect after a failed attempt', async () => {
        const [transportA, transportB] = setupTransports(2);
        transportA.connect.mockRejectedValue(new Error('scan failed'));
        transportB.connect.mockResolvedValue(undefined);

        const pendingA = new BleConnection('A').connect();
        const pendingB = new BleConnection('B').connect();

        await expect(pendingA).rejects.toThrow('scan failed');
        expect(transportA.abortConnect).toHaveBeenCalled();
        await expect(pendingB).resolves.toBeUndefined();
    });
});
