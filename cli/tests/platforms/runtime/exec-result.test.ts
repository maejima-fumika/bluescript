import { addGcStats, formatStatsLine, formatStatsTable, statusOf } from '../../../src/platforms/runtime/exec-result';

const stats = { runs: 2, gcMs: 0.5, allocWords: 100, allocObjects: 10, heapWords: 8194 };

describe('addGcStats', () => {
    test('adds up the counters and keeps the heap size', () => {
        expect(addGcStats(stats, { runs: 1, gcMs: 0.25, allocWords: 6, allocObjects: 1, heapWords: 8194 }))
            .toEqual({ runs: 3, gcMs: 0.75, allocWords: 106, allocObjects: 11, heapWords: 8194 });
    });

    test('is absent when either is absent', () => {
        expect(addGcStats(stats, undefined)).toBeUndefined();
        expect(addGcStats(undefined, stats)).toBeUndefined();
    });
});

describe('formatStatsLine', () => {
    test('prints every value in one line', () => {
        expect(formatStatsLine('alpha', 'finished', { exectime: 12.34567, error: false, gcStats: stats }))
            .toBe('STATS alpha status=finished exec_ms=12.346 gc_runs=2 gc_ms=0.500 alloc_words=100 alloc_objects=10 heap_words=8194');
    });

    test('prints the values up to a runtime error', () => {
        expect(formatStatsLine('alpha', 'error', { exectime: 1, error: true, gcStats: stats }))
            .toBe('STATS alpha status=error exec_ms=1.000 gc_runs=2 gc_ms=0.500 alloc_words=100 alloc_objects=10 heap_words=8194');
    });

    test('prints NA for the statistics a board does not send', () => {
        expect(formatStatsLine('beta', 'finished', { exectime: 5, error: false }))
            .toBe('STATS beta status=finished exec_ms=5.000 gc_runs=NA gc_ms=NA alloc_words=NA alloc_objects=NA heap_words=NA');
    });

    test.each(['failed', 'disconnected', 'stopped'] as const)('prints NA for every value when %s', (status) => {
        expect(formatStatsLine('gamma', status))
            .toBe(`STATS gamma status=${status} exec_ms=NA gc_runs=NA gc_ms=NA alloc_words=NA alloc_objects=NA heap_words=NA`);
    });
});

describe('statusOf', () => {
    test('tells a runtime error from a completed run', () => {
        expect(statusOf({ exectime: 1, error: false })).toBe('finished');
        expect(statusOf({ exectime: 1, error: true })).toBe('error');
    });
});

describe('formatStatsTable', () => {
    test('aligns the columns and separates thousands', () => {
        expect(formatStatsTable([
            { projectName: 'alpha', result: { exectime: 8.8071, error: false, gcStats: {
                runs: 73, gcMs: 1.2249, allocWords: 600006, allocObjects: 200003, heapWords: 8194,
            } } },
            { projectName: 'actuator', result: { exectime: 1412.3, error: false } },
        ])).toEqual([
            'project      exec ms   GC runs   GC ms   alloc objects   alloc words   heap words',
            'alpha          8.807        73   1.225         200,003       600,006        8,194',
            'actuator   1,412.300         –       –               –             –            –',
        ]);
    });
});
