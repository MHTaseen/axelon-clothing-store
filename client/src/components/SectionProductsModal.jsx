import React from 'react';
import { X } from 'lucide-react';
import ProductCard from './ProductCard';

export default function SectionProductsModal({ section, onClose, onAddToCart, onTextAdmin }) {
  if (!section) return null;
  const products = section.resolvedProducts || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A202C]/60 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl border border-[#A3AABE]/70">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 glass-biscuit px-5 sm:px-7 py-4 text-white border-x-0 border-t-0 border-b border-white/30 shrink-0">
          <div className="min-w-0">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-shiny-white truncate">
              {section.name} ({products.length})
            </h2>
            {section.subheading && (
              <p className="text-xs text-[#F7E5CA] mt-0.5 truncate">{section.subheading}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-white hover:bg-white/20 transition shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* All Products Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 axelon-glass-canvas">
          {products.length === 0 ? (
            <div className="py-16 text-center text-sm font-medium text-[#55607A]">
              No products added to this section yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  compact
                  onAddToCart={onAddToCart}
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
