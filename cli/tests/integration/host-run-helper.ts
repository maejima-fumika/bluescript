import * as nodeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as fs from '../../src/core/fs';
import { ProjectConfigHandler } from '../../src/config/project-config';
import { PROJECT_DEFAULT_PATHS } from '../../src/config/project-config';
import { BoardEnv, createBoardEnv } from '../../src/platforms/board-env';
import { logger } from '../../src/core/logger';

const isHostPlatform = os.platform() === 'darwin' || os.platform() === 'win32' || os.platform() === 'linux';
export const describeHostIntegration = isHostPlatform ? describe : describe.skip;

export type HostPackageSpec = {
    name: string;
    sources: Record<string, string>;
};

function writeSources(root: string, sources: Record<string, string>) {
    for (const [relativePath, code] of Object.entries(sources)) {
        const filePath = path.join(root, relativePath);
        fs.makeDir(path.dirname(filePath));
        fs.writeFile(filePath, code);
    }
}

function createHostPackage(
    projectRoot: string,
    packageName: string,
    sources: Record<string, string>,
    runtimeDir: string,
) {
    const packageRoot = path.join(projectRoot, PROJECT_DEFAULT_PATHS.PACKAGES_DIR, packageName);
    writeSources(packageRoot, sources);

    const handler = ProjectConfigHandler.createTemplate(packageName, 'host', packageRoot);
    handler.update({
        srcDir: './src',
        entryFile: './src/index.bs',
        runtimeDir,
    });
    handler.save(packageRoot);
}

export function createHostProject(
    root: string,
    sources: Record<string, string>,
    runtimeDir: string,
    projectName = 'test-run',
    packages: HostPackageSpec[] = [],
) {
    for (const pkg of packages) {
        createHostPackage(root, pkg.name, pkg.sources, runtimeDir);
    }

    writeSources(root, sources);

    const handler = ProjectConfigHandler.createTemplate(projectName, 'host', root);
    handler.update({
        srcDir: './src',
        entryFile: './src/index.bs',
        runtimeDir,
    });
    for (const pkg of packages) {
        handler.addDependency({
            name: pkg.name,
            url: `https://example.com/${pkg.name}.git`,
        });
    }
    handler.save(root);
}

export async function removeDirIfExists(dir: string, retries = 5): Promise<void> {
    if (!fs.exists(dir)) {
        return;
    }
    for (let i = 0; i < retries; i++) {
        try {
            fs.removeDir(dir);
            return;
        } catch (error: unknown) {
            const code = (error as NodeJS.ErrnoException).code;
            if ((code !== 'EPERM' && code !== 'EBUSY') || i === retries - 1) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
        }
    }
}

export async function removeChildDirsWithPrefix(parentDir: string, prefix: string): Promise<void> {
    if (!nodeFs.existsSync(parentDir)) {
        return;
    }
    for (const name of nodeFs.readdirSync(parentDir)) {
        if (name.startsWith(prefix)) {
            await removeDirIfExists(path.join(parentDir, name));
        }
    }
}

export function mockProcessExit() {
    return jest
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as (code?: number | string | null | undefined) => never);
}

/**
 * Captures what is written to stdout. stdout is treated as not a TTY meanwhile,
 * so the output is plain lines even when jest runs in a terminal.
 */
export function captureStdout() {
    const chunks: string[] = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
    });
    const isTTYDescriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true, writable: true });

    return {
        text: () => chunks.join(''),
        restore: () => {
            spy.mockRestore();
            if (isTTYDescriptor) {
                Object.defineProperty(process.stdout, 'isTTY', isTTYDescriptor);
            } else {
                delete (process.stdout as { isTTY?: boolean }).isTTY;
            }
        },
    };
}

export function captureOutput() {
    const stdout = captureStdout();
    const consoleLogs: string[] = [];
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        consoleLogs.push(args.map(String).join(' '));
    });

    return {
        text: () => stdout.text() + consoleLogs.join('\n'),
        restore: () => {
            stdout.restore();
            consoleSpy.mockRestore();
        },
    };
}

export async function waitFor(
    predicate: () => boolean,
    timeoutMs = 10000,
    intervalMs = 50,
): Promise<void> {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('waitFor timed out');
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}

export async function waitForStdoutContains(
    output: { text: () => string },
    text: string,
    timeoutMs = 10000,
): Promise<void> {
    await waitFor(() => output.text().includes(text), timeoutMs);
}

export const HOST_INTEGRATION_RUNTIME_DIR =
    path.resolve(__dirname, '../../../microcontroller');
export const HOST_INTEGRATION_BUILD_DIR =
    path.join(HOST_INTEGRATION_RUNTIME_DIR, 'ports/host/build');

export async function assertHostIntegrationPrerequisites(): Promise<void> {
    if (process.platform !== 'win32') {
        return;
    }
    const hostEnv = createBoardEnv('host');
    if (!await hostEnv.isPackageInstalled('gcc')) {
        throw new Error(
            'MinGW-w64 gcc is required for host integration tests on Windows.',
        );
    }
    if (!await hostEnv.isPackageInstalled('mingw32-make')) {
        throw new Error(
            'mingw32-make is required for host integration tests on Windows.',
        );
    }
}

export async function ensureHostRuntimeBuilt(runtimeDir = HOST_INTEGRATION_RUNTIME_DIR): Promise<void> {
    await assertHostIntegrationPrerequisites();
    jest.spyOn(BoardEnv.prototype, 'runtimeDir', 'get')
        .mockReturnValue(runtimeDir);
    const hostEnv = createBoardEnv('host');
    await hostEnv.buildHostRuntime();
}

/**
 * Copies the sources of the host runtime to `dest`, so that it can be built there
 * with other settings without touching the shared build directory.
 */
export function copyHostRuntime(dest: string) {
    for (const dir of ['core/include', 'core/src']) {
        fs.copyDir(path.join(HOST_INTEGRATION_RUNTIME_DIR, dir), path.join(dest, dir));
    }
    const hostDir = path.join(HOST_INTEGRATION_RUNTIME_DIR, 'ports/host');
    fs.makeDir(path.join(dest, 'ports/host'));
    for (const name of nodeFs.readdirSync(hostDir)) {
        if (name !== 'build') {
            nodeFs.copyFileSync(path.join(hostDir, name), path.join(dest, 'ports/host', name));
        }
    }
}

export function dumpRunDiagnostics(
    exitSpy: jest.SpyInstance,
    stdout?: { text: () => string },
): void {
    const code = exitSpy.mock.calls[0]?.[0];
    const lines = [
        `exit code: ${code}`,
        `logger.error: ${JSON.stringify((logger.error as jest.Mock).mock.calls, null, 2)}`,
        `logger.showError: ${(logger.showError as jest.Mock).mock.calls
            .map(([err]) => (err instanceof Error ? err.message : String(err)))
            .join(' | ')}`,
    ];
    if (stdout) {
        lines.push(`stdout: ${stdout.text()}`);
    }
    console.error(lines.join('\n'));
}
export function expectExitCode(
    exitSpy: jest.SpyInstance,
    expected: number,
    stdout?: { text: () => string },
): void {
    const actual = exitSpy.mock.calls[0]?.[0];
    if (actual !== expected) {
        dumpRunDiagnostics(exitSpy, stdout);
    }
    expect(exitSpy).toHaveBeenCalledWith(expected);
}
