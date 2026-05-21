const FILE_LABELS = {
    'jls': 'Language Spec',
    'jvms': 'JVM Spec',
};

function getLabel(fileName) {
    if (!fileName) return 'Doc';
    const match = fileName.match(/java-(\d+)-(jls|jvms)\.pdf/);
    if (match) return `Java ${match[1]} · ${FILE_LABELS[match[2]] || match[2]}`;
    return fileName.replace('.pdf', '');
}

export default function CitationBadge({ citation }) {
    const label = getLabel(citation.file_name);
    return (
        <span className="chip font-mono group hover:border-accent transition-colors duration-short ease-out">
            <span className="w-1 h-1 rounded-full bg-accent group-hover:bg-accent-glow transition-colors" />
            <span className="font-medium text-ink-2 group-hover:text-ink">{label}</span>
            {citation.page && (
                <span className="text-ink-4">p.{citation.page}</span>
            )}
        </span>
    );
}
