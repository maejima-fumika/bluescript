import {
    answerBroadcast,
    answerReceive,
    answerSend,
    MessageRouter,
    MessagingError,
    NO_WORKSPACE_PORT,
    MessageValue,
} from '../../src/platforms/messaging';
import { NULL_MESSAGE } from '../../src/services/protocol/message-value';

const int = (value: number): MessageValue => ({ type: 'integer', value });


describe('MessageRouter', () => {
    test('delivers queued messages in the order they were sent', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a');
        const b = router.portFor('b');
        a.send('b', 't', int(1));
        a.send('b', 't', int(2));
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(1));
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(2));
    });

    test('keeps tags and senders apart', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        router.portFor('a').send('c', 'x', int(1));
        router.portFor('b').send('c', 'x', int(2));
        router.portFor('a').send('c', 'y', int(3));
        const c = router.portFor('c');
        await expect(c.receive('b', 'x', 'integer')).resolves.toEqual(int(2));
        await expect(c.receive('a', 'y', 'integer')).resolves.toEqual(int(3));
        await expect(c.receive('a', 'x', 'integer')).resolves.toEqual(int(1));
    });

    test('answers a waiting receive when the message arrives', async () => {
        const router = new MessageRouter(['a', 'b']);
        const received = router.portFor('b').receive('a', 't', 'integer');
        router.portFor('a').send('b', 't', int(7));
        await expect(received).resolves.toEqual(int(7));
    });

    test('does not answer a waiting receive with another tag', async () => {
        const router = new MessageRouter(['a', 'b']);
        const onValue = jest.fn();
        router.portFor('b').receive('a', 't', 'integer').then(onValue);
        router.portFor('a').send('b', 'other', int(7));
        await Promise.resolve();
        expect(onValue).not.toHaveBeenCalled();
    });

    test('rejects sending to oneself', () => {
        const router = new MessageRouter(['a', 'b']);
        expect(() => router.portFor('a').send('a', 't', int(5))).toThrow(/cannot send a message to itself/);
    });

    test('rejects receiving from oneself', async () => {
        const router = new MessageRouter(['a', 'b']);
        await expect(router.portFor('a').receive('a', 't', 'integer')).rejects.toThrow(/cannot receive a message from itself/);
    });

    test('broadcasts to every other running project', async () => {
        const router = new MessageRouter(['a', 'b', 'c', 'd']);
        router.close('d');
        const b = router.portFor('b');
        const waiting = b.receive('a', 't', 'integer');
        router.portFor('a').broadcast('t', int(4));
        await expect(waiting).resolves.toEqual(int(4));
        await expect(router.portFor('c').receive('a', 't', 'integer')).resolves.toEqual(int(4));
        // Not delivered to the sender itself.
        await expect(router.portFor('a').receive('a', 't', 'integer')).rejects.toThrow(/itself/);
    });

    test('keeps broadcasts and sends in order for each receiver', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const a = router.portFor('a');
        a.send('b', 't', int(1));
        a.broadcast('t', int(2));
        a.send('b', 't', int(3));
        const b = router.portFor('b');
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(1));
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(2));
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(3));
    });

    test('does nothing when nobody else is running', () => {
        const router = new MessageRouter(['a', 'b']);
        router.close('b');
        expect(() => router.portFor('a').broadcast('t', int(1))).not.toThrow();
        expect(() => new MessageRouter(['solo']).portFor('solo').broadcast('t', int(1))).not.toThrow();
    });

    test('rejects unknown projects', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a');
        expect(() => a.send('missing', 't', int(1))).toThrow(MessagingError);
        await expect(a.receive('missing', 't', 'integer')).rejects.toThrow(/no such project/);
        expect(() => router.portFor('missing')).toThrow();
    });

    test('gives every error a short text for boards with little memory', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const a = router.portFor('a');
        const shortOf = async (request: () => unknown) => {
            try {
                await request();
            } catch (error) {
                expect(error).toBeInstanceOf(MessagingError);
                return (error as MessagingError).shortMessage;
            }
            throw new Error('expected an error');
        };

        expect(await shortOf(() => a.send('a', 't', int(1)))).toBe('send to self');
        expect(await shortOf(() => a.receive('a', 't', 'integer'))).toBe('receive from self');
        expect(await shortOf(() => a.send('missing', 't', int(1)))).toBe('no project missing');
        expect(await shortOf(() => a.receive('missing', 't', 'integer'))).toBe('no project missing');
        router.close('c');
        expect(await shortOf(() => a.send('c', 't', int(1)))).toBe('c finished');
        expect(await shortOf(() => a.receive('c', 't', 'integer'))).toBe('c finished');
        const waiting = a.receive('b', 't', 'integer');
        expect(await shortOf(() => a.receive('b', 'u', 'integer'))).toBe('already waiting');
        expect(await shortOf(() => router.portFor('b').receive('a', 't', 'integer'))).toBe('deadlock');
        expect(await shortOf(() => waiting)).toBe('deadlock');
        expect(await shortOf(() => NO_WORKSPACE_PORT.send('a', 't', int(1)))).toBe('not in workspace');
        expect(await shortOf(() => NO_WORKSPACE_PORT.broadcast('t', int(1)))).toBe('not in workspace');
    });

    test('rejects sending to a finished project', () => {
        const router = new MessageRouter(['a', 'b']);
        router.close('b');
        expect(() => router.portFor('a').send('b', 't', int(1))).toThrow(/already finished/);
    });

    test('still delivers messages from a finished sender', async () => {
        const router = new MessageRouter(['a', 'b']);
        router.portFor('a').send('b', 't', int(1));
        router.close('a');
        const b = router.portFor('b');
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(1));
        await expect(b.receive('a', 't', 'integer')).rejects.toThrow(/has finished/);
    });

    test('rejects a waiting receive when the sender finishes', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const received = router.portFor('b').receive('a', 't', 'integer');
        router.close('a');
        await expect(received).rejects.toThrow(/a has finished/);
    });

    test('reports a deadlock when every running project waits', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a').receive('b', 't', 'integer');
        const b = router.portFor('b').receive('a', 't', 'integer');
        await expect(a).rejects.toThrow(/Deadlock/);
        await expect(b).rejects.toThrow(/Deadlock/);
    });

    test('reports a deadlock when the last other project finishes', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const a = router.portFor('a').receive('b', 't', 'integer');
        const b = router.portFor('b').receive('a', 't', 'integer');
        router.close('c');
        await expect(a).rejects.toThrow(/Deadlock/);
        await expect(b).rejects.toThrow(/Deadlock/);
    });

    test('drops the receive of a project that stops while waiting', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const onSettled = jest.fn();
        router.portFor('a').receive('b', 't', 'integer').then(onSettled, onSettled);
        router.close('a');
        // b and c are still running, so this is not a deadlock either.
        router.portFor('b').receive('c', 't', 'integer').then(onSettled, onSettled);
        await Promise.resolve();
        expect(onSettled).not.toHaveBeenCalled();
    });
});

