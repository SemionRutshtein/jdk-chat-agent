export default function VersionSelector({ versions, current, onChange }) {
    return (
        <div className="relative">
            <select
                value={current}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none bg-paper-3 border border-rule hover:border-accent-soft focus-visible:border-accent text-ink text-xs font-medium font-mono uppercase tracking-wider rounded-input pl-3 pr-8 py-1.5 transition-colors duration-short ease-out cursor-pointer"
                aria-label="Java version"
            >
                {versions.map(v => (
                    <option key={v} value={v} className="bg-paper-2 text-ink">
                        Java {v}
                    </option>
                ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-[10px]">▾</span>
        </div>
    );
}
