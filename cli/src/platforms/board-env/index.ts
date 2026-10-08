import * as os from 'os';
import { Esp32Env, Esp32UnixEnv, Esp32WindowsEnv } from './esp32-env';
import { CommonBoardEnv, BoardEnv } from './common-env';
import { BoardName } from '../../config/board-utils';
import { HostEnv, HostUnixEnv, HostWindowsEnv } from './host-env';


type BoardEnvMap = {
    esp32: Esp32Env;
    host: HostEnv;
};

/**
 * @param runtimeDir the runtime directory that the host runtime is built from.
 *   Only used for host. Defaults to the runtime downloaded under ~/.bluescript.
 */
export function createBoardEnv<B extends BoardName>(board: B, runtimeDir?: string): BoardEnvMap[B];
export function createBoardEnv(board: BoardName, runtimeDir?: string): BoardEnvMap[BoardName] {
    const osType = os.platform();
    if (board === 'esp32') {
        if (osType === 'darwin' || osType === 'linux')
            return new Esp32UnixEnv();
        if (osType === 'win32')
            return new Esp32WindowsEnv();
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    if (board === 'host') {
        if (osType === 'darwin' || osType === 'linux')
            return new HostUnixEnv(runtimeDir);
        if (osType === 'win32')
            return new HostWindowsEnv(runtimeDir);
        throw new Error(`Unsupported OS type: ${osType}.`);
    }
    throw new Error(`Unsupported board name: ${board}`);
}

export {
    CommonBoardEnv,
    BoardEnv,
    Esp32Env,
    Esp32UnixEnv,
    Esp32WindowsEnv,
    HostEnv,
    HostUnixEnv,
    HostWindowsEnv,
};