describe('MessageRouter with typed values', () => {
    const values: MessageValue[] = [
        { type: 'integer', value: -1 },
        { type: 'float', value: 1.5 },
        { type: 'boolean', value: true },
        { type: 'string', value: Buffer.from('héllo') },
        { type: 'null' },
        { type: 'integer[]', value: [1, 2] },
        { type: 'float[]', value: [] },
        { type: 'boolean[]', value: [true, false] },
    ];

    test('delivers every type in order through one queue', async () => {
        const router = new MessageRouter(['a', 'b']);
        values.forEach((v) => router.portFor('a').send('b', 't', v));
        const b = router.portFor('b');
        for (const v of values) {
            await expect(b.receive('a', 't', v.type)).resolves.toEqual(v);
        }
    });

    test('rejects a queued message of another type and drops it', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a');
        a.send('b', 't', { type: 'float', value: 2.5 });
        a.send('b', 't', int(3));
        const b = router.portFor('b');
        await expect(b.receive('a', 't', 'integer')).rejects.toThrow(
            'Type mismatch: a sent a float with tag "t", but b expected an integer.',
        );
        await expect(b.receive('a', 't', 'integer')).resolves.toEqual(int(3));
    });

    test('rejects a waiting receive when a message of another type arrives', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const waiting = router.portFor('b').receive('a', 't', 'string');
        router.portFor('a').send('b', 't', { type: 'boolean[]', value: [true] });
        await expect(waiting).rejects.toMatchObject({ shortMessage: 'type mismatch' });
        // The message was dropped, so the next receive waits for a new one.
        const next = router.portFor('b').receive('a', 't', 'string');
        router.portFor('a').send('b', 't', { type: 'string', value: Buffer.from('ok') });
        await expect(next).resolves.toEqual({ type: 'string', value: Buffer.from('ok') });
    });

    test('rejects a send the receiver cannot take', async () => {
        const router = new MessageRouter(['a', 'b'], (_dst, v) => v.type !== 'integer[]');
        expect(() => router.portFor('a').send('b', 't', { type: 'integer[]', value: [1] }))
            .toThrow(/too large for b/);
        // Nothing was queued.
        router.portFor('a').send('b', 't', int(1));
        await expect(router.portFor('b').receive('a', 't', 'integer')).resolves.toEqual(int(1));
    });

    test('rejects a broadcast as a whole when one receiver cannot take it', async () => {
        const router = new MessageRouter(['a', 'b', 'c'], (dst) => dst !== 'c');
        let error: unknown;
        try {
            router.portFor('a').broadcast('t', int(1));
        } catch (e) {
            error = e;
        }
        expect(error).toMatchObject({ shortMessage: 'value too large' });
        // Not even b received it.
        router.portFor('a').send('b', 't', int(2));
        await expect(router.portFor('b').receive('a', 't', 'integer')).resolves.toEqual(int(2));
    });
});

