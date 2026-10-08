import * as path from 'path';
import * as os from 'os';
import { heapSizeFlags, HostUnixEnv } from '../../../src/platforms/board-env/host-env';

describe('heapSizeFlags', () => {
    test('adds nothing when BSCRIPT_HOST_HEAP_WORDS is not set', () => {
        expect(heapSizeFlags({})).toEqual([]);
        expect(heapSizeFlags({ BSCRIPT_HOST_HEAP_WORDS: '' })).toEqual([]);
    });

    test('sets HEAP_SIZE to BSCRIPT_HOST_HEAP_WORDS', () => {
        expect(heapSizeFlags({ BSCRIPT_HOST_HEAP_WORDS: '1048576' })).toEqual(['-DHEAP_SIZE=1048576']);
    });

    test.each(['16385', '-16384', '16k', '1e6', '512'])('rejects %s', (value) => {
        expect(() => heapSizeFlags({ BSCRIPT_HOST_HEAP_WORDS: value }))
            .toThrow(/BSCRIPT_HOST_HEAP_WORDS must be an even number/);
    });
});

describe('HostEnv', () => {
    test('builds the runtime downloaded under ~/.bluescript by default', () => {
        const env = new HostUnixEnv();
        const runtimeDir = path.join(os.homedir(), '.bluescript', 'microcontroller');
        expect(env.buildDir).toBe(path.join(runtimeDir, 'ports/host/build'));
        expect(env.runtimeCFile).toBe(path.join(runtimeDir, 'core/src/c-runtime.c'));
    });

    test('builds the runtime in the given runtime directory', () => {
        const runtimeDir = path.join('/dev', 'microcontroller');
        const env = new HostUnixEnv(runtimeDir);
        expect(env.buildDir).toBe(path.join(runtimeDir, 'ports/host/build'));
        expect(env.runtimeCFile).toBe(path.join(runtimeDir, 'core/src/c-runtime.c'));
        expect(env.builtinModuleCFile).toBe(path.join(runtimeDir, 'ports/host/std-module.c'));
        expect(env.shellFile).toBe(path.join(runtimeDir, 'ports/host/build/shell'));
        // The downloaded runtime is still where setup and update put it.
        expect(env.runtimeDir).toBe(path.join(os.homedir(), '.bluescript', 'microcontroller'));
    });
});
