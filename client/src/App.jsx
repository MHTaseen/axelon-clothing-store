import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  User,
  Search,
  ShoppingBag,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  SlidersHorizontal,
  LogOut,
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Globe,
  MessageCircle,
  Link as LinkIcon,
  Layers,
  Package,
  AlertTriangle,
  MapPin
} from 'lucide-react';

import ProductCard from './components/ProductCard';
import SectionProductsModal from './components/SectionProductsModal';
import CartBookingDrawer from './components/CartBookingDrawer';
import MessengerModal from './components/MessengerModal';
import AdminWorkspaceModal from './components/AdminWorkspaceModal';
import AuthModal from './components/AuthModal';
import PublicSearchModal from './components/PublicSearchModal';
import LocationMapModal from './components/LocationMapModal';
import { safeHref } from './utils/safeUrl';

function ProductTrainSection({ section, onSeeAll, onAddToCart, onTextAdmin }) {
  const scrollRef = useRef(null);
  const products = section.resolvedProducts || [];

  const slideTrain = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <section
      id={section.id}
      className="w-full py-12 sm:py-16 border-b border-slate-200/15"
    >
      <div className="w-full px-4 sm:px-8 lg:px-12">
        {/* Section Heading + Small Subheading + "See Products" Link + Train Arrows */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="relative pl-4 border-l-4 border-slate-200/80 shadow-[-4px_0_16px_rgba(226,232,240,0.2)]">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-silver-chrome tracking-wide drop-shadow-sm">
              {section.name}
            </h2>
            {section.subheading && (
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                {section.subheading}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onSeeAll(section)}
              className="rounded-full glass-silver px-5 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition"
            >
              See Products ({products.length})
            </button>

            {products.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={() => slideTrain(-1)}
                  className="p-2 rounded-full glass-silver text-slate-100 hover:text-white transition"
                  aria-label="Slide Left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => slideTrain(1)}
                  className="p-2 rounded-full glass-silver text-slate-100 hover:text-white transition"
                  aria-label="Slide Right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Horizontal Sliding "Train Buggies" Product Track */}
        {products.length === 0 ? (
          <div className="rounded-2xl glass-navy py-12 text-center text-xs text-slate-300">
            No products in "{section.name}" yet.
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'thin' }}
          >
            {products.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                onAddToCart={onAddToCart}
                onTextAdmin={onTextAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const [siteConfig, setSiteConfig] = useState({
    topAnnouncementBar: {
      enabled: true,
      message:
        'Welcome to Our New 2026 Collection — Free Express Home Delivery Across Bangladesh on Orders Over TK 3,000'
    },
    mainNavbar: {
      enabled: true,
      logoUrl: '/images/axelon-logo.png',
      brandName: 'AXELON',
      centerButtonLabel: 'Our Collections',
      showMessageButton: true,
      showAuthButton: true,
      showSearchButton: true,
      showCartButton: true
    },
    brandBannerBar: {
      enabled: true,
      logoUrl: '/images/axelon-logo.png',
      brandName: 'AXELON'
    },
    newsBulletin: {
      enabled: true,
      items: [
        'New Winter 2026 Luxury Collection is now officially live across Bangladesh',
        'Free express home delivery on all orders above TK 3,000',
        'Easy 72-hour size exchange guarantee on every purchase',
        'Cash on Delivery available nationwide in all 64 districts',
        'Custom size & tailoring requests available directly through our Admin'
      ]
    },
    footer: {
      enabled: true,
      sections: [
        { id: 'ft-contact', title: 'Contact', content: '' },
        { id: 'ft-location', title: 'Location', content: '' },
        {
          id: 'ft-about',
          title: 'About Us',
          content: 'AXELON is a modern luxury apparel store delivering premium quality fabrics, tailored silhouettes, and direct customer care across Bangladesh.'
        },
        {
          id: 'ft-privacy',
          title: 'Privacy & Policy',
          content: 'Your personal details, orders, and messages are sent over HTTPS, stored encrypted at rest, are only visible to you and the store admin, and are never sold or shared with third parties.'
        }
      ],
      linksSectionTitle: 'Links',
      showLinksSection: true,
      socialLinks: [
        { id: 'soc-fb', label: 'Facebook', icon: 'facebook', url: 'https://facebook.com' },
        { id: 'soc-ig', label: 'Instagram', icon: 'instagram', url: 'https://instagram.com' },
        { id: 'soc-tw', label: 'Twitter', icon: 'twitter', url: 'https://twitter.com' }
      ],
      copyright: '@AXELON All rights Reserved'
    }
  });

  const [sections, setSections] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [storeStats, setStoreStats] = useState({ totalCategories: 0, totalProducts: 0 });
  const [socket, setSocket] = useState(null);

  // Navigation: Dedicated Category Page view (null = Home Page, sectionId = Dedicated Category Page with Back Button)
  const [activeCategoryPageId, setActiveCategoryPageId] = useState(null);
  const [showCollectionsDropdown, setShowCollectionsDropdown] = useState(false);

  // Duplicate Cart Warning Banner
  const [cartWarning, setCartWarning] = useState('');

  // Unified Auth State (Single Master Admin + Verified Customer Accounts)
  // The session lives in a secure HttpOnly cookie that JavaScript cannot read;
  // we only keep the public profile in memory and ask the server who we are on load.
  const [currentUser, setCurrentUser] = useState(null);
  const authToken = currentUser ? 'cookie-session' : '';
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeLocationMap, setActiveLocationMap] = useState(null);

  const isAdmin = currentUser?.role === 'admin';

  // Client identity for Cart Booking (auto-fills from signed-in user)
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setAuthNotice('');
    setClientName(user.fullName || '');
    setClientPhone(user.phone || '');
    setClientEmail(user.email || '');
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setCurrentUser(null);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setIsMessengerOpen(false);
    setIsAdminWorkspaceOpen(false);
  };

  // Restore the signed-in session (if any) and remove data older versions stored in the browser
  useEffect(() => {
    ['axelon_auth_token', 'axelon_user', 'axelon_client_id', 'axelon_client_name', 'axelon_client_phone', 'axelon_client_email'].forEach(
      (k) => localStorage.removeItem(k)
    );
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) handleAuthSuccess(d.user);
      })
      .catch(() => {});
  }, []);

  // Cart State
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('axelon_cart') || '[]');
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // "See Products" Popup State
  const [activePopupSection, setActivePopupSection] = useState(null);

  // Messenger State (Direct Chat OR Product Inquiry Chat)
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [inquiredProduct, setInquiredProduct] = useState(null);
  const [messengerAdminMode, setMessengerAdminMode] = useState(false);

  // Admin Workspace Modal (opened discreetly via floating bottom-right gear pill for testing until Admin auth is added)
  const [isAdminWorkspaceOpen, setIsAdminWorkspaceOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('axelon_cart', JSON.stringify(cart));
  }, [cart]);

  // Lock background page scrolling whenever ANY modal or drawer is open (prevents ghost background scrollbar!)
  const anyOverlayOpen =
    isAdminWorkspaceOpen ||
    isMessengerOpen ||
    isCartOpen ||
    isAuthModalOpen ||
    isSearchOpen ||
    Boolean(activeLocationMap) ||
    Boolean(activePopupSection);

  useEffect(() => {
    if (anyOverlayOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [anyOverlayOpen]);

  const applyBootstrap = (data) => {
    if (data?.config) {
      setSiteConfig((prev) => ({
        ...prev,
        ...data.config,
        mainNavbar: { ...prev.mainNavbar, ...(data.config.mainNavbar || {}) },
        brandBannerBar: { ...prev.brandBannerBar, ...(data.config.brandBannerBar || {}) },
        newsBulletin: { ...prev.newsBulletin, ...(data.config.newsBulletin || {}) },
        footer: { ...prev.footer, ...(data.config.footer || {}) }
      }));
    }
    if (Array.isArray(data?.sections)) setSections(data.sections);
    if (Array.isArray(data?.allProducts)) setAllProducts(data.allProducts);
    if (data?.stats) setStoreStats(data.stats);
  };

  // (Re)load the catalog and (re)connect the real-time socket whenever the signed-in user changes,
  // so the socket is always authenticated as the current user (or as a guest).
  useEffect(() => {
    fetch('/api/bootstrap')
      .then((res) => res.json())
      .then(applyBootstrap)
      .catch(() => {});

    const s = io('/', { transports: ['websocket', 'polling'], withCredentials: true });
    setSocket(s);
    s.on('site:updated', applyBootstrap);

    return () => s.disconnect();
  }, [currentUser?.id]);

  // Strict Duplicate-Product Cart Rule:
  // If same product is already in cart, warn the client and do NOT add a duplicate entry;
  // allow them to adjust quantity inside the cart or via the quantity picker.
  const handleAddToCart = (prod, quantityToAdd = 1) => {
    const qty = Math.max(1, Number(quantityToAdd) || 1);
    const alreadyExists = cart.some((i) => i.id === prod.id);
    if (alreadyExists) {
      setCartWarning(
        `"${prod.name}" is already in your cart! The same product cannot be added twice — please change its quantity directly inside your Cart.`
      );
      setIsCartOpen(true);
      setTimeout(() => setCartWarning(''), 6000);
      return;
    }

    setCartWarning('');
    setCart((prev) => [
      ...prev,
      {
        id: prod.id,
        name: prod.name,
        price: Number(prod.price || 0),
        image: prod.images?.[0] || '',
        quantity: qty
      }
    ]);
    setIsCartOpen(true);
  };

  const updateCartQuantity = (id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== id));
    } else {
      setCart((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
    }
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  // Open Messenger ONLY for signed-in users; prompt guests to Sign In / Register first
  const handleOpenMessenger = (productToInquire = null) => {
    if (!currentUser || !authToken) {
      setAuthNotice('Please Sign In or Register a verified account to message AXELON Admin.');
      setIsAuthModalOpen(true);
      return;
    }
    setInquiredProduct(productToInquire);
    setIsMessengerOpen(true);
  };

  const handleTextAdminWithProduct = (prod) => {
    handleOpenMessenger(prod);
  };

  const announcement = siteConfig?.topAnnouncementBar;
  const navbar = siteConfig?.mainNavbar;
  const brandBanner = siteConfig?.brandBannerBar;
  const bulletin = siteConfig?.newsBulletin;
  const footer = siteConfig?.footer;
  const totalCartItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  // Categories created by Admin (for "Our Collections" dropdown menu & stats)
  const adminCategories = sections.filter((s) => !s.isMandatory && s.id !== 'sec-collection');
  const homepageSections = sections.filter((s) => s.showOnHomepage !== false);
  const activeCategoryPage = sections.find((s) => s.id === activeCategoryPageId) || null;

  return (
    <div className="min-h-screen axelon-glass-canvas text-white flex flex-col">
      {/* 1. Full-Width Topmost Admin Announcement Bar (Frosted Navy & Silver Glass) */}
      {announcement?.enabled !== false && (
        <div
          role="banner"
          className="w-full glass-navy px-4 sm:px-8 lg:px-12 py-2.5 text-center border-x-0 border-t-0"
        >
          <p className="w-full text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-slate-100 leading-relaxed">
            {announcement?.message}
          </p>
        </div>
      )}

      {/* 2. Main Navigation Bar (Frosted Biscuit Glass | Zero-Overlap Responsive Layout) */}
      {navbar?.enabled !== false && (
        <header className="sticky top-0 z-40 w-full glass-biscuit">
          {/* Row 1: Logo Left | "Our Collections" Center (md+) | Utility Icons Right */}
          <div className="flex md:grid md:grid-cols-3 items-center justify-between w-full px-3 sm:px-6 lg:px-12 h-14 sm:h-16 md:h-20 gap-2">
            {/* Leftmost: AXELON Name & Logo (Click returns to Homepage) */}
            <div className="flex items-center justify-start min-w-0 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveCategoryPageId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center group"
                aria-label={navbar?.brandName || 'AXELON'}
              >
                <img
                  src={navbar?.logoUrl || '/images/axelon-logo.png'}
                  alt={navbar?.brandName || 'AXELON'}
                  className="h-5 sm:h-7 md:h-8 w-auto max-w-[115px] sm:max-w-[150px] md:max-w-none object-contain transition-opacity group-hover:opacity-80"
                />
              </button>
            </div>

            {/* Center (Desktop/Tablet md+): "Our Collections" Hover/Click Dropdown */}
            <div
              className="hidden md:flex relative items-center justify-center"
              onMouseEnter={() => setShowCollectionsDropdown(true)}
              onMouseLeave={() => setShowCollectionsDropdown(false)}
            >
              <button
                type="button"
                onClick={() => setShowCollectionsDropdown((prev) => !prev)}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-navy-950 border-b-2 border-transparent hover:border-navy-950 transition whitespace-nowrap"
              >
                <span>{navbar?.centerButtonLabel || 'Our Collections'}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </button>

              {showCollectionsDropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-64 bg-white border border-[#B8844E]/60 shadow-2xl py-2 z-50">
                  <div className="px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#9A6B3B] border-b border-[#DBBB97]/40">
                    Browse Categories
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategoryPageId('sec-collection');
                      setShowCollectionsDropdown(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold text-[#0F2557] hover:bg-[#FBF6F0] transition"
                  >
                    <span>All Products (Our Collection)</span>
                    <span className="text-[10px] font-semibold text-[#9A6B3B]">{allProducts.length}</span>
                  </button>
                  {adminCategories.length === 0 ? (
                    <div className="px-4 py-2.5 text-[11px] text-navy-500">
                      No categories created yet.
                    </div>
                  ) : (
                    adminCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setActiveCategoryPageId(cat.id);
                          setShowCollectionsDropdown(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-[#0F2557] hover:bg-[#0F2557] hover:text-[#F2D5B1] transition"
                      >
                        <span className="truncate">{cat.name}</span>
                        <span className="text-[10px] opacity-80 shrink-0 ml-2">
                          {(cat.resolvedProducts || []).length}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Rightmost: Message Icon, Reg/Sign In Icon, Search Icon, Cart Icon */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-2 shrink-0">
              {navbar?.showMessageButton !== false && (
                <button
                  type="button"
                  onClick={() => handleOpenMessenger(null)}
                  title={currentUser ? 'Messages (Live Chat)' : 'Sign In to Message Admin'}
                  aria-label="Messages"
                  className="p-2 rounded-full text-navy-950 hover:bg-navy-950/10 transition"
                >
                  <MessageSquare className="h-[18px] w-[18px] sm:h-5 sm:w-5 stroke-[1.85]" />
                </button>
              )}

              {navbar?.showAuthButton !== false && (
                !currentUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthNotice('');
                      setIsAuthModalOpen(true);
                    }}
                    title="Reg / Sign In"
                    aria-label="Reg / Sign In"
                    className="p-2 rounded-full text-navy-950 hover:bg-navy-950/10 transition"
                  >
                    <User className="h-[18px] w-[18px] sm:h-5 sm:w-5 stroke-[1.85]" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="hidden lg:inline-block text-[11px] font-bold text-[#0F2557] max-w-[110px] truncate">
                      {currentUser.fullName}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      title="Sign Out"
                      aria-label="Sign Out"
                      className="p-2 rounded-full text-red-700 hover:bg-red-600 hover:text-white transition"
                    >
                      <LogOut className="h-[18px] w-[18px] stroke-[2]" />
                    </button>
                  </div>
                )
              )}

              {navbar?.showSearchButton !== false && (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  title="Search Products"
                  aria-label="Search"
                  className="p-2 rounded-full text-navy-950 hover:bg-navy-950/10 transition"
                >
                  <Search className="h-[18px] w-[18px] sm:h-5 sm:w-5 stroke-[1.85]" />
                </button>
              )}

              {navbar?.showCartButton !== false && (
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  title="Cart & Booking Slip"
                  aria-label="Cart"
                  className="relative p-2 rounded-full text-navy-950 hover:bg-navy-950/10 transition"
                >
                  <ShoppingBag className="h-[18px] w-[18px] sm:h-5 sm:w-5 stroke-[1.85]" />
                  {totalCartItems > 0 && (
                    <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0F2557] px-1 text-[10px] font-bold text-[#F2D5B1]">
                      {totalCartItems}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Mobile Row 2 (< md): Clean Dedicated Centered "Our Collections" Bar — Zero Overlap on Any Phone */}
          <div className="flex md:hidden relative items-center justify-center border-t border-navy-950/10 py-1.5 px-3">
            <button
              type="button"
              onClick={() => setShowCollectionsDropdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-navy-950"
            >
              <span>{navbar?.centerButtonLabel || 'Our Collections'}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCollectionsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showCollectionsDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-[90vw] max-w-xs bg-white border border-[#B8844E]/60 shadow-2xl py-2 z-50">
                <div className="px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[#9A6B3B] border-b border-[#DBBB97]/40">
                  Browse Categories
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategoryPageId('sec-collection');
                    setShowCollectionsDropdown(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold text-[#0F2557] hover:bg-[#FBF6F0] transition"
                >
                  <span>All Products (Our Collection)</span>
                  <span className="text-[10px] font-semibold text-[#9A6B3B]">{allProducts.length}</span>
                </button>
                {adminCategories.length === 0 ? (
                  <div className="px-4 py-2.5 text-[11px] text-navy-500">
                    No categories created yet.
                  </div>
                ) : (
                  adminCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryPageId(cat.id);
                        setShowCollectionsDropdown(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-semibold text-[#0F2557] hover:bg-[#0F2557] hover:text-[#F2D5B1] transition"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] opacity-80 shrink-0 ml-2">
                        {(cat.resolvedProducts || []).length}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </header>
      )}

      {/* Duplicate Cart Warning Toast */}
      {cartWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg bg-amber-50 border-2 border-amber-500 px-4 py-3 text-xs font-bold text-amber-950 shadow-2xl flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="flex-1 leading-relaxed">{cartWarning}</span>
          <button type="button" onClick={() => setCartWarning('')} className="font-extrabold text-amber-900">
            ✕
          </button>
        </div>
      )}

      {/* CONDITIONAL VIEW: Dedicated Category Page (with Back to Home Button) OR Main Homepage */}
      {activeCategoryPage ? (
        <main className="flex-1 w-full px-4 sm:px-8 lg:px-12 py-10 sm:py-14">
          {/* Back Button + Category Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200/20">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveCategoryPageId(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 rounded-full glass-gold-btn px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-[#060F24] transition mb-3"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </button>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold text-silver-chrome">
                {activeCategoryPage.name}
              </h1>
              {activeCategoryPage.subheading && (
                <p className="text-xs sm:text-sm text-slate-300 font-medium">
                  {activeCategoryPage.subheading}
                </p>
              )}
            </div>
            <div className="rounded-full glass-silver text-xs font-extrabold uppercase tracking-widest text-white px-5 py-2.5 self-start sm:self-end">
              {(activeCategoryPage.resolvedProducts || []).length} Product(s)
            </div>
          </div>

          {/* All Products of This Category in Responsive Grid (With Add to Cart + Quantity + Text Admin) */}
          {(activeCategoryPage.resolvedProducts || []).length === 0 ? (
            <div className="rounded-2xl glass-navy py-16 text-center text-sm text-[#E5C193]">
              No products have been added to "{activeCategoryPage.name}" yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {(activeCategoryPage.resolvedProducts || []).map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  compact
                  onAddToCart={handleAddToCart}
                  onTextAdmin={handleTextAdminWithProduct}
                />
              ))}
            </div>
          )}
        </main>
      ) : (
        <>
          {/* 3. Triple-Thickness (+30%) Liquid Glass Brand Showcase Banner */}
          {brandBanner?.enabled !== false && (
            <section
              id="top"
              className="relative overflow-hidden w-full h-[230px] sm:h-[320px] flex items-center justify-center px-6"
            >
              {/* Floating Ambient Silver, Gold & Cobalt Glass Orbs */}
              <div className="animate-orb pointer-events-none absolute -top-12 left-[12%] h-56 w-56 rounded-full bg-slate-200/25 blur-3xl" />
              <div className="animate-orb pointer-events-none absolute top-8 left-[45%] h-48 w-48 rounded-full bg-[#D4A876]/25 blur-3xl" />
              <div className="animate-orb pointer-events-none absolute -bottom-16 right-[14%] h-64 w-64 rounded-full bg-[#2453B8]/40 blur-3xl" />

              {/* Frosted Biscuit-Silver Glass Floating Plaque */}
              <div className="relative z-10 rounded-3xl glass-biscuit px-10 sm:px-20 py-8 sm:py-12 flex items-center justify-center border border-slate-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.52),0_0_32px_rgba(226,232,240,0.18)]">
                <img
                  src={brandBanner?.logoUrl || '/images/axelon-logo.png'}
                  alt={brandBanner?.brandName || 'AXELON'}
                  className="h-12 sm:h-20 md:h-24 w-auto max-w-[75vw] object-contain drop-shadow-[0_4px_14px_rgba(15,37,87,0.22)]"
                />
              </div>
            </section>
          )}

          {/* 4. News Bulletin Ticker Section (Frosted Smoked-Navy & Silver Crystal Strip) */}
          {bulletin?.enabled !== false && (bulletin?.items || []).length > 0 && (
            <section
              aria-label="News Bulletin"
              className="w-full glass-navy border-x-0 overflow-hidden flex items-center"
            >
              <div className="flex-1 overflow-hidden py-3">
                <div className="animate-bulletin flex items-center">
                  {[...(bulletin?.items || []), ...(bulletin?.items || [])].map((item, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-3 px-6 text-xs sm:text-[13px] font-medium tracking-wide text-slate-100 whitespace-nowrap"
                    >
                      <span
                        className={`h-2 w-2 rotate-45 shrink-0 ${
                          idx % 2 === 0
                            ? 'bg-slate-200 shadow-[0_0_8px_rgba(241,245,249,0.9)]'
                            : 'bg-[#E5C193] shadow-[0_0_8px_rgba(229,193,147,0.85)]'
                        }`}
                      />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 5. Mandatory "Our Collection" (All Products Together) + Admin Homepage-Enabled Category Sections */}
          <main className="flex-1">
            {homepageSections.map((section) => (
              <ProductTrainSection
                key={section.id}
                section={section}
                onSeeAll={setActivePopupSection}
                onAddToCart={handleAddToCart}
                onTextAdmin={handleTextAdminWithProduct}
              />
            ))}
          </main>
        </>
      )}

      {/* 6. Dynamic Admin-Controlled Footer Section (Frosted Crystal Navy Glass) */}
      {footer?.enabled !== false && (
        <footer className="w-full glass-navy border-x-0 border-b-0 text-white mt-auto">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-12">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 pb-10 border-b border-[#B8844E]/30">
              {/* Dynamic Footer Sections (Spread cleanly across available width; Location opens live Google Map popup) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 flex-1">
                {(footer?.sections || []).map((sec) => {
                  const isLocation =
                    sec.id === 'ft-location' || (sec.title || '').toLowerCase().includes('location');
                  return (
                    <div key={sec.id} className="space-y-2.5">
                      <h4 className="font-serif text-lg font-bold tracking-wider uppercase text-[#F2D5B1]">
                        {sec.title}
                      </h4>
                      {isLocation ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveLocationMap({
                              address: sec.content,
                              mapQuery: footer?.mapQuery || sec.content
                            })
                          }
                          className="group text-left space-y-1.5"
                          title="Click to open real Google Map & Get Directions"
                        >
                          <p className="text-xs text-white/90 group-hover:text-[#F2D5B1] leading-relaxed whitespace-pre-line break-words underline decoration-[#B8844E]/60 underline-offset-4 transition">
                            {sec.content}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#D4A876] group-hover:text-white transition">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>View Live Google Map & Directions</span>
                          </span>
                        </button>
                      ) : (
                        <p className="text-xs text-white/85 leading-relaxed whitespace-pre-line break-words">
                          {sec.content}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Social Links Section ("Links") Anchored to the Rightmost Corner */}
              {footer?.showLinksSection !== false && (
                <div className="space-y-3 shrink-0 lg:text-right lg:ml-8">
                  <h4 className="font-serif text-lg font-bold tracking-wider uppercase text-[#F2D5B1]">
                    {footer?.linksSectionTitle || 'Links'}
                  </h4>
                  <div className="flex flex-wrap items-center lg:justify-end gap-2.5">
                    {(footer?.socialLinks || []).map((link) => {
                      const renderSocialIcon = (iconKey) => {
                        switch ((iconKey || '').toLowerCase()) {
                          case 'facebook':
                            return <Facebook className="h-4 w-4" />;
                          case 'instagram':
                            return <Instagram className="h-4 w-4" />;
                          case 'twitter':
                            return <Twitter className="h-4 w-4" />;
                          case 'youtube':
                            return <Youtube className="h-4 w-4" />;
                          case 'linkedin':
                            return <Linkedin className="h-4 w-4" />;
                          case 'whatsapp':
                            return <MessageCircle className="h-4 w-4" />;
                          case 'website':
                            return <Globe className="h-4 w-4" />;
                          default:
                            return <LinkIcon className="h-4 w-4" />;
                        }
                      };
                      return (
                        <a
                          key={link.id}
                          href={safeHref(link.url)}
                          target="_blank"
                          rel="noreferrer"
                          title={link.label}
                          aria-label={link.label}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-[#B8844E]/60 bg-[#060F24]/50 text-[#F2D5B1] hover:bg-[#B8844E] hover:text-[#060F24] transition"
                        >
                          {renderSocialIcon(link.icon)}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Copyright Line */}
            <div className="pt-6 text-center">
              <p className="text-xs font-semibold tracking-[0.18em] text-[#F2D5B1]">
                {footer?.copyright || '@AXELON All rights Reserved'}
              </p>
            </div>
          </div>
        </footer>
      )}

      {/* Admin Controls Trigger (Only visible when signed in as the single Master Admin account) */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setIsAdminWorkspaceOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#0F2557] border border-[#B8844E] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] shadow-2xl hover:bg-[#060F24] transition"
          title="Manage Sections, Products, Fields & Booking Orders"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Admin Controls</span>
        </button>
      )}

      {/* "See Products" Popup Modal */}
      <SectionProductsModal
        section={activePopupSection}
        onClose={() => setActivePopupSection(null)}
        onAddToCart={handleAddToCart}
        onTextAdmin={handleTextAdminWithProduct}
      />

      {/* Public Search Modal (Available to ALL Visitors — No Sign-In Needed) */}
      <PublicSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onAddToCart={handleAddToCart}
        onTextAdmin={handleTextAdminWithProduct}
      />

      {/* Real Google Maps Shop Location & Turn-by-Turn Directions Popup */}
      <LocationMapModal
        isOpen={Boolean(activeLocationMap)}
        onClose={() => setActiveLocationMap(null)}
        address={activeLocationMap?.address}
        mapQuery={activeLocationMap?.mapQuery}
      />

      {/* Reg / Sign In + Email Verification + Forgot Password Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthNotice('');
        }}
        onAuthSuccess={handleAuthSuccess}
        noticeMessage={authNotice}
      />

      {/* Cart & Booking Order Slip Drawer */}
      <CartBookingDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        updateQuantity={updateCartQuantity}
        removeFromCart={removeFromCart}
        clearCart={() => setCart([])}
        isSignedIn={Boolean(currentUser)}
        onRequireSignIn={() => {
          setIsCartOpen(false);
          setAuthNotice('Please Sign In or Register a verified account to place your booking order.');
          setIsAuthModalOpen(true);
        }}
        clientName={clientName}
        setClientName={setClientName}
        clientPhone={clientPhone}
        setClientPhone={setClientPhone}
        clientEmail={clientEmail}
        setClientEmail={setClientEmail}
      />

      {/* Messenger 100MB Chat Modal (Signed-In Users Only) */}
      <MessengerModal
        isOpen={isMessengerOpen && Boolean(currentUser)}
        onClose={() => setIsMessengerOpen(false)}
        socket={socket}
        currentUser={currentUser}
        authToken={authToken}
        inquiredProduct={inquiredProduct}
        setInquiredProduct={setInquiredProduct}
      />

      {/* Admin Sections, Dynamic Fields, Device Photo Upload, Footer & Booking Orders Manager */}
      <AdminWorkspaceModal
        isOpen={isAdminWorkspaceOpen && isAdmin}
        onClose={() => setIsAdminWorkspaceOpen(false)}
        sections={sections}
        allProducts={allProducts}
        siteConfig={siteConfig}
        authToken={authToken}
        onRefreshBootstrap={applyBootstrap}
      />
    </div>
  );
}
