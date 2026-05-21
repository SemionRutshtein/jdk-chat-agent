import { describe, it, expect } from 'vitest';
import { genSessionId } from '../components/Chat';

describe('genSessionId', () => {
    it('produces session- prefixed unique ids', () => {
        const a = genSessionId();
        const b = genSessionId();
        expect(a).toMatch(/^session-\d+-[a-z0-9]{6}$/);
        expect(b).toMatch(/^session-\d+-[a-z0-9]{6}$/);
        expect(a).not.toBe(b);
    });

    it('produces 100 distinct ids in a row', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) ids.add(genSessionId());
        expect(ids.size).toBe(100);
    });
});
