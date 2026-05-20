export default function CitationBadge({ citation }) {
    return (
        <div className="text-xs bg-gray-700 rounded px-2 py-1 inline-block hover:bg-gray-600 cursor-pointer">
            <span className="text-blue-300">{citation.text}</span>
            {citation.file_name && <span className="text-gray-400 ml-1">- {citation.file_name}</span>}
            {citation.page && <span className="text-gray-400 ml-1">pg. {citation.page}</span>}
        </div>
    );
}
