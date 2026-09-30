import * as readline from 'readline';

export type ControlKeyHandlers = {
    onCtrlC?: () => void;
    onCtrlD?: () => void;
};

/**
 * Puts stdin into raw mode and calls the handlers on Ctrl-C / Ctrl-D.
 * Typed characters are not echoed. Returns a function that restores stdin.
 * Does nothing when stdin is not a TTY.
 */
export function listenControlKeys(handlers: ControlKeyHandlers): () => void {
    if (!process.stdin.isTTY) {
        return () => {};
    }
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const onKeypress = (_str: string, key: readline.Key | undefined) => {
        if (key?.ctrl && key.name === 'c') {
            handlers.onCtrlC?.();
        } else if (key?.ctrl && key.name === 'd') {
            handlers.onCtrlD?.();
        }
    };
    process.stdin.on('keypress', onKeypress);

    return () => {
        process.stdin.off('keypress', onKeypress);
        process.stdin.setRawMode(false);
    };
}
