export default function VersionSelector({ versions, current, onChange }) {
    return (
        <select
            value={current}
            onChange={(e) => onChange(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        >
            {versions.map(v => (
                <option key={v} value={v}>Java {v}</option>
            ))}
        </select>
    );
}
