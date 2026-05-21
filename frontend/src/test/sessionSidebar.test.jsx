import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the API client
vi.mock('../api/client', () => ({
    chatAPI: {
        getSessions: vi.fn(),
    },
}));

import SessionSidebar, { bucketByDay } from '../components/SessionSidebar';
import { chatAPI } from '../api/client';

const makeSessions = (overrides = []) => overrides.map((o, i) => ({
    session_id: `sess-${i}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 2,
    last_java_version: '17',
    first_message: `Question about topic ${i}`,
    ...o,
}));

beforeEach(() => {
    chatAPI.getSessions.mockResolvedValue({ data: { sessions: [] } });
});

describe('SessionSidebar', () => {
    it('shows first_message as session title', async () => {
        chatAPI.getSessions.mockResolvedValue({
            data: { sessions: makeSessions([{ first_message: 'What is a lambda?' }]) },
        });
        render(
            <SessionSidebar
                currentSessionId="other"
                onSelectSession={() => {}}
                onNewSession={() => {}}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('What is a lambda?')).toBeInTheDocument();
        });
    });

    it('calls onSelectSession with correct session_id on click', async () => {
        const onSelect = vi.fn();
        chatAPI.getSessions.mockResolvedValue({
            data: { sessions: makeSessions([{ session_id: 'abc-123', first_message: 'Test session' }]) },
        });
        render(
            <SessionSidebar
                currentSessionId="different-session"
                onSelectSession={onSelect}
                onNewSession={() => {}}
            />
        );
        await waitFor(() => screen.getByText('Test session'));
        await userEvent.click(screen.getByText('Test session'));
        expect(onSelect).toHaveBeenCalledWith('abc-123');
    });

    it('calls onNewSession when New chat clicked', async () => {
        const onNew = vi.fn();
        render(
            <SessionSidebar
                currentSessionId="s"
                onSelectSession={() => {}}
                onNewSession={onNew}
            />
        );
        await userEvent.click(screen.getByText(/New chat/i));
        expect(onNew).toHaveBeenCalledTimes(1);
    });

    it('filters sessions by first_message text', async () => {
        chatAPI.getSessions.mockResolvedValue({
            data: {
                sessions: makeSessions([
                    { first_message: 'Lambda expressions' },
                    { first_message: 'Garbage collection' },
                ]),
            },
        });
        render(
            <SessionSidebar
                currentSessionId="x"
                onSelectSession={() => {}}
                onNewSession={() => {}}
            />
        );
        await waitFor(() => screen.getByText('Lambda expressions'));

        await userEvent.type(screen.getByPlaceholderText(/search/i), 'lambda');
        expect(screen.getByText('Lambda expressions')).toBeInTheDocument();
        expect(screen.queryByText('Garbage collection')).not.toBeInTheDocument();
    });

    it('shows empty state when no sessions', async () => {
        chatAPI.getSessions.mockResolvedValue({ data: { sessions: [] } });
        render(
            <SessionSidebar
                currentSessionId="x"
                onSelectSession={() => {}}
                onNewSession={() => {}}
            />
        );
        await waitFor(() => {
            expect(screen.getByText(/No sessions yet/i)).toBeInTheDocument();
        });
    });

    it('refreshes when refreshKey changes', async () => {
        chatAPI.getSessions.mockClear();
        chatAPI.getSessions.mockResolvedValue({ data: { sessions: [] } });
        const { rerender } = render(
            <SessionSidebar
                currentSessionId="x"
                onSelectSession={() => {}}
                onNewSession={() => {}}
                refreshKey={0}
            />
        );
        await waitFor(() => expect(chatAPI.getSessions).toHaveBeenCalledTimes(1));

        rerender(
            <SessionSidebar
                currentSessionId="x"
                onSelectSession={() => {}}
                onNewSession={() => {}}
                refreshKey={1}
            />
        );
        await waitFor(() => {
            expect(chatAPI.getSessions).toHaveBeenCalledTimes(2);
        });
    });
});
