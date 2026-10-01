/**
 * Messages between the projects of a workspace. Programs never talk to each
 * other directly: `sendInteger` / `receiveString` / ... become requests to the
 * CLI, which keeps the messages and answers the requests.
 */

import {
    describeMessageType, MessageType, MessageValue, NULL_MESSAGE,
} from "../services/protocol/message-value";

export type { MessageType, MessageValue } from "../services/protocol/message-value";

export class MessagingError extends Error {
    /**
     * @param message detailed text, shown by boards with enough memory (host).
     * @param shortMessage a few words, for boards with little memory (ESP32).
     */
    constructor(message: string, readonly shortMessage: string) {
        super(message);
        this.name = 'MessagingError';
    }
}

/** What one running program sees of the messaging system. */
export interface MessagePort {
    /** Queues `message` for `dst`. Throws {@link MessagingError} when `dst` cannot receive it. */
    send(dst: string, tag: string, message: MessageValue): void;
    /** Queues `message` for every other project that is still running. */
    broadcast(tag: string, message: MessageValue): void;
    /**
     * Resolves with the next message `src` sent under `tag`, or rejects with
     * {@link MessagingError}, also when that message is not of the `expected` type.
     */
    receive(src: string, tag: string, expected: MessageType): Promise<MessageValue>;
}

const NOT_IN_WORKSPACE = 'Messages between projects are only available in `bscript workspace run`.';
const NOT_IN_WORKSPACE_SHORT = 'not in workspace';

/** Used when a project runs on its own, outside a workspace. */
export const NO_WORKSPACE_PORT: MessagePort = {
    send() {
        throw new MessagingError(NOT_IN_WORKSPACE, NOT_IN_WORKSPACE_SHORT);
    },
    broadcast() {
        throw new MessagingError(NOT_IN_WORKSPACE, NOT_IN_WORKSPACE_SHORT);
    },
    receive() {
        return Promise.reject(new MessagingError(NOT_IN_WORKSPACE, NOT_IN_WORKSPACE_SHORT));
    },
};

/** The board-side end of a port: answers the request the program is blocked on. */
export interface MessageReplier {
    reply(message: MessageValue): Promise<void>;
    /** Chooses which of the error's texts the board gets. */
    replyError(error: MessagingError): Promise<void>;
}

/** Answers a send request (`sendInteger`, `sendString`, ...) from a program. */
export function answerSend(
    port: MessagePort, replier: MessageReplier, dst: string, tag: string, message: MessageValue,
): Promise<void> {
    try {
        port.send(dst, tag, message);
    } catch (error) {
        return replier.replyError(toMessagingError(error));
    }
    return replier.reply(NULL_MESSAGE);
}

/** Answers a broadcast request (`broadcastInteger`, ...) from a program. */
export function answerBroadcast(
    port: MessagePort, replier: MessageReplier, tag: string, message: MessageValue,
): Promise<void> {
    try {
        port.broadcast(tag, message);
    } catch (error) {
        return replier.replyError(toMessagingError(error));
    }
    return replier.reply(NULL_MESSAGE);
}

/** Answers a receive request (`receiveInteger`, ...) from a program once the message is available. */
export function answerReceive(
    port: MessagePort, replier: MessageReplier, src: string, tag: string, expected: MessageType,
): Promise<void> {
    return port.receive(src, tag, expected).then(
        (message) => replier.reply(message),
        (error) => replier.replyError(toMessagingError(error)),
    );
}

