import * as path from 'path';
import { handleBuildRuntimeCommand } from '../../../src/commands/board/build-runtime';
import { GLOBAL_SETTINGS } from '../../../src/config/constants';
import {
    deleteGlobalEnv,
    getExpectedHostToolchain,
    getGlobalConfig,
    getTestRuntimeDir,
    setupDefaultGlobalEnv,
    setupGlobalEnvWithEsp32,
    setupGlobalEnvWithHost,
    setupGlobalEnvWithHostIntegration,
    spyGlobalSettings,
} from '../global-env-helper';
import {
    mockedExecShell,
    mockedLogger,
    mockedSimpleExec,
    mockProcessExit,
} from '../mock-helpers';


describe('board build-runtime command', () => {
    beforeAll(() => {
        spyGlobalSettings('build-runtime');
    });

    afterEach(() => {
        jest.clearAllMocks();
        deleteGlobalEnv();
    });

    it('should show warning and exit if update is needed', async () => {
        // --- Arrange ---
        const exitSpy = mockProcessExit();
        setupGlobalEnvWithHost(true);

        // --- Act ---
        await handleBuildRuntimeCommand('host', {});

        // --- Assert ---
        expect(mockedLogger.warn).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    it('should exit with an error for an unknown board name', async () => {
        // --- Arrange ---
        setupGlobalEnvWithHost();
        const exitSpy = mockProcessExit();

        // --- Act ---
        await handleBuildRuntimeCommand('unknown-board', {});

        // --- Assert ---
        expect(mockedLogger.error).toHaveBeenCalledWith('Failed to build the runtime for unknown-board');
        expect(mockedLogger.showError).toHaveBeenCalledWith(new Error('Unsupported board name: unknown-board'));
        expect(process.exit).toHaveBeenCalledWith(1);

        // --- Clean up ---
        exitSpy.mockRestore();
    });

    describe('for host board', () => {
        it('should build the runtime in the runtime directory', async () => {
            // --- Arrange ---
            setupGlobalEnvWithHost();

            // --- Act ---
            await handleBuildRuntimeCommand('host', {});

            // --- Assert ---
            expect(mockedSimpleExec).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([path.join(getTestRuntimeDir(), 'core/src/c-runtime.c')]),
            );
            expect(mockedLogger.error).not.toHaveBeenCalled();
            expect(mockedLogger.success).toHaveBeenCalledWith('Success to build the BlueScript runtime for host');
        });

        it('should build the runtime in the runtime directory of the config and run its shell', async () => {
            // --- Arrange ---
            const runtimeDir = path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'dev-runtime');
            const oldBuildDir = path.join(getTestRuntimeDir(), 'ports/host/build');
            setupGlobalEnvWithHostIntegration(runtimeDir, oldBuildDir);
            const oldConfig = getGlobalConfig();

            // --- Act ---
            await handleBuildRuntimeCommand('host', {});

            // --- Assert ---
            expect(mockedSimpleExec).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([path.join(runtimeDir, 'core/src/c-runtime.c')]),
            );
            const host = getGlobalConfig().boards.host;
            expect(path.dirname(host.shellFile)).toBe(path.join(runtimeDir, 'ports/host/build'));
            expect(host.rootDir).toBe(oldConfig.boards.host.rootDir);
            expect(host.toolchain).toEqual(getExpectedHostToolchain());
            expect(getGlobalConfig().runtimeDir).toBe(runtimeDir);
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv();

            // --- Act ---
            await handleBuildRuntimeCommand('host', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith(`The environment for host is not set up. Run 'bscript board setup host' and try again.`);
            expect(mockedSimpleExec).not.toHaveBeenCalled();
        });

        it('should exit with an error if the build fails', async () => {
            // --- Arrange ---
            setupGlobalEnvWithHost();
            const exitSpy = mockProcessExit();
            mockedSimpleExec.mockRejectedValueOnce(new Error('compile error'));

            // --- Act ---
            await handleBuildRuntimeCommand('host', {});

            // --- Assert ---
            expect(mockedLogger.error).toHaveBeenCalledWith('Failed to build the runtime for host');
            expect(process.exit).toHaveBeenCalledWith(1);

            // --- Clean up ---
            exitSpy.mockRestore();
        });
    });

    describe('for esp32 board', () => {
        it('should build the runtime without flashing it', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();

            // --- Act ---
            await handleBuildRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedExecShell).toHaveBeenCalledTimes(1);
            const [command, options] = mockedExecShell.mock.calls[0];
            expect(command).toContain('idf.py -D DEVICE_NAME=BLUESCRIPT build');
            expect(command).not.toContain('flash');
            expect(options).toEqual({ cwd: path.join(getTestRuntimeDir(), 'ports/esp32') });
            expect(mockedLogger.success).toHaveBeenCalledWith('Success to build the BlueScript runtime for esp32');
        });

        it('should build the runtime with device name if specified', async () => {
            // --- Arrange ---
            setupGlobalEnvWithEsp32();

            // --- Act ---
            await handleBuildRuntimeCommand('esp32', { deviceName: 'my-device' });

            // --- Assert ---
            expect(mockedExecShell).toHaveBeenCalledWith(expect.stringContaining('DEVICE_NAME=my-device'), expect.any(Object));
        });

        it('should warn and exit if setup is not completed', async () => {
            // --- Arrange ---
            setupDefaultGlobalEnv();

            // --- Act ---
            await handleBuildRuntimeCommand('esp32', {});

            // --- Assert ---
            expect(mockedLogger.warn).toHaveBeenCalledWith(`The environment for esp32 is not set up. Run 'bscript board setup esp32' and try again.`);
            expect(mockedExecShell).not.toHaveBeenCalled();
        });
    });
});
