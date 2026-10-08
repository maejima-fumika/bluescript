import { Command } from "commander";
import { BoardName } from "../../config/board-utils";
import { logger, runStep } from "../../core/logger";
import { CommandHandlerWithUpdateCheck } from "../command";
import { DEFAULT_DEVICE_NAME } from "../../config/project-config";
import { createBoardEnv } from "../../platforms/board-env";


abstract class BuildRuntimeHandler extends CommandHandlerWithUpdateCheck {
    abstract readonly boardName: BoardName;
    abstract build(deviceName?: string): Promise<void>;

    isSetup(): boolean {
        return this.globalConfigHandler.isBoardSetup(this.boardName);
    }
}

class HostBuildRuntimeHandler extends BuildRuntimeHandler {
    readonly boardName: BoardName = 'host';

    async build() {
        // Build the runtime that programs are linked against, and run the shell
        // of that build so that only one copy of the runtime is loaded.
        const hostEnv = createBoardEnv('host', this.getRuntimeDir());
        await runStep('Building host runtime...', () => hostEnv.buildHostRuntime());
        const boardConfig = this.globalConfigHandler.getBoardConfig('host')!;
        this.globalConfigHandler.setBoardConfig('host', {
            ...boardConfig,
            shellFile: hostEnv.shellFile,
        });
        this.globalConfigHandler.save();
    }
}

class ESP32BuildRuntimeHandler extends BuildRuntimeHandler {
    readonly boardName: BoardName = 'esp32';

    async build(deviceName?: string) {
        deviceName = deviceName ?? DEFAULT_DEVICE_NAME;
        const exportFile = this.globalConfigHandler.getBoardConfig('esp32')!.exportFile;
        await runStep('Building esp32 runtime...', () => createBoardEnv('esp32').runIdfPy(
            exportFile, this.getRuntimeDir(), ['-D', `DEVICE_NAME=${deviceName}`, 'build'],
        ));
    }
}

function getBuildRuntimeHandler(board: string) {
    if (board === 'host') {
        return new HostBuildRuntimeHandler();
    }
    if (board === 'esp32') {
        return new ESP32BuildRuntimeHandler();
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export async function handleBuildRuntimeCommand(board: string, options: { deviceName?: string }) {
    try {
        const buildRuntimeHandler = getBuildRuntimeHandler(board);

        // Check if setup has already been completed.
        if (!buildRuntimeHandler.isSetup()) {
            logger.warn(`The environment for ${board} is not set up. Run 'bscript board setup ${board}' and try again.`);
            return;
        }

        await buildRuntimeHandler.build(options.deviceName);

        logger.br();
        logger.success(`Success to build the BlueScript runtime for ${board}`);

    } catch (error) {
        logger.error(`Failed to build the runtime for ${board}`);
        logger.showError(error);
        process.exit(1);
    }
}

export function registerBuildRuntimeCommand(program: Command) {
    program
        .command('build-runtime')
        .description('build the BlueScript runtime in the runtime directory again.')
        .argument('<board-name>', 'the name of the board to build for (esp32 or host)')
        .option('-d, --device-name <device-name>', `device name built into the esp32 runtime, the default is '${DEFAULT_DEVICE_NAME}'`)
        .action(handleBuildRuntimeCommand);
}
