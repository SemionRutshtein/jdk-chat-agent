/* Hallmark · genre: atmospheric · macrostructure: Workbench · theme: custom (dark/red)
 * paper oklch(14% 0.01 20) · accent oklch(62% 0.22 25) signal-red
 * Inter Tight (display) + Inter (body) + JetBrains Mono · designed-as-app
 */
export default {
    content: ["./index.html", "./src/**/*.{js,jsx}"],
    theme: {
        extend: {
            colors: {
                paper: {
                    DEFAULT: 'oklch(14% 0.01 20)',
                    2: 'oklch(18% 0.012 20)',
                    3: 'oklch(22% 0.014 20)',
                    4: 'oklch(28% 0.016 20)',
                },
                ink: {
                    DEFAULT: 'oklch(96% 0.005 20)',
                    2: 'oklch(78% 0.008 20)',
                    3: 'oklch(58% 0.01 20)',
                    4: 'oklch(40% 0.012 20)',
                },
                rule: {
                    DEFAULT: 'oklch(28% 0.014 20)',
                    2: 'oklch(34% 0.016 20)',
                },
                accent: {
                    DEFAULT: 'oklch(62% 0.22 25)',
                    ink: 'oklch(99% 0.005 20)',
                    deep: 'oklch(48% 0.18 25)',
                    soft: 'oklch(38% 0.12 25)',
                    glow: 'oklch(72% 0.20 25)',
                },
                focus: 'oklch(68% 0.20 25)',
                ok: 'oklch(70% 0.18 145)',
                warn: 'oklch(78% 0.18 80)',
            },
            fontFamily: {
                display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
                body: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                card: '14px',
                pill: '999px',
                input: '10px',
            },
            transitionTimingFunction: {
                out: 'cubic-bezier(0.16, 1, 0.3, 1)',
                in: 'cubic-bezier(0.7, 0, 0.84, 0)',
                'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
            },
            transitionDuration: {
                short: '220ms',
                med: '340ms',
            },
            keyframes: {
                'fade-up': {
                    '0%': { opacity: 0, transform: 'translateY(6px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
                'pulse-red': {
                    '0%, 100%': { boxShadow: '0 0 0 0 oklch(62% 0.22 25 / 0.5)' },
                    '50%': { boxShadow: '0 0 0 6px oklch(62% 0.22 25 / 0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            animation: {
                'fade-up': 'fade-up 220ms cubic-bezier(0.16,1,0.3,1) both',
                'pulse-red': 'pulse-red 2s cubic-bezier(0.16,1,0.3,1) infinite',
                shimmer: 'shimmer 1.6s linear infinite',
            },
        },
    },
    plugins: [],
}
