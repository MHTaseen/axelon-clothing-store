import React, { useState } from 'react';
import { ShoppingBag, MessageSquare, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

/**
 * Product card used inside the horizontal "train buggy" slider, the "See Products" popup,
 * and dedicated Category Pages.
 * Rule: NEVER display any field whose label contains "description", and only display fields
 * where visibleToClient !== false. Includes quantity selector before Add to Cart.
 */
export default function ProductCard({ product, onAddToCart, onTextAdmin, compact = false }) {
  const images = product.images && product.images.length > 0 ? product.images : [];
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);

  const visibleFields = (product.fields || []).filter((f) => {
    const labelLower = (f.label || '').toLowerCase();
    if (labelLower.includes('description')) return false;
    return f.visibleToClient !== false && String(f.value || '').trim().length > 0;
  });

  return (
    <div
      className={`group flex flex-col rounded-2xl glass-card transition-all duration-300 hover:-translate-y-1.5 overflow-hidden ${
        compact ? 'w-full' : 'w-[245px] xs:w-[265px] sm:w-[285px] shrink-0 snap-start'
      }`}
    >
      {/* Multi-photo Product Image Frame */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0A1736]/80">
        {images[imgIndex] ? (
          <img
            src={images[imgIndex]}
            alt={product.name}
            className="h-full w-full object-cover object-top group-hover:scale-105 transition duration-700"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-[#F2D5B1]/60">
            No Photo
          </div>
        )}

        {/* Subtle Top Glass Sheen */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050C1D]/70 via-transparent to-white/10" />

        {/* Photo Switcher Arrows if multiple photos were uploaded */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImgIndex((prev) => (prev - 1 + images.length) % images.length);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full glass-navy text-[#F2D5B1] hover:bg-[#D4A876] hover:text-[#060F24] transition"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImgIndex((prev) => (prev + 1) % images.length);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full glass-navy text-[#F2D5B1] hover:bg-[#D4A876] hover:text-[#060F24] transition"
              aria-label="Next photo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === imgIndex ? 'w-4 bg-[#E5C193]' : 'w-1.5 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Product Info + Admin-Selected Visible Fields (Crystal Glass Interior) */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-bold text-silver-chrome leading-snug line-clamp-2 drop-shadow-sm">
            {product.name}
          </h3>

          <div className="inline-block rounded-full glass-silver px-3 py-0.5 text-sm font-extrabold text-white">
            TK {Number(product.price || 0).toLocaleString()}
          </div>

          {visibleFields.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-200/20">
              {visibleFields.map((field) => (
                <div key={field.id || field.label} className="flex items-start justify-between gap-2 text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-slate-300 shrink-0">
                    {field.label}:
                  </span>
                  <span className="text-white/95 font-medium text-right break-words">
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quantity Selector + Two Mandatory Buttons: Add to Cart & Text Admin */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200/20">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold uppercase tracking-wider text-slate-300">Quantity:</span>
            <div className="flex items-center rounded-lg glass-silver">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-2 py-1 text-slate-100 hover:bg-white/20 transition rounded-l-lg"
                aria-label="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="px-2.5 text-xs font-extrabold text-white">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-2 py-1 text-slate-100 hover:bg-white/20 transition rounded-r-lg"
                aria-label="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAddToCart(product, qty)}
              className="inline-flex items-center justify-center gap-1 rounded-xl glass-gold-btn py-2.5 px-2 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#060F24] transition"
            >
              <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
              <span>Add to Cart</span>
            </button>

            <button
              type="button"
              onClick={() => onTextAdmin(product)}
              className="inline-flex items-center justify-center gap-1 rounded-xl glass-silver py-2.5 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white transition"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span>Text Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
