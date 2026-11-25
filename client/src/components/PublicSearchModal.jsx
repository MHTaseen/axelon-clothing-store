import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import ProductCard from './ProductCard';

/**
 * Public Search Modal — Anyone visiting the website (no sign-in required)
 * can search across all products, sections, and visible fields.
 */
export default function PublicSearchModal({ isOpen, onClose, onAddToCart, onTextAdmin }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => setResults(d.results || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/75 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl border border-[#B8844E]/60">
        {/* Search Input Header */}
        <div className="flex items-center gap-3 bg-[#0F2557] px-5 py-4 text-white border-b border-[#B8844E]/40 shrink-0">
          <Search className="h-5 w-5 text-[#F2D5B1] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any product by name, size, color, category, or section..."
            className="flex-1 bg-transparent text-sm sm:text-base text-white placeholder:text-white/60 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-[#F2D5B1] hover:underline shrink-0"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:bg-white/10 hover:text-white shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5 axelon-glass-canvas">
          <div className="mb-4 text-xs font-bold uppercase tracking-wider text-[#F7DFBE]">
            {loading
              ? 'Searching...'
              : query.trim()
              ? `Found ${results.length} product(s) for "${query}"`
              : `All Available Products (${results.length})`}
          </div>

          {results.length === 0 && !loading ? (
            <div className="py-16 text-center text-sm text-[#E5C193]">
              No matching products found. Try another keyword.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {results.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  compact
                  onAddToCart={(p) => {
                    onClose();
                    onAddToCart(p);
                  }}
                  onTextAdmin={(p) => {
                    onClose();
                    onTextAdmin(p);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
