import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CitationBadge from '../components/CitationBadge';

describe('CitationBadge', () => {
    it('renders Java 8 JLS label from filename', () => {
        render(<CitationBadge citation={{ file_name: 'java-8-jls.pdf', page: 42 }} />);
        expect(screen.getByText(/Java 8/)).toBeInTheDocument();
        expect(screen.getByText(/Language Spec/)).toBeInTheDocument();
        expect(screen.getByText(/p\.42/)).toBeInTheDocument();
    });

    it('renders JVM spec label', () => {
        render(<CitationBadge citation={{ file_name: 'java-17-jvms.pdf', page: 7 }} />);
        expect(screen.getByText(/Java 17/)).toBeInTheDocument();
        expect(screen.getByText(/JVM Spec/)).toBeInTheDocument();
    });

    it('falls back to filename without .pdf when format unknown', () => {
        render(<CitationBadge citation={{ file_name: 'custom-doc.pdf' }} />);
        expect(screen.getByText('custom-doc')).toBeInTheDocument();
    });

    it('omits page span when page is missing', () => {
        render(<CitationBadge citation={{ file_name: 'java-21-jls.pdf' }} />);
        expect(screen.queryByText(/p\./)).toBeNull();
    });

    it('renders generic "Doc" when filename is null', () => {
        render(<CitationBadge citation={{}} />);
        expect(screen.getByText('Doc')).toBeInTheDocument();
    });
});
