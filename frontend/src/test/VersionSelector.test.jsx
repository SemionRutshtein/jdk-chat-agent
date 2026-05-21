import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionSelector from '../components/VersionSelector';

describe('VersionSelector', () => {
    it('renders all supplied versions', () => {
        render(<VersionSelector versions={['8', '17', '21']} current="17" onChange={() => {}} />);
        const select = screen.getByLabelText(/Java version/i);
        expect(select).toBeInTheDocument();
        expect(select.value).toBe('17');
        expect(screen.getByRole('option', { name: 'Java 8' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Java 21' })).toBeInTheDocument();
    });

    it('calls onChange with new value when user picks', () => {
        const onChange = vi.fn();
        render(<VersionSelector versions={['8', '17', '21']} current="8" onChange={onChange} />);
        const select = screen.getByLabelText(/Java version/i);
        fireEvent.change(select, { target: { value: '21' } });
        expect(onChange).toHaveBeenCalledWith('21');
    });
});
