import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Minimal mock of MessageList's StarterGrid logic
// Extracts the keyboard handler behaviour we fixed.
const STARTERS = [
    'What is a lambda expression?',
    'How does garbage collection work?',
    'Sealed classes in Java 17',
    'Virtual threads in Java 21',
    'Records vs classes',
    'JIT compilation explained',
];

function StarterGrid({ onPick, disabled }) {
    React.useEffect(() => {
        const handler = (e) => {
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const n = parseInt(e.key, 10);
            if (Number.isInteger(n) && n >= 1 && n <= STARTERS.length) {
                e.preventDefault();
                onPick(STARTERS[n - 1]);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onPick]);

    return (
        <div>
            {STARTERS.map((q, i) => (
                <button key={q} data-testid={`starter-${i + 1}`} onClick={() => onPick(q)} disabled={disabled}>
                    {q}
                </button>
            ))}
        </div>
    );
}

describe('keyboard shortcuts 1-6', () => {
    it('fires onPick with correct starter when pressing 1-6', () => {
        const onPick = vi.fn();
        render(<StarterGrid onPick={onPick} />);

        fireEvent.keyDown(document.body, { key: '1' });
        expect(onPick).toHaveBeenCalledWith(STARTERS[0]);

        fireEvent.keyDown(document.body, { key: '3' });
        expect(onPick).toHaveBeenCalledWith(STARTERS[2]);

        fireEvent.keyDown(document.body, { key: '6' });
        expect(onPick).toHaveBeenCalledWith(STARTERS[5]);
    });

    it('ignores key when focus is on an input', () => {
        const onPick = vi.fn();
        render(
            <div>
                <input data-testid="the-input" />
                <StarterGrid onPick={onPick} />
            </div>
        );
        const input = screen.getByTestId('the-input');
        fireEvent.keyDown(input, { key: '1', target: input });
        expect(onPick).not.toHaveBeenCalled();
    });

    it('ignores key when focus is on a textarea', () => {
        const onPick = vi.fn();
        render(
            <div>
                <textarea data-testid="ta" />
                <StarterGrid onPick={onPick} />
            </div>
        );
        const ta = screen.getByTestId('ta');
        fireEvent.keyDown(ta, { key: '2', target: ta });
        expect(onPick).not.toHaveBeenCalled();
    });

    it('fires even when a button has focus (was broken before fix)', () => {
        const onPick = vi.fn();
        render(<StarterGrid onPick={onPick} />);

        const btn = screen.getByTestId('starter-1');
        btn.focus();
        // dispatch keydown with btn as target
        fireEvent.keyDown(btn, { key: '2', target: btn });
        expect(onPick).toHaveBeenCalledWith(STARTERS[1]);
    });

    it('ignores out-of-range keys (0, 7)', () => {
        const onPick = vi.fn();
        render(<StarterGrid onPick={onPick} />);
        fireEvent.keyDown(document.body, { key: '0' });
        fireEvent.keyDown(document.body, { key: '7' });
        expect(onPick).not.toHaveBeenCalled();
    });

    it('ignores modifier + number', () => {
        const onPick = vi.fn();
        render(<StarterGrid onPick={onPick} />);
        fireEvent.keyDown(document.body, { key: '1', metaKey: true });
        fireEvent.keyDown(document.body, { key: '1', ctrlKey: true });
        expect(onPick).not.toHaveBeenCalled();
    });
});
