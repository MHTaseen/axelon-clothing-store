import React from 'react';
import { MapPin, Navigation, ExternalLink, X } from 'lucide-react';

/**
 * Interactive Real Google Maps Popup Modal for AXELON Shop Location.
 * Displays a live embedded Google Map pinned to the shop's exact address/coordinates
 * and provides a direct "Get Directions in Google Maps" button for turn-by-turn navigation.
 */
export default function LocationMapModal({ isOpen, onClose, address, mapQuery }) {
  if (!isOpen) return null;

  const destination = (mapQuery || address || 'Bangladesh').trim();
  const encodedDest = encodeURIComponent(destination);

  // Real interactive Google Maps embed URL (no API key required, works on all devices)
  const embedSrc = `https://maps.google.com/maps?q=${encodedDest}&t=&z=16&ie=UTF8&iwloc=B&output=embed`;

  // Real Google Maps turn-by-turn Directions link (automatically uses the customer's live GPS as origin)
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDest}&travelmode=driving`;
  const openMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedDest}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/80 p-3 sm:p-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl border border-[#B8844E]/60">
        {/* Top Navy Blue Header */}
        <div className="flex items-center justify-between gap-3 bg-[#0F2557] px-5 py-4 text-white border-b border-[#B8844E]/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#B8844E]/20 border border-[#B8844E] text-[#F2D5B1]">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#F2D5B1] truncate">
                AXELON Shop Location
              </h3>
              <p className="text-xs text-white/80 truncate">{address || destination}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-red-600 transition shrink-0"
            aria-label="Close Map"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Interactive Google Map */}
        <div className="relative w-full h-[360px] sm:h-[460px] bg-[#EEF2F8]">
          <iframe
            title="AXELON Shop Google Map"
            src={embedSrc}
            className="h-full w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Bottom Action Bar with Direct Google Maps Turn-by-Turn Directions Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FBF8F4] px-5 py-4 border-t border-[#DBBB97] shrink-0">
          <div className="flex items-start gap-2 text-xs text-[#0F2557]">
            <MapPin className="h-4 w-4 text-[#9A6B3B] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Shop Address:</p>
              <p className="text-navy-700">{address || destination}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={openMapUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 border border-[#0F2557] bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F2557] hover:bg-[#DBBB97]/40 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>View on Google Maps</span>
            </a>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 bg-[#0F2557] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition shadow"
            >
              <Navigation className="h-4 w-4 text-[#D4A876]" />
              <span>Get Directions</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
