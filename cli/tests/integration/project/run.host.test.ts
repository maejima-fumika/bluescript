jest.mock('../../../src/core/command-exec', () => ({
    ...jest.requireActual('../../../src/core/command-exec'),
    cwd: jest.fn(),
}));

import * as path from 'path';
import { cwd } from '../../../src/core/command-exec';
import * as fs from '../../../src/core/fs';
import { handleRunCommand } from '../../../src/commands/project/run';
import { logger } from '../../../src/core/logger';
import {
    deleteGlobalEnv,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../../commands/global-env-helper';
import {
    captureOutput,
    captureStdout,
    createHostProject,
    describeHostIntegration,
    ensureHostRuntimeBuilt,
    expectExitCode,
    HOST_INTEGRATION_BUILD_DIR,
    HOST_INTEGRATION_RUNTIME_DIR,
    mockProcessExit,
    removeDirIfExists,
} from '../host-run-helper';

const mockedCwd = cwd as jest.Mock;

const TEMP_DIR = path.join(__dirname, '../../../temp-files/integration');

let currentProjectRoot: string;
let testCounter = 0;

describeHostIntegration('project run command (host integration)', () => {
    beforeAll(async () => {
        spyGlobalSettings('run-integration');
        fs.makeDir(TEMP_DIR);
        await ensureHostRuntimeBuilt();
    });

    beforeEach(() => {
        deleteGlobalEnv();
        setupGlobalEnvWithHostIntegration(
            HOST_INTEGRATION_RUNTIME_DIR,
            HOST_INTEGRATION_BUILD_DIR,
        );
        currentProjectRoot = path.join(TEMP_DIR, `run-project-${++testCounter}`);
        fs.makeDir(currentProjectRoot);
        mockedCwd.mockReturnValue(currentProjectRoot);
    });

    afterAll(async () => {
        deleteGlobalEnv();
        await removeDirIfExists(TEMP_DIR);
    });

    it('runs a program and prints output', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'console.log("hello from run");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('hello from run');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('rejects messages between projects outside a workspace', async () => {
        const exitSpy = mockProcessExit();
        const output = captureOutput();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'sendInteger("other", "t", 1);\nconsole.log("unreachable");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(output.text()).toMatch(/runtime error: .*only available in `bscript workspace run`/);
        expect(output.text()).not.toContain('unreachable');

        output.restore();
        exitSpy.mockRestore();
    });

    it('runs a program using the built-in library', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': `
console.log("built-in");
print("via print");
console.log(time.now());
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('built-in');
        expect(stdout.text()).toContain('via print');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('measures elapsed time with performanceNow()', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': `
const start = performanceNow();
let sum = 0;
for (let i = 0; i < 1000000; i++) {
    sum = sum + i % 7;
}
const end = performanceNow();
console.log("start=" + start);
console.log("end=" + end);
console.log(sum);
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        const start = Number(stdout.text().match(/start=([-\d.e+]+)/)?.[1]);
        const end = Number(stdout.text().match(/end=([-\d.e+]+)/)?.[1]);
        // The first call is the origin.
        expect(start).toBeGreaterThanOrEqual(0);
        expect(start).toBeLessThan(1);
        expect(end).toBeGreaterThanOrEqual(start);

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('prints a STATS line after the output with --stats', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'console.log("hello from stats");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false, stats: true });

        expectExitCode(exitSpy, 0, stdout);
        const text = stdout.text();
        expect(text).toMatch(/^STATS test-run status=finished exec_ms=\d+\.\d{3} gc_runs=\d+ gc_ms=\d+\.\d{3} alloc_words=\d+ alloc_objects=\d+ heap_words=\d+$/m);
        expect(text.indexOf('STATS')).toBeGreaterThan(text.lastIndexOf('===='));

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('prints a table of the statistics with --stats in a terminal', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();
        // captureStdout treats stdout as not a terminal; restore() puts it back.
        Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true, writable: true });

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'console.log("hello from a terminal");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false, stats: true });

        expectExitCode(exitSpy, 0, stdout);
        const text = stdout.text().replace(/\u001b\[[0-9;]*m/g, '');
        expect(text).not.toContain('STATS');
        expect(text).toMatch(/^project +exec ms +GC runs +GC ms +alloc objects +alloc words +heap words$/m);
        expect(text).toMatch(/^test-run +[\d,]+\.\d{3} +[\d,]+ +[\d,]+\.\d{3} +[\d,]+ +[\d,]+ +[\d,]+$/m);
        expect(text.indexOf('project ')).toBeGreaterThan(text.lastIndexOf('===='));

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('exits with an error when the program ends with a runtime error', async () => {
        (logger.error as jest.Mock).mockClear();
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'let a: integer[] = [1, 2];\nconsole.log(a[5]);\nconsole.log("unreachable");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false, stats: true });

        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(logger.error).toHaveBeenCalledWith('The program ended with a runtime error.');
        expect(stdout.text()).not.toContain('unreachable');
        expect(stdout.text()).toMatch(/^STATS test-run status=error exec_ms=\d+\.\d{3} /m);

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('prints no STATS line without --stats', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'console.log("hello without stats");',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('hello without stats');
        expect(stdout.text()).not.toContain('STATS');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with user-defined functions and variables', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': `
const message = "hello";
function greet(): void {
    console.log(message);
}
greet();
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('hello');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with a local module import', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/math-utils.bs': `
export function add(a: integer, b: integer): integer {
    return a + b;
}
            `.trim(),
            'src/index.bs': `
import { add } from "./math-utils";
console.log(add(10, 20));
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('30');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program with a package import', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': `
import { mul } from "math-lib";
console.log(mul(3, 4));
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR, 'test-run', [{
            name: 'math-lib',
            sources: {
                'src/index.bs': `
export function mul(a: integer, b: integer): integer {
    return a * b;
}
                `.trim(),
            },
        }]);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('12');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program using inline C', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/index.bs': `
code\`#include <math.h>\`

function pow(x: float, y: float): float {
    let result: float;
    code\`\${result} = (float)pow(\${x}, \${y});\`;
    return result;
}

console.log(pow(2.0, 3.0));
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toMatch(/8(\.0+)?/);

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program that includes a C file', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/add.c': 'int add(int a, int b) { return a + b; }',
            'src/index.bs': `
code\`#include "./add.c"\`

function main(): void {
    let result: integer = 0;
    code\`\${result} = add(10, 20);\`;
    console.log(result);
}

main();
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('30');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('runs a program that includes a header file', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(currentProjectRoot, {
            'src/add.h': 'int add(int a, int b);',
            'src/add.c': '#include "add.h"\nint add(int a, int b) { return a + b; }',
            'src/index.bs': `
code\`#include "add.h"\`

function main(): void {
    let result: integer = 0;
    code\`\${result} = add(5, 6);\`;
    console.log(result);
}

main();
            `.trim(),
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('11');

        stdout.restore();
        exitSpy.mockRestore();
    });

    it('exits with an error when compilation fails', async () => {
        const exitSpy = mockProcessExit();

        createHostProject(currentProjectRoot, {
            'src/index.bs': 'this is not valid bluescript',
        }, HOST_INTEGRATION_RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false });

        expect(exitSpy).toHaveBeenCalledWith(1);

        exitSpy.mockRestore();
    });
});
