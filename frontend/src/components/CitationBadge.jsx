const FILE_LABELS = {
    'jls': 'Language Spec',
    'jvms': 'JVM Spec',
};

function getLabel(fileName) {
    if (!fileName) return 'Doc';
    const match = fileName.match(/java-(\d+)-(jls|jvms)\.pdf/);
    if (match) return `Java ${match[1]} ${FILE_LABELS[match[2]] || match[2]}`;
    return fileName.replace('.pdf', '');
}

export default function CitationBadge({ citation }) {
    const label = getLabel(citation.file_name);
    return (
        <span className="inline-flex items-center gap-1 text-xs bg-gray-900 border border-gray-700 rounded-full px-2.5 py-1 text-gray-300 hover:border-blue-600 hover:text-blue-300 transition cursor-default">
            <span className="text-gray-500">📄</span>
            <span className="font-medium">{label}</span>
            {citation.page && <span className="text-gray-500">p.{citation.page}</span>}
        </span>
    );
}