describe('NO_WORKSPACE_PORT', () => {
    test('rejects every request', async () => {
        expect(() => NO_WORKSPACE_PORT.send('a', 't', int(1))).toThrow(/workspace run/);
        await expect(NO_WORKSPACE_PORT.receive('a', 't', 'integer')).rejects.toThrow(/workspace run/);
    });
});

describe('answerSend / answerReceive', () => {
    const replier = () => ({
        reply: jest.fn((_message: MessageValue) => Promise.resolve()),
        replyError: jest.fn((_error: MessagingError) => Promise.resolve()),
    });

    test('acknowledges a send and replies the received value', async () => {
        const router = new MessageRouter(['a', 'b']);
        const r = replier();
        await answerSend(router.portFor('a'), r, 'b', 't', int(3));
        expect(r.reply).toHaveBeenCalledWith(NULL_MESSAGE);
        await answerReceive(router.portFor('b'), r, 'a', 't', 'integer');
        expect(r.reply).toHaveBeenLastCalledWith(int(3));
        expect(r.replyError).not.toHaveBeenCalled();
    });

    test('acknowledges a broadcast', async () => {
        const router = new MessageRouter(['a', 'b']);
        const r = replier();
        await answerBroadcast(router.portFor('a'), r, 't', int(3));
        expect(r.reply).toHaveBeenCalledWith(NULL_MESSAGE);
        await answerBroadcast(NO_WORKSPACE_PORT, r, 't', int(3));
        expect(r.replyError.mock.calls[0][0].shortMessage).toBe('not in workspace');
    });

    test('replies errors', async () => {
        const r = replier();
        await answerSend(NO_WORKSPACE_PORT, r, 'b', 't', int(3));
        await answerReceive(NO_WORKSPACE_PORT, r, 'b', 't', 'integer');
        expect(r.reply).not.toHaveBeenCalled();
        expect(r.replyError).toHaveBeenCalledTimes(2);
        const error = r.replyError.mock.calls[0][0];
        expect(error).toBeInstanceOf(MessagingError);
        expect(error.message).toMatch(/workspace run/);
        expect(error.shortMessage).toBe('not in workspace');
    });

    test('wraps unexpected errors', async () => {
        const r = replier();
        const port = {
            send: () => { throw new Error('boom'); },
            broadcast: () => { throw new Error('boom'); },
            receive: () => Promise.reject(new Error('boom')),
        };
        await answerSend(port, r, 'b', 't', int(3));
        await answerReceive(port, r, 'b', 't', 'integer');
        for (const [error] of r.replyError.mock.calls) {
            expect(error).toMatchObject({ message: 'boom', shortMessage: 'internal error' });
        }
    });
});
