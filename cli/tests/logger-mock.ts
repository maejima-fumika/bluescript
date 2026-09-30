/** A replacement for `src/core/logger` that prints nothing and runs every step. */
export function createLoggerMock() {
    const actual = jest.requireActual('../src/core/logger');
    return {
        ...actual,
        runStep: jest.fn(async (_message: string, action: (step: { progress(text: string): void }) => Promise<unknown>) => {
            const result = await action({ progress: () => {} });
            if (result instanceof actual.StepSkip) {
                return undefined;
            }
            return result;
        }),
        logger: {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            success: jest.fn(),
            log: jest.fn(),
            br: jest.fn(),
            showError: jest.fn(),
        },
    };
}
