import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { searchApi, SearchResult } from "@/api/search";
import { Search, X, ArrowRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  a_faire: "bg-gray-100 text-gray-600",
  en_cours: "bg-blue-100 text-blue-700",
  termine: "bg-green-100 text-green-700",
  bloque: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  a_faire: "To do",
  en_cours: "In progress",
  termine: "Done",
  bloque: "Blocked",
};

interface SearchModalProps {
  onClose: () => void;
}

export function SearchModal({ onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.search(q.trim());
        setResults(data);
        setSelectedIndex(0);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [q]);

  const openTask = (r: SearchResult) => {
    navigate({ to: "/tickets/$ref", params: { ref: `${r.projectKey}-${r.number}` } });
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      openTask(results[selectedIndex]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search a task…"
            className="flex-1 text-sm outline-none placeholder-gray-400 text-gray-900"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => openTask(r)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex ? "bg-indigo-50" : "hover:bg-gray-50"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: r.projectColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        {r.projectKey}-{r.number}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 truncate mt-0.5">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.projectName}</p>
                  </div>
                  <ArrowRight size={14} className="text-gray-300 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : q.length >= 2 && !loading ? (
          <div className="py-10 text-center text-sm text-gray-400">No results for « {q} »</div>
        ) : q.length > 0 && q.length < 2 ? (
          <div className="py-6 text-center text-xs text-gray-400">Type at least 2 characters…</div>
        ) : (
          <div className="py-6 text-center text-xs text-gray-400">
            Raccourci : <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">/</kbd>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="px-1 bg-gray-100 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 bg-gray-100 rounded">↵</kbd> open</span>
          <span><kbd className="px-1 bg-gray-100 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
