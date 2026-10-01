jest.mock('../../../src/core/command-exec', () => ({
    ...jest.requireActual('../../../src/core/command-exec'),
    cwd: jest.fn(),
}));

import * as path from 'path';
import { cwd } from '../../../src/core/command-exec';
import * as fs from '../../../src/core/fs';
import { WorkspaceConfigHandler } from '../../../src/config/workspace-config';
import { handleWorkspaceRunCommand } from '../../../src/commands/workspace/run';
import {
    deleteGlobalEnv,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../../commands/global-env-helper';
import {
    captureOutput,
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

const TEMP_DIR = path.join(__dirname, '../../../temp-files/integration-workspace');
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

let workspaceRoot: string;
let testCounter = 0;

function createWorkspace(projects: Record<string, string>) {
    const handler = WorkspaceConfigHandler.createTemplate('ws', workspaceRoot);
    for (const [name, code] of Object.entries(projects)) {
        const projectRoot = path.join(workspaceRoot, name);
        fs.makeDir(projectRoot);
        createHostProject(projectRoot, { 'src/index.bs': code }, HOST_INTEGRATION_RUNTIME_DIR, name);
        handler.addProject(projectRoot);
    }
    handler.save();
}

describeHostIntegration('workspace run command (host integration)', () => {
    beforeAll(async () => {
        spyGlobalSettings('workspace-run-integration');
        fs.makeDir(TEMP_DIR);
        await ensureHostRuntimeBuilt();
    });

    beforeEach(() => {
        deleteGlobalEnv();
        setupGlobalEnvWithHostIntegration(
            HOST_INTEGRATION_RUNTIME_DIR,
            HOST_INTEGRATION_BUILD_DIR,
        );
        workspaceRoot = path.join(TEMP_DIR, `workspace-${++testCounter}`);
        fs.makeDir(workspaceRoot);
        mockedCwd.mockReturnValue(workspaceRoot);
    });

    afterAll(async () => {
        deleteGlobalEnv();
        await removeDirIfExists(TEMP_DIR);
    });

    it('runs every project and prefixes each line with the project name', async () => {
        const exitSpy = mockProcessExit();
        const output = captureOutput();

        createWorkspace({
            alpha: 'console.log("hello from alpha");',
            beta: 'console.log("hello from beta");',
        });

        await handleWorkspaceRunCommand([]);

        expectExitCode(exitSpy, 0, output);
        const text = output.text().replace(ANSI_PATTERN, '');
        expect(text).toMatch(/^\[alpha\] .*hello from alpha/m);
        expect(text).toMatch(/^\[beta \] .*hello from beta/m);

        output.restore();
        exitSpy.mockRestore();
    });

    it('runs only the named projects', async () => {
        const exitSpy = mockProcessExit();
        const output = captureOutput();

        createWorkspace({
            alpha: 'console.log("hello from alpha");',
            beta: 'console.log("hello from beta");',
        });

        await handleWorkspaceRunCommand(['beta']);

        expectExitCode(exitSpy, 0, output);
        expect(output.text()).toContain('hello from beta');
        expect(output.text()).not.toContain('hello from alpha');

        output.restore();
        exitSpy.mockRestore();
    });

    it('runs nothing when any project fails to compile', async () => {
        const exitSpy = mockProcessExit();
        const output = captureOutput();

        createWorkspace({
            alpha: 'console.log("hello from alpha");',
            broken: 'this is not valid bluescript',
        });

        await handleWorkspaceRunCommand([]);

        expectExitCode(exitSpy, 1, output);
        expect(output.text()).not.toContain('hello from alpha');

        output.restore();
        exitSpy.mockRestore();
    });

    it('exits with an error for an unknown project name', async () => {
        const exitSpy = mockProcessExit();
        const output = captureOutput();

        createWorkspace({
            alpha: 'console.log("hello from alpha");',
        });

        await handleWorkspaceRunCommand(['missing']);

        expectExitCode(exitSpy, 1, output);
        expect(output.text()).not.toContain('hello from alpha');

        output.restore();
        exitSpy.mockRestore();
    });

    describe('messages between projects', () => {
        async function runWorkspace(projects: Record<string, string>) {
            const exitSpy = mockProcessExit();
            const output = captureOutput();
            createWorkspace(projects);
            await handleWorkspaceRunCommand([]);
            const text = output.text().replace(ANSI_PATTERN, '');
            output.restore();
            return { exitSpy, output, text };
        }

        it('exchanges integers through the CLI', async () => {
            const { exitSpy, output, text } = await runWorkspace({
                alpha: `
for (let i = 0; i < 3; i++) {
    sendInteger("beta", "ping", i);
    console.log(receiveInteger("beta", "pong"));
}`,
                beta: `
for (let i = 0; i < 3; i++) {
    const v = receiveInteger("alpha", "ping");
    sendInteger("alpha", "pong", v * 10 - 1);
}`,
            });

            expectExitCode(exitSpy, 0, output);
            const alphaLines = text.split('\n').filter((line) => line.startsWith('[alpha]'));
            expect(alphaLines.join('\n')).toMatch(/-1[\s\S]*9[\s\S]*19/);
            expect(text).not.toContain('runtime error');
            exitSpy.mockRestore();
        });

        it('throws when receiving from a project that has finished', async () => {
            const { exitSpy, text } = await runWorkspace({
                alpha: `
console.log(receiveInteger("beta", "t"));
console.log("unreachable");`,
                beta: 'console.log("beta done");',
            });

            expect(text).toMatch(/\[alpha\].*runtime error: beta has finished/);
            expect(text).not.toContain('unreachable');
            exitSpy.mockRestore();
        });

        it('throws when sending to an unknown project', async () => {
            const { exitSpy, text } = await runWorkspace({
                alpha: `
sendInteger("missing", "t", 1);
console.log("unreachable");`,
                beta: 'console.log("beta done");',
            });

            expect(text).toMatch(/\[alpha\].*runtime error: Cannot send to missing/);
            expect(text).not.toContain('unreachable');
            exitSpy.mockRestore();
        });

        it('throws when a project sends to or receives from itself', async () => {
            const { exitSpy, text } = await runWorkspace({
                alpha: `
sendInteger("alpha", "t", 1);
console.log("unreachable");`,
                beta: `
console.log(receiveInteger("beta", "t"));
console.log("unreachable");`,
            });

            expect(text).toMatch(/\[alpha\].*runtime error: Cannot send to alpha: a project cannot send a message to itself/);
            expect(text).toMatch(/\[beta \].*runtime error: Cannot receive from beta: a project cannot receive a message from itself/);
            expect(text).not.toContain('unreachable');
            exitSpy.mockRestore();
        });

        it('reports a deadlock', async () => {
            const { exitSpy, text } = await runWorkspace({
                alpha: 'console.log(receiveInteger("beta", "t"));',
                beta: 'console.log(receiveInteger("alpha", "t"));',
            });

            expect(text).toMatch(/\[alpha\].*Deadlock/);
            expect(text).toMatch(/\[beta \].*Deadlock/);
            exitSpy.mockRestore();
        });
    });
});
