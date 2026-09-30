/**
 * Runs tasks one at a time in the order they were requested.
 * A failed task does not block the tasks queued after it.
 */
export class AsyncLock {
    private tail: Promise<void> = Promise.resolve();

    runExclusive<T>(task: () => Promise<T>): Promise<T> {
        const result = this.tail.then(task);
        this.tail = result.then(() => {}, () => {});
        return result;
    }
}

/**
 * Like `Promise.allSettled`, but runs at most `concurrency` tasks at once.
 * Results are returned in the same order as `items`.
 */
export async function settleAll<T, R>(
    items: readonly T[],
    task: (item: T) => Promise<R>,
    concurrency: number = Infinity,
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = { status: 'fulfilled', value: await task(items[index]) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    };
    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out.'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const handle = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (value) => {
                clearTimeout(handle);
                resolve(value);
            },
            (error) => {
                clearTimeout(handle);
                reject(error);
            },
        );
    });
}
