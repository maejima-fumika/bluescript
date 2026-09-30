/** Returns the message of `error` followed by the messages of its causes. */
export function collectErrorMessages(error: unknown): string[] {
    const messages: string[] = [];
    let currentError = error;
    while (currentError) {
        if (currentError instanceof Error) {
            messages.push(currentError.message);
            currentError = currentError.cause;
        } else {
            messages.push(`Unknown Error: ${String(currentError)}`);
            break;
        }
    }
    return messages;
}
