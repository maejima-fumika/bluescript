import { AsyncLock, settleAll, withTimeout } from '../../src/core/async';

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('AsyncLock', () => {
    it('runs tasks one at a time in request order', async () => {
        const lock = new AsyncLock();
        const events: string[] = [];
        const first = deferred();

        const a = lock.runExclusive(async () => {
            events.push('a:start');
            await first.promise;
            events.push('a:end');
            return 'a';
        });
        const b = lock.runExclusive(async () => {
            events.push('b:start');
            return 'b';
        });

        await flushPromises();
        expect(events).toEqual(['a:start']);

        first.resolve();
        await expect(a).resolves.toBe('a');
        await expect(b).resolves.toBe('b');
        expect(events).toEqual(['a:start', 'a:end', 'b:start']);
    });

    it('keeps running queued tasks after a task fails', async () => {
        const lock = new AsyncLock();

        const a = lock.runExclusive(async () => {
            throw new Error('boom');
        });
        const b = lock.runExclusive(async () => 'b');

        await expect(a).rejects.toThrow('boom');
        await expect(b).resolves.toBe('b');
    });
});

describe('settleAll', () => {
    it('returns results in input order, including failures', async () => {
        const results = await settleAll([3, 1, 2], async (n) => {
            await new Promise((resolve) => setTimeout(resolve, n * 5));
            if (n === 1) {
                throw new Error('one');
            }
            return n * 10;
        });

        expect(results[0]).toEqual({ status: 'fulfilled', value: 30 });
        expect(results[1].status).toBe('rejected');
        expect((results[1] as PromiseRejectedResult).reason.message).toBe('one');
        expect(results[2]).toEqual({ status: 'fulfilled', value: 20 });
    });

    it('runs at most `concurrency` tasks at once', async () => {
        let running = 0;
        let maxRunning = 0;

        await settleAll([1, 2, 3, 4, 5], async () => {
            running++;
            maxRunning = Math.max(maxRunning, running);
            await new Promise((resolve) => setTimeout(resolve, 5));
            running--;
        }, 2);

        expect(maxRunning).toBe(2);
    });

    it('returns an empty array for no items', async () => {
        await expect(settleAll([], async () => 1)).resolves.toEqual([]);
    });
});

describe('withTimeout', () => {
    it('resolves when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
    });

    it('rejects with the given message when the promise takes too long', async () => {
        await expect(withTimeout(new Promise(() => {}), 10, 'too slow')).rejects.toThrow('too slow');
    });
});
