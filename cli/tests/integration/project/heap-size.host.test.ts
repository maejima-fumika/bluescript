jest.mock('../../../src/core/command-exec', () => ({
    ...jest.requireActual('../../../src/core/command-exec'),
    cwd: jest.fn(),
}));

import * as path from 'path';
import { cwd } from '../../../src/core/command-exec';
import * as fs from '../../../src/core/fs';
import { handleRunCommand } from '../../../src/commands/project/run';
import { HEAP_WORDS_ENV } from '../../../src/platforms/board-env/host-env';
import {
    deleteGlobalEnv,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../../commands/global-env-helper';
import {
    captureStdout,
    copyHostRuntime,
    createHostProject,
    describeHostIntegration,
    ensureHostRuntimeBuilt,
    expectExitCode,
    mockProcessExit,
    removeDirIfExists,
} from '../host-run-helper';

const mockedCwd = cwd as jest.Mock;

const TEMP_DIR = path.join(__dirname, '../../../temp-files/integration-heap-size');
// Built here, so the runtime shared by the other tests keeps its heap size.
const RUNTIME_DIR = path.join(TEMP_DIR, 'runtime');
const BUILD_DIR = path.join(RUNTIME_DIR, 'ports/host/build');
const PROJECT_ROOT = path.join(TEMP_DIR, 'project');
const HEAP_WORDS = '16386';

describeHostIntegration('host runtime built with BSCRIPT_HOST_HEAP_WORDS (host integration)', () => {
    let savedHeapWords: string | undefined;

    beforeAll(async () => {
        spyGlobalSettings('heap-size-integration');
        await removeDirIfExists(TEMP_DIR);
        copyHostRuntime(RUNTIME_DIR);
        savedHeapWords = process.env[HEAP_WORDS_ENV];
        process.env[HEAP_WORDS_ENV] = HEAP_WORDS;
        try {
            await ensureHostRuntimeBuilt(RUNTIME_DIR);
        } finally {
            if (savedHeapWords === undefined) {
                delete process.env[HEAP_WORDS_ENV];
            } else {
                process.env[HEAP_WORDS_ENV] = savedHeapWords;
            }
        }
    });

    beforeEach(() => {
        deleteGlobalEnv();
        setupGlobalEnvWithHostIntegration(RUNTIME_DIR, BUILD_DIR);
        fs.makeDir(PROJECT_ROOT);
        mockedCwd.mockReturnValue(PROJECT_ROOT);
    });

    afterAll(async () => {
        deleteGlobalEnv();
        await removeDirIfExists(TEMP_DIR);
    });

    it('reports the heap size in the STATS line', async () => {
        const exitSpy = mockProcessExit();
        const stdout = captureStdout();

        createHostProject(PROJECT_ROOT, {
            'src/index.bs': 'console.log("hello from a larger heap");',
        }, RUNTIME_DIR);

        await handleRunCommand({ withRepl: false, withNotebook: false, stats: true });

        expectExitCode(exitSpy, 0, stdout);
        expect(stdout.text()).toContain('hello from a larger heap');
        expect(stdout.text()).toMatch(new RegExp(`^STATS test-run .* heap_words=${HEAP_WORDS}$`, 'm'));

        stdout.restore();
        exitSpy.mockRestore();
    });
});
