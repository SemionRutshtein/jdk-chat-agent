import { describe, it, expect } from 'vitest';
import { bucketByDay } from '../components/SessionSidebar';

describe('bucketByDay', () => {
    const fixedNow = new Date('2026-05-21T10:00:00');

    const mk = (id, daysAgo, hours = 0) => {
        const d = new Date(fixedNow);
        d.setDate(d.getDate() - daysAgo);
        d.setHours(d.getHours() - hours);
        return { session_id: id, updated_at: d.toISOString(), message_count: 1 };
    };

    it('puts today entries in `today`', () => {
        const sessions = [mk('a', 0, 1), mk('b', 0, 5)];
        const { today, yesterday, earlier } = bucketByDay(sessions, fixedNow);
        expect(today.map(s => s.session_id)).toEqual(['a', 'b']);
        expect(yesterday).toEqual([]);
        expect(earlier).toEqual([]);
    });

    it('puts entries from previous calendar day in `yesterday`', () => {
        const sessions = [mk('a', 1, 0)];
        const { today, yesterday, earlier } = bucketByDay(sessions, fixedNow);
        expect(today).toEqual([]);
        expect(yesterday.map(s => s.session_id)).toEqual(['a']);
        expect(earlier).toEqual([]);
    });

    it('puts old entries in `earlier`', () => {
        const sessions = [mk('a', 5, 0), mk('b', 30, 0)];
        const { today, yesterday, earlier } = bucketByDay(sessions, fixedNow);
        expect(today).toEqual([]);
        expect(yesterday).toEqual([]);
        expect(earlier.map(s => s.session_id)).toEqual(['a', 'b']);
    });

    it('handles empty list', () => {
        const { today, yesterday, earlier } = bucketByDay([], fixedNow);
        expect(today).toEqual([]);
        expect(yesterday).toEqual([]);
        expect(earlier).toEqual([]);
    });
});
