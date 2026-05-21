import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
    try {
        if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
            localStorage.clear();
        }
    } catch {}
});

if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = () => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
    });
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
}
