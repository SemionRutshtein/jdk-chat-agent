import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageList, { STARTERS } from '../components/MessageList';

describe('MessageList — starters', () => {
    it('renders all starters as listitems when empty', () => {
        render(<MessageList messages={[]} loading={false} onPickStarter={() => {}} disabled={false} />);
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(STARTERS.length);
        expect(screen.getByText(STARTERS[0])).toBeInTheDocument();
    });

    it('invokes onPickStarter when starter button clicked', async () => {
        const pick = vi.fn();
        render(<MessageList messages={[]} loading={false} onPickStarter={pick} disabled={false} />);
        const target = screen.getByText(STARTERS[1]);
        await userEvent.click(target);
        expect(pick).toHaveBeenCalledWith(STARTERS[1]);
    });

    it('invokes onPickStarter when numeric hotkey pressed', () => {
        const pick = vi.fn();
        render(<MessageList messages={[]} loading={false} onPickStarter={pick} disabled={false} />);
        fireEvent.keyDown(window, { key: '3' });
        expect(pick).toHaveBeenCalledWith(STARTERS[2]);
    });

    it('does not show starters once a message has been sent', () => {
        render(
            <MessageList
                messages={[{ role: 'user', content: 'hi' }]}
                loading={false}
                onPickStarter={() => {}}
                disabled={false}
            />
        );
        expect(screen.queryByRole('list', { name: /Starter questions/i })).toBeNull();
    });

    it('starter buttons are tab-focusable', async () => {
        render(<MessageList messages={[]} loading={false} onPickStarter={() => {}} disabled={false} />);
        const buttons = screen.getAllByRole('listitem');
        await userEvent.tab();
        expect([buttons[0]]).toContain(document.activeElement);
    });
});
