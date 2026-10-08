import * as path from 'path';
import * as os from 'os';
import * as fs from '../../core/fs';
import { GLOBAL_SETTINGS } from '../../config/constants';
import { simpleExec } from '../../core/command-exec';
import { BoardEnv, isPackageInstalledOnUnix, isPackageInstalledOnWindows } from './common-env';

export const HEAP_WORDS_ENV = 'BSCRIPT_HOST_HEAP_WORDS';
const MIN_HEAP_WORDS = 1024;

/**
 * The flags that set the size of the heap of the host runtime, in words,
 * when the environment variable BSCRIPT_HOST_HEAP_WORDS is set.
 */
export function heapSizeFlags(env: NodeJS.ProcessEnv = process.env): string[] {
    const value = env[HEAP_WORDS_ENV];
    if (value === undefined || value === '') {
        return [];
    }
    if (!/^\d+$/.test(value) || Number(value) % 2 !== 0 || Number(value) < MIN_HEAP_WORDS) {
        throw new Error(`${HEAP_WORDS_ENV} must be an even number of words, ${MIN_HEAP_WORDS} or more: ${value}`);
    }
    return [`-DHEAP_SIZE=${value}`];
}

export abstract class HostEnv extends BoardEnv {
    /**
     * @param runtimeSourceDir the runtime directory to build, e.g. the one in the
     *   global config. Defaults to the runtime downloaded under ~/.bluescript.
     */
    constructor(private runtimeSourceDir?: string) {
        super();
    }

    /** The runtime directory that the host runtime is built from and into. */
    get sourceDir() { return this.runtimeSourceDir ?? this.runtimeDir; }
    get hostRootDir() { return path.join(GLOBAL_SETTINGS.BLUESCRIPT_DIR, 'host'); }
    get buildDir() { return path.join(this.sourceDir, 'ports/host/build'); }
    get builtinModuleCFile() { return path.join(this.sourceDir, 'ports/host/std-module.c'); }
    get shellCFile() { return path.join(this.sourceDir, 'ports/host/shell.c'); }
    get runtimeCFile() { return path.join(this.sourceDir, 'core/src/c-runtime.c'); }
    get commCFile() { return path.join(this.sourceDir, 'ports/host/comm.c'); }

    abstract get shellFile(): string;
    abstract buildHostRuntime(): Promise<void>;

    removeBoardRoot() {
        fs.removeDir(this.hostRootDir);
    }

    refreshBoardRoot() {
        this.removeBoardRoot();
        fs.makeDir(this.hostRootDir);
    }

    removeBuildDir() {
        fs.removeDir(this.buildDir);
    }

    abstract getGccCommand(): Promise<string>;
    abstract getArCommand(): Promise<string>;
    abstract getMakeCommand(): Promise<string>;
}

export class HostUnixEnv extends HostEnv {
    get gccCommandName() {
        if (os.platform() === 'darwin') {
            return 'cc';
        } else {
            return 'gcc';
        }
    }
    get runtimeSoFile() { return path.join(this.buildDir, 'c-runtime.so'); }
    get shellFile() { return path.join(this.buildDir, 'shell'); }

    async buildHostRuntime() {
        const heapFlags = heapSizeFlags();
        fs.makeDir(this.buildDir);
        try {
            await simpleExec(this.gccCommandName, [
                '-DLINUX64', '-O2', '-shared', '-fPIC', ...heapFlags,
                '-o', this.runtimeSoFile,
                this.runtimeCFile, this.builtinModuleCFile, this.commCFile,
            ]);
            await simpleExec(this.gccCommandName, [
                '-DLINUX64', '-O2',
                '-o', this.shellFile,
                this.shellCFile, this.runtimeSoFile,
                '-lm', '-ldl',
            ]);
        } catch(error) {
            throw new Error('Failed to compile host runtime.', { cause: error });
        }
        
    }

    isPackageInstalled(name: string): Promise<boolean> {
        return isPackageInstalledOnUnix(name);
    }

    async getGccCommand(): Promise<string> {
        if (await this.isPackageInstalled(this.gccCommandName)) {
            return this.gccCommandName;
        } else {
            throw new Error(`Cannot find ${this.gccCommandName} command. Please install ${this.gccCommandName}.`);
        }
    }

    async getArCommand(): Promise<string> {
        if (await this.isPackageInstalled('ar')) {
            return 'ar';
        } else {
            throw new Error('Cannot find ar command. Please install ar.');
        }
    }

    async getMakeCommand(): Promise<string> {
        if (await this.isPackageInstalled('make')) {
            return 'make';
        } else {
            throw new Error('Cannot find make command. Please install make.');
        }
    }
}

export class HostWindowsEnv extends HostEnv {
    get runtimeDllFile() { return path.join(this.buildDir, 'c-runtime.dll'); }
    get shellFile() { return path.join(this.buildDir, 'shell.exe'); }

    async buildHostRuntime() {
        const heapFlags = heapSizeFlags();
        fs.makeDir(this.buildDir);
        try {
            await simpleExec('gcc', [
                '-DLINUX64', '-O2', '-shared', ...heapFlags,
                '-o', this.runtimeDllFile,
                this.runtimeCFile, this.builtinModuleCFile, this.commCFile,
            ]);
            await simpleExec('gcc', [
                '-DLINUX64', '-O2',
                '-o', this.shellFile,
                this.shellCFile, this.runtimeDllFile,
                '-lm',
            ]);
        } catch (error) {
            throw new Error('Failed to compile host runtime.', { cause: error });
        }
    }

    isPackageInstalled(name: string): Promise<boolean> {
        return isPackageInstalledOnWindows(name);
    }

    async getGccCommand(): Promise<string> {
        if (await this.isPackageInstalled('gcc') && await this.isMingwGccAvailable()) {
            return 'gcc';
        } else {
            throw new Error('Cannot find gcc command. Please install MinGW-w64 and add it to PATH.');
        }
    }

    private async isMingwGccAvailable(): Promise<boolean> {
        try {
            const machine = (await simpleExec('gcc', ['-dumpmachine'])).trim();
            return machine.includes('mingw');
        } catch {
            return false;
        }
    }

    async getArCommand(): Promise<string> {
        if (await this.isPackageInstalled('ar')) {
            return 'ar';
        } else {
            throw new Error('Cannot find ar command. Please install MinGW-w64 and add it to PATH.');
        }
    }

    async getMakeCommand(): Promise<string> {
        if (await this.isPackageInstalled('mingw32-make')) {
            return 'mingw32-make';
        } else {
            throw new Error('Cannot find mingw32-make command. Please install MinGW-w64 and add it to PATH.');
        }
    }
}
