import {
    answerReceive,
    answerSend,
    MessageRouter,
    MessagingError,
    NO_WORKSPACE_PORT,
} from '../../src/platforms/messaging';


describe('MessageRouter', () => {
    test('delivers queued messages in the order they were sent', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a');
        const b = router.portFor('b');
        a.send('b', 't', 1);
        a.send('b', 't', 2);
        await expect(b.receive('a', 't')).resolves.toBe(1);
        await expect(b.receive('a', 't')).resolves.toBe(2);
    });

    test('keeps tags and senders apart', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        router.portFor('a').send('c', 'x', 1);
        router.portFor('b').send('c', 'x', 2);
        router.portFor('a').send('c', 'y', 3);
        const c = router.portFor('c');
        await expect(c.receive('b', 'x')).resolves.toBe(2);
        await expect(c.receive('a', 'y')).resolves.toBe(3);
        await expect(c.receive('a', 'x')).resolves.toBe(1);
    });

    test('answers a waiting receive when the message arrives', async () => {
        const router = new MessageRouter(['a', 'b']);
        const received = router.portFor('b').receive('a', 't');
        router.portFor('a').send('b', 't', 7);
        await expect(received).resolves.toBe(7);
    });

    test('does not answer a waiting receive with another tag', async () => {
        const router = new MessageRouter(['a', 'b']);
        const onValue = jest.fn();
        router.portFor('b').receive('a', 't').then(onValue);
        router.portFor('a').send('b', 'other', 7);
        await Promise.resolve();
        expect(onValue).not.toHaveBeenCalled();
    });

    test('rejects sending to oneself', () => {
        const router = new MessageRouter(['a', 'b']);
        expect(() => router.portFor('a').send('a', 't', 5)).toThrow(/cannot send a message to itself/);
    });

    test('rejects receiving from oneself', async () => {
        const router = new MessageRouter(['a', 'b']);
        await expect(router.portFor('a').receive('a', 't')).rejects.toThrow(/cannot receive a message from itself/);
    });

    test('rejects unknown projects', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a');
        expect(() => a.send('missing', 't', 1)).toThrow(MessagingError);
        await expect(a.receive('missing', 't')).rejects.toThrow(/no such project/);
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

        expect(await shortOf(() => a.send('a', 't', 1))).toBe('send to self');
        expect(await shortOf(() => a.receive('a', 't'))).toBe('receive from self');
        expect(await shortOf(() => a.send('missing', 't', 1))).toBe('no project missing');
        expect(await shortOf(() => a.receive('missing', 't'))).toBe('no project missing');
        router.close('c');
        expect(await shortOf(() => a.send('c', 't', 1))).toBe('c finished');
        expect(await shortOf(() => a.receive('c', 't'))).toBe('c finished');
        const waiting = a.receive('b', 't');
        expect(await shortOf(() => a.receive('b', 'u'))).toBe('already waiting');
        expect(await shortOf(() => router.portFor('b').receive('a', 't'))).toBe('deadlock');
        expect(await shortOf(() => waiting)).toBe('deadlock');
        expect(await shortOf(() => NO_WORKSPACE_PORT.send('a', 't', 1))).toBe('not in workspace');
    });

    test('rejects sending to a finished project', () => {
        const router = new MessageRouter(['a', 'b']);
        router.close('b');
        expect(() => router.portFor('a').send('b', 't', 1)).toThrow(/already finished/);
    });

    test('still delivers messages from a finished sender', async () => {
        const router = new MessageRouter(['a', 'b']);
        router.portFor('a').send('b', 't', 1);
        router.close('a');
        const b = router.portFor('b');
        await expect(b.receive('a', 't')).resolves.toBe(1);
        await expect(b.receive('a', 't')).rejects.toThrow(/has finished/);
    });

    test('rejects a waiting receive when the sender finishes', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const received = router.portFor('b').receive('a', 't');
        router.close('a');
        await expect(received).rejects.toThrow(/a has finished/);
    });

    test('reports a deadlock when every running project waits', async () => {
        const router = new MessageRouter(['a', 'b']);
        const a = router.portFor('a').receive('b', 't');
        const b = router.portFor('b').receive('a', 't');
        await expect(a).rejects.toThrow(/Deadlock/);
        await expect(b).rejects.toThrow(/Deadlock/);
    });

    test('reports a deadlock when the last other project finishes', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const a = router.portFor('a').receive('b', 't');
        const b = router.portFor('b').receive('a', 't');
        router.close('c');
        await expect(a).rejects.toThrow(/Deadlock/);
        await expect(b).rejects.toThrow(/Deadlock/);
    });

    test('drops the receive of a project that stops while waiting', async () => {
        const router = new MessageRouter(['a', 'b', 'c']);
        const onSettled = jest.fn();
        router.portFor('a').receive('b', 't').then(onSettled, onSettled);
        router.close('a');
        // b and c are still running, so this is not a deadlock either.
        router.portFor('b').receive('c', 't').then(onSettled, onSettled);
        await Promise.resolve();
        expect(onSettled).not.toHaveBeenCalled();
    });
});

describe('NO_WORKSPACE_PORT', () => {
    test('rejects every request', async () => {
        expect(() => NO_WORKSPACE_PORT.send('a', 't', 1)).toThrow(/workspace run/);
        await expect(NO_WORKSPACE_PORT.receive('a', 't')).rejects.toThrow(/workspace run/);
    });
});

describe('answerSend / answerReceive', () => {
    const replier = () => ({
        reply: jest.fn(() => Promise.resolve()),
        replyError: jest.fn((_error: MessagingError) => Promise.resolve()),
    });

    test('acknowledges a send and replies the received value', async () => {
        const router = new MessageRouter(['a', 'b']);
        const r = replier();
        await answerSend(router.portFor('a'), r, 'b', 't', 3);
        expect(r.reply).toHaveBeenCalledWith(0);
        await answerReceive(router.portFor('b'), r, 'a', 't');
        expect(r.reply).toHaveBeenLastCalledWith(3);
        expect(r.replyError).not.toHaveBeenCalled();
    });

    test('replies errors', async () => {
        const r = replier();
        await answerSend(NO_WORKSPACE_PORT, r, 'b', 't', 3);
        await answerReceive(NO_WORKSPACE_PORT, r, 'b', 't');
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
            receive: () => Promise.reject(new Error('boom')),
        };
        await answerSend(port, r, 'b', 't', 3);
        await answerReceive(port, r, 'b', 't');
        for (const [error] of r.replyError.mock.calls) {
            expect(error).toMatchObject({ message: 'boom', shortMessage: 'internal error' });
        }
    });
});
