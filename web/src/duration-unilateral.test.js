import { describe, expect, it } from 'vitest';
import { augmentDurationWorkoutRecords } from './duration-unilateral.js';

describe('duration unilateral payload', () => {
    it('adds left/right and load mode to duration records without changing weight records', () => {
        const records = [
            { motion: '側棒式', set: 1, tracking_type: 'duration', duration_sec: 30 },
            { motion: '側棒式', set: 2, tracking_type: 'duration', duration_sec: 35 },
            { motion: '深蹲', set: 1, tracking_type: 'weight_reps', side: 'both', load_mode: 'total' },
        ];
        const result = augmentDurationWorkoutRecords(records, [
            { motion: '側棒式', set: 1, side: 'left', load_mode: 'total' },
            { motion: '側棒式', set: 2, side: 'right', load_mode: 'total' },
        ]);

        expect(result[0]).toMatchObject({ side: 'left', load_mode: 'total', duration_sec: 30 });
        expect(result[1]).toMatchObject({ side: 'right', load_mode: 'total', duration_sec: 35 });
        expect(result[2]).toEqual(records[2]);
    });

    it('keeps bilateral duration payload explicit as both', () => {
        const result = augmentDurationWorkoutRecords(
            [{ motion: '棒式', set: 1, tracking_type: 'duration', duration_sec: 60 }],
            [{ motion: '棒式', set: 1, side: 'both', load_mode: 'total' }],
        );
        expect(result[0]).toMatchObject({ side: 'both', load_mode: 'total' });
    });
});