function toMessagingError(error: unknown): MessagingError {
    if (error instanceof MessagingError) {
        return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new MessagingError(message, 'internal error');
}

type PendingReceive = {
    src: string;
    tag: string;
    expected: MessageType;
    resolve: (message: MessageValue) => void;
    reject: (error: MessagingError) => void;
};

/** Whether the board running `dst` can take `message` in one reply. */
export type CanReceive = (dst: string, message: MessageValue) => boolean;

/**
 * Routes messages between the projects of one `workspace run`.
 *
 * Messages are kept per (src, dst, tag) in the order they were sent, whatever
 * their type. A receive whose next message has another type fails, and that
 * message is dropped. A member is open until {@link close} is called for it; a
 * closed member can no longer receive messages, but the messages it sent before
 * closing can still be received.
 */
export class MessageRouter {
    private readonly open: Set<string>;
    private readonly mailboxes = new Map<string, MessageValue[]>();
    /** Each program blocks while receiving, so a member waits for at most one message. */
    private readonly pending = new Map<string, PendingReceive>();

    constructor(
        private readonly names: readonly string[],
        private readonly canReceive: CanReceive = () => true,
    ) {
        this.open = new Set(names);
    }

    portFor(name: string): MessagePort {
        if (!this.names.includes(name)) {
            throw new Error(`${name} is not a member of this workspace run.`);
        }
        return {
            send: (dst, tag, message) => this.send(name, dst, tag, message),
            broadcast: (tag, message) => this.broadcast(name, tag, message),
            receive: (src, tag, expected) => this.receive(name, src, tag, expected),
        };
    }

    /**
     * Marks `name` as finished. Receives that can no longer be satisfied are
     * rejected. A receive `name` itself is waiting on is dropped without an
     * answer, since its program is gone.
     */
    close(name: string) {
        if (!this.open.delete(name)) {
            return;
        }
        this.pending.delete(name);
        for (const [dst, request] of [...this.pending]) {
            if (request.src === name) {
                this.pending.delete(dst);
                request.reject(new MessagingError(
                    `${name} has finished without sending a message with tag "${request.tag}".`,
                    `${name} finished`,
                ));
            }
        }
        this.rejectIfDeadlocked();
    }

    private send(src: string, dst: string, tag: string, message: MessageValue) {
        if (dst === src) {
            throw new MessagingError(
                `Cannot send to ${dst}: a project cannot send a message to itself.`,
                'send to self',
            );
        }
        if (!this.names.includes(dst)) {
            throw new MessagingError(
                `Cannot send to ${dst}: no such project in this workspace run.`,
                `no project ${dst}`,
            );
        }
        if (!this.open.has(dst)) {
            throw new MessagingError(`Cannot send to ${dst}: it has already finished.`, `${dst} finished`);
        }
        this.checkSize(dst, message);
        this.deliver(src, dst, tag, message);
    }

    /**
     * Projects that have finished are skipped; with nobody to receive, nothing happens.
     * When any receiver cannot take the message, nobody gets it.
     */
    private broadcast(src: string, tag: string, message: MessageValue) {
        const receivers = [...this.open].filter((dst) => dst !== src);
        for (const dst of receivers) {
            this.checkSize(dst, message, 'Cannot broadcast');
        }
        for (const dst of receivers) {
            this.deliver(src, dst, tag, message);
        }
    }

    private checkSize(dst: string, message: MessageValue, action = `Cannot send to ${dst}`) {
        if (!this.canReceive(dst, message)) {
            throw new MessagingError(
                `${action}: ${describeMessageType(message.type)} of this size is too large for ${dst} to receive.`,
                'value too large',
            );
        }
    }

    private deliver(src: string, dst: string, tag: string, message: MessageValue) {
        const request = this.pending.get(dst);
        if (request && request.src === src && request.tag === tag) {
            this.pending.delete(dst);
            if (message.type === request.expected) {
                request.resolve(message);
            } else {
                request.reject(typeMismatch(src, dst, tag, message.type, request.expected));
            }
            return;
        }
        const key = mailboxKey(src, dst, tag);
        const mailbox = this.mailboxes.get(key);
        if (mailbox) {
            mailbox.push(message);
        } else {
            this.mailboxes.set(key, [message]);
        }
    }

    private receive(dst: string, src: string, tag: string, expected: MessageType): Promise<MessageValue> {
        if (src === dst) {
            return Promise.reject(new MessagingError(
                `Cannot receive from ${src}: a project cannot receive a message from itself.`,
                'receive from self',
            ));
        }
        if (!this.names.includes(src)) {
            return Promise.reject(new MessagingError(
                `Cannot receive from ${src}: no such project in this workspace run.`,
                `no project ${src}`,
            ));
        }
        const key = mailboxKey(src, dst, tag);
        const mailbox = this.mailboxes.get(key);
        if (mailbox) {
            const message = mailbox.shift()!;
            if (mailbox.length === 0) {
                this.mailboxes.delete(key);
            }
            if (message.type !== expected) {
                return Promise.reject(typeMismatch(src, dst, tag, message.type, expected));
            }
            return Promise.resolve(message);
        }
        if (!this.open.has(src)) {
            return Promise.reject(new MessagingError(
                `${src} has finished without sending a message with tag "${tag}".`,
                `${src} finished`,
            ));
        }
        if (this.pending.has(dst)) {
            return Promise.reject(new MessagingError(
                `${dst} is already waiting for a message.`,
                'already waiting',
            ));
        }
        return new Promise<MessageValue>((resolve, reject) => {
            this.pending.set(dst, { src, tag, expected, resolve, reject });
            this.rejectIfDeadlocked();
        });
    }

    /**
     * When every open member is waiting, nobody can send the messages they
     * wait for. A pending receive always has an empty mailbox, since a message
     * that arrives for it is handed over immediately.
     */
    private rejectIfDeadlocked() {
        if (this.pending.size === 0 || this.pending.size < this.open.size) {
            return;
        }
        const waiting = [...this.pending];
        this.pending.clear();
        const summary = waiting
            .map(([dst, r]) => `${dst} waits for "${r.tag}" from ${r.src}`)
            .join(', ');
        for (const [, request] of waiting) {
            request.reject(new MessagingError(`Deadlock: ${summary}.`, 'deadlock'));
        }
    }
}

function typeMismatch(
    src: string, dst: string, tag: string, sent: MessageType, expected: MessageType,
): MessagingError {
    return new MessagingError(
        `Type mismatch: ${src} sent ${describeMessageType(sent)} with tag "${tag}", ` +
        `but ${dst} expected ${describeMessageType(expected)}.`,
        'type mismatch',
    );
}

function mailboxKey(src: string, dst: string, tag: string) {
    // JSON keeps the key unambiguous whatever characters the names contain.
    return JSON.stringify([src, dst, tag]);
}
