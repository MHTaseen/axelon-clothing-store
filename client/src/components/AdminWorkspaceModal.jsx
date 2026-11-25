import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Layers,
  Receipt,
  Check,
  Edit3,
  Save,
  LayoutTemplate,
  Link as LinkIcon,
  Megaphone,
  Users,
  KeyRound,
  Search
} from 'lucide-react';

export default function AdminWorkspaceModal({
  isOpen,
  onClose,
  sections,
  allProducts,
  siteConfig,
  authToken,
  onRefreshBootstrap
}) {
  const [activeTab, setActiveTab] = useState('sections'); // 'sections' | 'layout' | 'clients' | 'orders'
  const [selectedSectionId, setSelectedSectionId] = useState('sec-collection');
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientForm, setClientForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    password: ''
  });
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Active Section Name & Subheading State
  const [editSecName, setEditSecName] = useState('');
  const [editSecSub, setEditSecSub] = useState('');
  const [newSecShowOnHome, setNewSecShowOnHome] = useState(true);

  // Top Announcement Bar & News Bulletin Editor State
  const [topBarDraft, setTopBarDraft] = useState(
    siteConfig?.topAnnouncementBar || { enabled: true, message: '' }
  );
  const [bulletinDraft, setBulletinDraft] = useState(
    siteConfig?.newsBulletin || { enabled: true, items: [] }
  );
  const [newBulletinItem, setNewBulletinItem] = useState('');

  // Footer & Social Links Editor State
  const [footerDraft, setFooterDraft] = useState(siteConfig?.footer || {});
  const [newFooterSecTitle, setNewFooterSecTitle] = useState('');
  const [newFooterSecContent, setNewFooterSecContent] = useState('');
  const [newSocialLabel, setNewSocialLabel] = useState('');
  const [newSocialIcon, setNewSocialIcon] = useState('facebook');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  // Create New Section State
  const [newSecName, setNewSecName] = useState('');
  const [newSecSub, setNewSecSub] = useState('');

  // Product Form State (Unlimited Photos + Unlimited Dynamic Fields + Visible/Hidden Toggle)
  const [editingProdId, setEditingProdId] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImages, setProdImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [prodFields, setProdFields] = useState([
    { id: 'f-cat', label: 'Category', value: '', visibleToClient: true },
    { id: 'f-size', label: 'Size', value: 'S, M, L, XL', visibleToClient: true },
    { id: 'f-color', label: 'Color', value: 'Navy Blue', visibleToClient: true },
    { id: 'f-desc', label: 'Description', value: '', visibleToClient: false }
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  useEffect(() => {
    if (isOpen && authToken) {
      fetch('/api/orders', {
        headers: {}
      })
        .then((r) => r.json())
        .then((d) => setOrders(d.orders || []))
        .catch(console.error);

      fetch('/api/admin/clients', {
        headers: {}
      })
        .then((r) => r.json())
        .then((d) => setClients(d.clients || []))
        .catch(console.error);
    }
  }, [isOpen, activeTab, authToken]);

  useEffect(() => {
    if (siteConfig?.footer) {
      setFooterDraft(siteConfig.footer);
    }
    if (siteConfig?.topAnnouncementBar) {
      setTopBarDraft(siteConfig.topAnnouncementBar);
    }
    if (siteConfig?.newsBulletin) {
      setBulletinDraft(siteConfig.newsBulletin);
    }
  }, [siteConfig, isOpen]);

  useEffect(() => {
    const sec = sections.find((s) => s.id === selectedSectionId) || sections[0];
    if (sec) {
      setEditSecName(sec.name || '');
      setEditSecSub(sec.subheading || '');
    }
  }, [selectedSectionId, sections]);

  if (!isOpen) return null;

  const activeSection = sections.find((s) => s.id === selectedSectionId) || sections[0];

  const flash = (msg) => {
    setErrorMsg('');
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3500);
  };

  const flashError = (msg) => {
    setStatusMsg('');
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const handleSaveSectionMeta = async (e) => {
    e.preventDefault();
    if (!activeSection || !authToken || !editSecName.trim()) return;
    const res = await fetch(`/api/sections/${activeSection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editSecName.trim(), subheading: editSecSub.trim() })
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      flash('Updated category/section name & subheading!');
    } else {
      flashError(data.error || 'Could not update section.');
    }
  };

  const handleToggleShowOnHomepage = async (sec) => {
    if (!authToken) return;
    const res = await fetch(`/api/sections/${sec.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showOnHomepage: sec.showOnHomepage === false ? true : false })
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      flash(
        sec.showOnHomepage === false
          ? `"${sec.name}" is now visible on the Homepage!`
          : `"${sec.name}" hidden from the Homepage (still available in Our Collections menu).`
      );
    }
  };

  const handleSaveClientAccount = async (e) => {
    e.preventDefault();
    if (!authToken) return;
    const isEdit = Boolean(editingClientId);
    const url = isEdit ? `/api/admin/clients/${editingClientId}` : '/api/admin/clients';
    const method = isEdit ? 'PUT' : 'POST';
    const payload = isEdit
      ? {
          fullName: clientForm.fullName,
          email: clientForm.email,
          phone: clientForm.phone,
          address: clientForm.address,
          newPassword: clientForm.password || undefined
        }
      : clientForm;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      flashError(data.error || 'Failed to save client account.');
      return;
    }
    setClients(data.clients || []);
    setEditingClientId(null);
    setClientForm({ fullName: '', email: '', phone: '', address: '', password: '' });
    flash(isEdit ? 'Client account & details updated!' : 'New client account created!');
  };

  const handleDeleteClientAccount = async (userId, name) => {
    if (!authToken || !window.confirm(`Permanently delete client account "${name}"?`)) return;
    const res = await fetch(`/api/admin/clients/${userId}`, {
      method: 'DELETE',
      headers: {}
    });
    const data = await res.json();
    if (res.ok) {
      setClients(data.clients || []);
      if (editingClientId === userId) {
        setEditingClientId(null);
        setClientForm({ fullName: '', email: '', phone: '', address: '', password: '' });
      }
      flash('Client account permanently removed.');
    }
  };

  const handleSaveSiteLayout = async () => {
    if (!authToken) return;
    const res = await fetch('/api/site-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topAnnouncementBar: topBarDraft,
        newsBulletin: bulletinDraft,
        footer: footerDraft
      })
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap({ config: data.config });
      flash('All Top Bar, Bulletin, Footer & Social Links changes saved live!');
    }
  };

  // Add new section/category (placed under mandatory Our Collection)
  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newSecName.trim() || !authToken) return;
    const res = await fetch('/api/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newSecName.trim(),
        subheading: newSecSub.trim(),
        showOnHomepage: newSecShowOnHome
      })
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      setSelectedSectionId(data.section.id);
      setNewSecName('');
      setNewSecSub('');
      setNewSecShowOnHome(true);
      flash(`Created category "${data.section.name}"!`);
    } else {
      flashError(data.error || 'Duplicate or invalid category name.');
    }
  };

  const handleDeleteSection = async (secId) => {
    if (!authToken || !window.confirm('Delete this section and its products?')) return;
    const res = await fetch(`/api/sections/${secId}`, {
      method: 'DELETE',
      headers: {}
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      setSelectedSectionId('sec-collection');
      flash('Section deleted.');
    } else {
      flash(data.error || 'Cannot delete section.');
    }
  };

  // Toggle linking any existing website product into the mandatory "Collection" section
  const handleToggleLinkedProduct = async (productId) => {
    if (!activeSection || !authToken) return;
    const current = activeSection.linkedProductIds || [];
    const updated = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];

    const res = await fetch(`/api/sections/${activeSection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedProductIds: updated })
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      flash('Updated Collection linked products!');
    }
  };

  // Upload multiple photos from device (encrypted 100MB media vault)
  const handleUploadDevicePhotos = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/media/upload?purpose=product', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          flash(data.error || `Upload failed for ${file.name}`);
          return;
        }
        if (data.file?.url) {
          setProdImages((prev) => [...prev, data.file.url]);
        }
      }
      flash('Photo(s) uploaded from device!');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const resetProductForm = () => {
    setEditingProdId(null);
    setProdName('');
    setProdPrice('');
    setProdImages([]);
    setImageUrlInput('');
    setProdFields([
      { id: 'f-cat', label: 'Category', value: '', visibleToClient: true },
      { id: 'f-size', label: 'Size', value: 'S, M, L, XL', visibleToClient: true },
      { id: 'f-color', label: 'Color', value: 'Navy Blue', visibleToClient: true },
      { id: 'f-desc', label: 'Description', value: '', visibleToClient: false }
    ]);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!activeSection || !prodName.trim()) return;

    const payload = {
      name: prodName.trim(),
      price: Number(prodPrice) || 0,
      images: prodImages,
      fields: prodFields.filter((f) => f.label.trim())
    };

    const url = editingProdId
      ? `/api/sections/${activeSection.id}/products/${editingProdId}`
      : `/api/sections/${activeSection.id}/products`;
    const method = editingProdId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      resetProductForm();
      flash(editingProdId ? 'Product updated!' : `Product added to "${activeSection.name}"!`);
    } else {
      flashError(data.error || 'Duplicate product name or validation error.');
    }
  };

  const handleEditProduct = (p) => {
    setEditingProdId(p.id);
    setProdName(p.name || '');
    setProdPrice(p.price || '');
    setProdImages(p.images || []);
    setProdFields(
      (p.fields || []).length > 0
        ? p.fields
        : [{ id: 'f-1', label: 'Category', value: '', visibleToClient: true }]
    );
  };

  const handleDeleteProduct = async (secId, prodId) => {
    if (!authToken || !window.confirm('PERMANENTLY delete this product and its uploaded photos from the entire website? This cannot be undone.')) return;
    const res = await fetch(`/api/products/${encodeURIComponent(prodId)}`, {
      method: 'DELETE',
      headers: {}
    });
    const data = await res.json();
    if (res.ok) {
      onRefreshBootstrap(data);
      if (editingProdId === prodId) resetProductForm();
      flash('Product permanently deleted from the website and storage.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/80 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex h-full sm:h-[92vh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl border-0 sm:border border-[#B8844E]/60">
        {/* Compact Responsive Top Bar (Never hides Close button or wraps awkwardly) */}
        <div className="bg-[#0F2557] px-3.5 sm:px-5 py-3 text-white border-b border-[#B8844E]/40 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#F2D5B1] truncate">
                AXELON Admin Manager
              </h2>
              <p className="hidden sm:block text-[11px] text-white/75 truncate">
                Manage categories, products, site bars, footer, clients & booking orders
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-red-600 transition shrink-0"
              aria-label="Close Admin Panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Horizontal Scrollable Single-Line Tab Bar on Mobile, Clean Row on Desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('sections')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition ${
                activeTab === 'sections'
                  ? 'bg-[#DBBB97] text-[#060F24]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" /> Sections & Products
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('layout')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition ${
                activeTab === 'layout'
                  ? 'bg-[#DBBB97] text-[#060F24]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <LayoutTemplate className="h-3.5 w-3.5 shrink-0" /> Site Bars & Footer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clients')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition ${
                activeTab === 'clients'
                  ? 'bg-[#DBBB97] text-[#060F24]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Users className="h-3.5 w-3.5 shrink-0" /> Clients ({clients.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition ${
                activeTab === 'orders'
                  ? 'bg-[#DBBB97] text-[#060F24]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Receipt className="h-3.5 w-3.5 shrink-0" /> Orders ({orders.length})
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="bg-emerald-900 px-5 py-2 text-xs font-bold text-emerald-200 shrink-0">
            ✓ {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-700 px-5 py-2 text-xs font-bold text-white shrink-0">
            ⚠ {errorMsg}
          </div>
        )}

        {/* TAB 1: SECTIONS & PRODUCTS (Single Full-Height Smooth Scroll on Mobile, Side-by-Side Split on Desktop md+) */}
        {activeTab === 'sections' ? (
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto overscroll-contain md:overflow-hidden">
            {/* Left Sidebar: Section List + Add New Section */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#DBBB97]/60 bg-[#FBF8F4] p-4 flex flex-col gap-4 md:overflow-y-auto md:overscroll-contain shrink-0">
              <div className="space-y-1.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F2557]">
                  Website Sections ({sections.length})
                </p>
                {sections.map((sec) => (
                  <div
                    key={sec.id}
                    className={`flex items-center justify-between gap-1 border p-2.5 cursor-pointer transition ${
                      selectedSectionId === sec.id
                        ? 'bg-[#0F2557] text-white border-[#0F2557]'
                        : 'bg-white text-[#0F2557] border-[#DBBB97]/70 hover:border-[#0F2557]'
                    }`}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      resetProductForm();
                    }}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {sec.name} {sec.isMandatory && <span className="text-[#D4A876] text-[10px]">(Mandatory)</span>}
                      </p>
                      <p className={`text-[10px] truncate ${selectedSectionId === sec.id ? 'text-white/75' : 'text-navy-500'}`}>
                        {(sec.resolvedProducts || []).length} product(s) •{' '}
                        {sec.showOnHomepage !== false ? 'On Homepage' : 'Hidden on Home'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleShowOnHomepage(sec);
                        }}
                        className={`p-1 rounded transition ${
                          sec.showOnHomepage !== false
                            ? 'text-emerald-400 hover:bg-white/10'
                            : 'text-red-400 hover:bg-white/10'
                        }`}
                        title={
                          sec.showOnHomepage !== false
                            ? 'Shown on Homepage — Click to hide from Homepage'
                            : 'Hidden on Homepage — Click to show on Homepage'
                        }
                      >
                        {sec.showOnHomepage !== false ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {!sec.isMandatory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(sec.id);
                          }}
                          className="p-1 hover:text-red-400 shrink-0"
                          title="Delete Category Permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Category/Section Form */}
              <form onSubmit={handleCreateSection} className="bg-white border border-[#DBBB97] p-3 space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#0F2557]">
                  + Add New Category
                </p>
                <input
                  type="text"
                  required
                  value={newSecName}
                  onChange={(e) => setNewSecName(e.target.value)}
                  placeholder="Category Name (e.g. Summer Shirts)"
                  className="w-full border border-navy-200 px-2.5 py-1.5 text-xs focus:border-[#0F2557] focus:outline-none"
                />
                <input
                  type="text"
                  value={newSecSub}
                  onChange={(e) => setNewSecSub(e.target.value)}
                  placeholder="Small Subheading under it"
                  className="w-full border border-navy-200 px-2.5 py-1.5 text-xs focus:border-[#0F2557] focus:outline-none"
                />
                <label className="flex items-center gap-2 text-[11px] font-bold text-[#0F2557] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSecShowOnHome}
                    onChange={(e) => setNewSecShowOnHome(e.target.checked)}
                  />
                  Show this category on Homepage
                </label>
                <button
                  type="submit"
                  className="w-full bg-[#B8844E] py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#9A6B3B] transition"
                >
                  Create Category
                </button>
              </form>
            </div>

            {/* Right Workspace: Manage Active Section (Scrolls seamlessly with parent on mobile, independent scroll on desktop) */}
            <div className="flex-1 md:overflow-y-auto md:overscroll-contain p-4 sm:p-5 space-y-6 bg-white">
              {activeSection && (
                <>
                  <div className="border-b border-[#DBBB97]/60 pb-4 space-y-3">
                    <h3 className="font-serif text-2xl font-bold text-[#0F2557]">
                      Managing: {activeSection.name}
                    </h3>
                    {/* Edit Section Name & Subheading */}
                    <form onSubmit={handleSaveSectionMeta} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="text"
                        required
                        value={editSecName}
                        onChange={(e) => setEditSecName(e.target.value)}
                        placeholder="Section Name"
                        className="sm:col-span-4 border border-[#DBBB97] bg-[#FBF8F4] px-3 py-2 text-xs font-bold text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                      />
                      <input
                        type="text"
                        value={editSecSub}
                        onChange={(e) => setEditSecSub(e.target.value)}
                        placeholder="Small Subheading"
                        className="sm:col-span-6 border border-[#DBBB97] bg-[#FBF8F4] px-3 py-2 text-xs text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-2 bg-[#0F2557] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition"
                      >
                        Rename
                      </button>
                    </form>
                  </div>

                  {/* Special Feature for Mandatory "Collection" Section: Pick Any Existing Website Product */}
                  {activeSection.isMandatory && (
                    <div className="bg-[#FBF8F4] border border-[#B8844E]/60 p-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                          Select Any Existing Website Product to Display in "Collection"
                        </h4>
                        <p className="text-[11px] text-navy-600">
                          Click products below to include/remove them in Collection — OR upload new products directly from your device below.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {allProducts.map((p) => {
                          const linked = (activeSection.linkedProductIds || []).includes(p.id);
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-1 border transition ${
                                linked
                                  ? 'bg-[#0F2557] text-white border-[#0F2557]'
                                  : 'bg-white text-[#0F2557] border-[#DBBB97] hover:border-[#0F2557]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleLinkedProduct(p.id)}
                                className="flex flex-1 min-w-0 items-center gap-2 p-2 text-left"
                              >
                                {p.images?.[0] && (
                                  <img src={p.images[0]} alt={p.name} className="h-9 w-8 object-cover shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold truncate">{p.name}</p>
                                  <p className={`text-[10px] ${linked ? 'text-[#F2D5B1]' : 'text-navy-500'}`}>
                                    TK {Number(p.price).toLocaleString()}
                                  </p>
                                </div>
                                {linked && <Check className="h-4 w-4 text-[#F2D5B1] shrink-0" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.sourceSectionId, p.id)}
                                className={`p-2 transition shrink-0 ${
                                  linked
                                    ? 'text-red-300 hover:bg-red-600 hover:text-white'
                                    : 'text-red-600 hover:bg-red-600 hover:text-white'
                                }`}
                                title="Permanently Delete Product"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add / Edit Product Form (Unlimited Device Photos + Unlimited Custom Fields + Visibility Toggle) */}
                  <form onSubmit={handleSaveProduct} className="bg-[#FBF8F4] border border-[#DBBB97] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                        {editingProdId ? 'Edit Product' : `+ Add Product Directly to "${activeSection.name}"`}
                      </h4>
                      {editingProdId && (
                        <button
                          type="button"
                          onClick={resetProductForm}
                          className="text-xs text-red-600 font-bold underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder="Product Name *"
                        className="w-full border border-navy-200 bg-white px-3 py-2 text-xs font-bold"
                      />
                      <input
                        type="number"
                        required
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="Price in TK *"
                        className="w-full border border-navy-200 bg-white px-3 py-2 text-xs font-bold"
                      />
                    </div>

                    {/* Unlimited Product Photos (Upload from Device or Paste URL) */}
                    <div className="bg-white border border-[#DBBB97]/70 p-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold uppercase text-[#0F2557]">
                          Product Photos ({prodImages.length})
                        </span>
                        <label className="inline-flex items-center gap-1.5 bg-[#0F2557] px-3 py-1.5 text-[11px] font-bold text-[#F2D5B1] cursor-pointer hover:bg-[#060F24]">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo(s) from Device'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleUploadDevicePhotos(e.target.files)}
                          />
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={imageUrlInput}
                          onChange={(e) => setImageUrlInput(e.target.value)}
                          placeholder="Or paste photo URL..."
                          className="flex-1 border border-navy-200 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!imageUrlInput.trim()) return;
                            setProdImages((prev) => [...prev, imageUrlInput.trim()]);
                            setImageUrlInput('');
                          }}
                          className="bg-[#B8844E] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Add URL
                        </button>
                      </div>

                      {prodImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {prodImages.map((url, idx) => (
                            <div key={idx} className="relative h-16 w-14 border border-navy-200">
                              <img src={url} alt="" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setProdImages((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unlimited Custom Fields with Show/Hide Toggle for Clients */}
                    <div className="bg-white border border-[#DBBB97]/70 p-3 space-y-2.5">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase text-[#0F2557]">
                          Custom Product Fields (Select Which Fields Clients Can See)
                        </span>
                        <p className="text-[10px] text-navy-500">
                          Note: Any field named "Description" is always hidden on section cards automatically.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {prodFields.map((field, idx) => {
                          const isDesc = (field.label || '').toLowerCase().includes('description');
                          return (
                            <div key={field.id || idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => {
                                  const copy = [...prodFields];
                                  copy[idx] = { ...copy[idx], label: e.target.value };
                                  setProdFields(copy);
                                }}
                                placeholder="Field Name (e.g. Size, Category)"
                                className="w-full sm:w-36 border border-navy-200 px-2.5 py-1.5 text-xs font-bold"
                              />
                              <input
                                type="text"
                                value={field.value}
                                onChange={(e) => {
                                  const copy = [...prodFields];
                                  copy[idx] = { ...copy[idx], value: e.target.value };
                                  setProdFields(copy);
                                }}
                                placeholder="Field Value"
                                className="flex-1 min-w-[140px] border border-navy-200 px-2.5 py-1.5 text-xs"
                              />
                              <button
                                type="button"
                                disabled={isDesc}
                                onClick={() => {
                                  const copy = [...prodFields];
                                  copy[idx] = { ...copy[idx], visibleToClient: !copy[idx].visibleToClient };
                                  setProdFields(copy);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase shrink-0 ${
                                  isDesc || !field.visibleToClient
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}
                                title={isDesc ? 'Descriptions are hidden on section cards' : 'Toggle client visibility'}
                              >
                                {isDesc || !field.visibleToClient ? (
                                  <>
                                    <EyeOff className="h-3 w-3" /> Hidden
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3" /> Visible
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setProdFields((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add Another Field */}
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-2 border-t border-navy-100">
                        <input
                          type="text"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="New Field Name (e.g. Fabric, Brand, SKU)"
                          className="w-full sm:w-44 border border-navy-200 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={newFieldValue}
                          onChange={(e) => setNewFieldValue(e.target.value)}
                          placeholder="Value"
                          className="flex-1 border border-navy-200 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newFieldLabel.trim()) return;
                            const isDesc = newFieldLabel.toLowerCase().includes('description');
                            setProdFields((prev) => [
                              ...prev,
                              {
                                id: 'f-' + Date.now(),
                                label: newFieldLabel.trim(),
                                value: newFieldValue.trim(),
                                visibleToClient: !isDesc
                              }
                            ]);
                            setNewFieldLabel('');
                            setNewFieldValue('');
                          }}
                          className="inline-flex items-center gap-1 bg-[#0F2557] px-3 py-1.5 text-xs font-bold text-[#F2D5B1] shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Field
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 bg-[#0F2557] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{editingProdId ? 'Update Product' : 'Save & Display Product'}</span>
                    </button>
                  </form>

                  {/* Own Products inside Active Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                      Products Created Directly in "{activeSection.name}" ({(activeSection.products || []).length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(activeSection.products || []).map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 border border-[#DBBB97]/70 p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.images?.[0] && (
                              <img src={p.images[0]} alt={p.name} className="h-12 w-10 object-cover shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#0F2557] truncate">{p.name}</p>
                              <p className="text-[11px] text-[#9A6B3B] font-semibold">
                                TK {Number(p.price).toLocaleString()} • {(p.fields || []).length} field(s)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditProduct(p)}
                              className="p-1.5 bg-navy-50 text-[#0F2557] hover:bg-[#0F2557] hover:text-white"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(activeSection.id, p.id)}
                              className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : activeTab === 'layout' ? (
          /* TAB 2: COMBINED TOP BAR, NEWS BULLETIN, FOOTER & SOCIAL LINKS MANAGER */
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6 bg-[#FBF8F4]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DBBB97] pb-3">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#0F2557]">
                  Top Message Bar, News Bulletin, Footer & Social Links
                </h3>
                <p className="text-xs text-navy-600">
                  Manage your topmost announcement bar, scrolling bulletin messages, footer sections, social links, and copyright all in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveSiteLayout}
                className="inline-flex items-center gap-1.5 bg-[#0F2557] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition shadow"
              >
                <Save className="h-4 w-4" /> Save All Changes
              </button>
            </div>

            {/* 1. Topmost Announcement Bar Control */}
            <div className="bg-white border border-[#DBBB97] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                  1. Topmost Message Bar (Navy Blue)
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setTopBarDraft((prev) => ({ ...prev, enabled: prev.enabled === false ? true : false }))
                    }
                    className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold uppercase ${
                      topBarDraft.enabled !== false
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {topBarDraft.enabled !== false ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Visible
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Removed / Hidden
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopBarDraft({ enabled: false, message: '' })}
                    className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1 text-[11px] font-bold uppercase text-red-700 hover:bg-red-600 hover:text-white transition"
                    title="Clear & Hide Top Bar"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>

              <textarea
                rows={2}
                value={topBarDraft.message || ''}
                onChange={(e) => setTopBarDraft({ ...topBarDraft, enabled: true, message: e.target.value })}
                placeholder="Write any message to display in the topmost Navy Blue bar..."
                className="w-full border border-navy-200 bg-[#FBF8F4] px-3 py-2 text-xs sm:text-sm font-semibold text-[#0F2557] focus:border-[#0F2557] focus:bg-white focus:outline-none"
              />
            </div>

            {/* 2. News Bulletin Bar Control (Edit, Add, Remove Bullet Points or Hide Entire Bar) */}
            <div className="bg-white border border-[#DBBB97] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                  2. Scrolling News Bulletin Messages ({(bulletinDraft.items || []).length})
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    setBulletinDraft((prev) => ({ ...prev, enabled: prev.enabled === false ? true : false }))
                  }
                  className={`inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold uppercase ${
                    bulletinDraft.enabled !== false
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {bulletinDraft.enabled !== false ? (
                    <>
                      <Eye className="h-3.5 w-3.5" /> Bulletin Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3.5 w-3.5" /> Bulletin Hidden
                    </>
                  )}
                </button>
              </div>

              {/* Existing Bulletin Messages */}
              <div className="space-y-2">
                {(bulletinDraft.items || []).map((msg, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-[#FBF8F4] border border-[#DBBB97]/60 p-2">
                    <span className="h-2 w-2 rounded-full bg-[#B8844E] shrink-0 ml-1" />
                    <input
                      type="text"
                      value={msg}
                      onChange={(e) => {
                        const updated = [...(bulletinDraft.items || [])];
                        updated[idx] = e.target.value;
                        setBulletinDraft({ ...bulletinDraft, items: updated });
                      }}
                      className="flex-1 border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F2557]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (bulletinDraft.items || []).filter((_, i) => i !== idx);
                        setBulletinDraft({ ...bulletinDraft, items: updated });
                      }}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition shrink-0"
                      title="Remove Bulletin Message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Bulletin Bullet Point */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#DBBB97]/60">
                <input
                  type="text"
                  value={newBulletinItem}
                  onChange={(e) => setNewBulletinItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!newBulletinItem.trim()) return;
                      setBulletinDraft({
                        ...bulletinDraft,
                        enabled: true,
                        items: [...(bulletinDraft.items || []), newBulletinItem.trim()]
                      });
                      setNewBulletinItem('');
                    }
                  }}
                  placeholder="Type a new news bulletin message to add..."
                  className="flex-1 border border-navy-200 px-3 py-2 text-xs text-[#0F2557] focus:border-[#0F2557] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newBulletinItem.trim()) return;
                    setBulletinDraft({
                      ...bulletinDraft,
                      enabled: true,
                      items: [...(bulletinDraft.items || []), newBulletinItem.trim()]
                    });
                    setNewBulletinItem('');
                  }}
                  className="inline-flex items-center justify-center gap-1 bg-[#B8844E] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#9A6B3B] shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Bulletin
                </button>
              </div>
            </div>

            {/* 3. Dynamic Footer Sections */}
            <div className="bg-white border border-[#DBBB97] p-4 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                3. Footer Sections ({(footerDraft.sections || []).length})
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(footerDraft.sections || []).map((fSec, idx) => (
                  <div key={fSec.id || idx} className="border border-[#DBBB97]/70 bg-[#FBF8F4] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={fSec.title}
                        onChange={(e) => {
                          const updated = [...(footerDraft.sections || [])];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setFooterDraft({ ...footerDraft, sections: updated });
                        }}
                        placeholder="Section Title"
                        className="flex-1 border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F2557]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (footerDraft.sections || []).filter((_, i) => i !== idx);
                          setFooterDraft({ ...footerDraft, sections: updated });
                        }}
                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition"
                        title="Remove Footer Section"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={fSec.content}
                      onChange={(e) => {
                        const updated = [...(footerDraft.sections || [])];
                        updated[idx] = { ...updated[idx], content: e.target.value };
                        setFooterDraft({ ...footerDraft, sections: updated });
                      }}
                      placeholder="Section text..."
                      className="w-full border border-navy-200 bg-white px-2.5 py-1.5 text-xs text-navy-900"
                    />
                  </div>
                ))}
              </div>

              {/* Add New Footer Section */}
              <div className="border-t border-[#DBBB97]/60 pt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newFooterSecTitle}
                  onChange={(e) => setNewFooterSecTitle(e.target.value)}
                  placeholder="New Footer Section Name (e.g. Delivery Info)"
                  className="sm:col-span-4 border border-navy-200 px-3 py-2 text-xs font-bold"
                />
                <input
                  type="text"
                  value={newFooterSecContent}
                  onChange={(e) => setNewFooterSecContent(e.target.value)}
                  placeholder="Section content..."
                  className="sm:col-span-6 border border-navy-200 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newFooterSecTitle.trim()) return;
                    const nextSec = {
                      id: 'ft-' + Date.now(),
                      title: newFooterSecTitle.trim(),
                      content: newFooterSecContent.trim()
                    };
                    setFooterDraft({
                      ...footerDraft,
                      sections: [...(footerDraft.sections || []), nextSec]
                    });
                    setNewFooterSecTitle('');
                    setNewFooterSecContent('');
                  }}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-1 bg-[#B8844E] px-3 py-2 text-xs font-bold text-white hover:bg-[#9A6B3B]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>

            {/* 2. Social Media Links Section ("Links") */}
            <div className="bg-white border border-[#DBBB97] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-[#0F2557]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                    Social Links Section Name:
                  </span>
                  <input
                    type="text"
                    value={footerDraft.linksSectionTitle || 'Links'}
                    onChange={(e) => setFooterDraft({ ...footerDraft, linksSectionTitle: e.target.value })}
                    className="border border-navy-200 px-2.5 py-1 text-xs font-bold text-[#0F2557] w-36"
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F2557] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={footerDraft.showLinksSection !== false}
                    onChange={(e) => setFooterDraft({ ...footerDraft, showLinksSection: e.target.checked })}
                  />
                  Show Links Section
                </label>
              </div>

              <div className="space-y-2">
                {(footerDraft.socialLinks || []).map((link, idx) => (
                  <div key={link.id || idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[#FBF8F4] border border-[#DBBB97]/60 p-2">
                    <select
                      value={link.icon || 'facebook'}
                      onChange={(e) => {
                        const updated = [...(footerDraft.socialLinks || [])];
                        updated[idx] = { ...updated[idx], icon: e.target.value };
                        setFooterDraft({ ...footerDraft, socialLinks: updated });
                      }}
                      className="border border-navy-200 bg-white px-2 py-1.5 text-xs font-bold text-[#0F2557]"
                    >
                      <option value="facebook">Facebook Icon</option>
                      <option value="instagram">Instagram Icon</option>
                      <option value="twitter">Twitter Icon</option>
                      <option value="youtube">YouTube Icon</option>
                      <option value="linkedin">LinkedIn Icon</option>
                      <option value="whatsapp">WhatsApp Icon</option>
                      <option value="website">Website Icon</option>
                      <option value="other">Link Icon</option>
                    </select>
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => {
                        const updated = [...(footerDraft.socialLinks || [])];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setFooterDraft({ ...footerDraft, socialLinks: updated });
                      }}
                      placeholder="Label"
                      className="w-28 sm:w-32 border border-navy-200 bg-white px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => {
                        const updated = [...(footerDraft.socialLinks || [])];
                        updated[idx] = { ...updated[idx], url: e.target.value };
                        setFooterDraft({ ...footerDraft, socialLinks: updated });
                      }}
                      placeholder="https://..."
                      className="flex-1 min-w-[160px] border border-navy-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (footerDraft.socialLinks || []).filter((_, i) => i !== idx);
                        setFooterDraft({ ...footerDraft, socialLinks: updated });
                      }}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition"
                      title="Remove Link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Social Link */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 border-t border-[#DBBB97]/60">
                <select
                  value={newSocialIcon}
                  onChange={(e) => setNewSocialIcon(e.target.value)}
                  className="border border-navy-200 bg-white px-2 py-2 text-xs font-bold text-[#0F2557]"
                >
                  <option value="facebook">Facebook Icon</option>
                  <option value="instagram">Instagram Icon</option>
                  <option value="twitter">Twitter Icon</option>
                  <option value="youtube">YouTube Icon</option>
                  <option value="linkedin">LinkedIn Icon</option>
                  <option value="whatsapp">WhatsApp Icon</option>
                  <option value="website">Website Icon</option>
                  <option value="other">Link Icon</option>
                </select>
                <input
                  type="text"
                  value={newSocialLabel}
                  onChange={(e) => setNewSocialLabel(e.target.value)}
                  placeholder="Platform Name (e.g. YouTube)"
                  className="w-36 border border-navy-200 px-2.5 py-2 text-xs font-bold"
                />
                <input
                  type="url"
                  value={newSocialUrl}
                  onChange={(e) => setNewSocialUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 min-w-[150px] border border-navy-200 px-2.5 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newSocialLabel.trim() || !newSocialUrl.trim()) return;
                    setFooterDraft({
                      ...footerDraft,
                      socialLinks: [
                        ...(footerDraft.socialLinks || []),
                        {
                          id: 'soc-' + Date.now(),
                          icon: newSocialIcon,
                          label: newSocialLabel.trim(),
                          url: newSocialUrl.trim()
                        }
                      ]
                    });
                    setNewSocialLabel('');
                    setNewSocialUrl('');
                  }}
                  className="inline-flex items-center gap-1 bg-[#0F2557] px-3.5 py-2 text-xs font-bold text-[#F2D5B1] shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Link
                </button>
              </div>
            </div>

            {/* 5. Google Map Pin / Exact GPS Coordinates & Copyright Line */}
            <div className="bg-white border border-[#DBBB97] p-4 space-y-3">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#0F2557] mb-1">
                  Google Maps Exact Location / GPS Coordinates (Optional Override)
                </label>
                <input
                  type="text"
                  value={footerDraft.mapQuery || ''}
                  onChange={(e) => setFooterDraft({ ...footerDraft, mapQuery: e.target.value })}
                  placeholder="e.g. 23.4607, 91.1809 OR your shop address"
                  className="w-full border border-navy-200 px-3 py-2 text-xs text-[#0F2557]"
                />
                <p className="text-[10px] text-navy-500 mt-1">
                  Leave blank to automatically pin the address from your "Location" footer section, or paste exact GPS coordinates from Google Maps for pinpoint accuracy.
                </p>
              </div>
              <div className="pt-2 border-t border-[#DBBB97]/40">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#0F2557] mb-1">
                  Bottom Copyright Text
                </label>
                <input
                  type="text"
                  value={footerDraft.copyright || ''}
                  onChange={(e) => setFooterDraft({ ...footerDraft, copyright: e.target.value })}
                  className="w-full border border-navy-200 px-3 py-2 text-xs font-semibold text-[#0F2557]"
                />
              </div>
            </div>
          </div>
        ) : activeTab === 'clients' ? (
          /* TAB 3: FULL CLIENT ACCOUNTS MANAGER (VIEW, ADD, EDIT, CHANGE PASSWORD, DELETE) */
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6 bg-[#FBF8F4]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DBBB97] pb-3">
              <div>
                <h3 className="font-serif text-2xl font-bold text-[#0F2557]">
                  Client Accounts Manager ({clients.length})
                </h3>
                <p className="text-xs text-navy-600">
                  View, add, edit any client’s details, change their password, or permanently remove accounts.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-navy-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full border border-[#DBBB97] bg-white pl-8 pr-3 py-1.5 text-xs focus:border-[#0F2557] focus:outline-none"
                />
              </div>
            </div>

            {/* Add / Edit Client Account Form */}
            <form onSubmit={handleSaveClientAccount} className="bg-white border border-[#DBBB97] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                  {editingClientId ? 'Edit Client Account & Password' : '+ Add New Client Account'}
                </h4>
                {editingClientId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingClientId(null);
                      setClientForm({ fullName: '', email: '', phone: '', address: '', password: '' });
                    }}
                    className="text-xs font-bold text-red-600 underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={clientForm.fullName}
                  onChange={(e) => setClientForm({ ...clientForm, fullName: e.target.value })}
                  placeholder="Full Name *"
                  className="border border-navy-200 px-3 py-2 text-xs font-semibold"
                />
                <input
                  type="email"
                  required
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  placeholder="Email Address *"
                  className="border border-navy-200 px-3 py-2 text-xs"
                />
                <input
                  type="tel"
                  required
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                  placeholder="Phone Number *"
                  className="border border-navy-200 px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  required
                  value={clientForm.address}
                  onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                  placeholder="Address *"
                  className="sm:col-span-2 border border-navy-200 px-3 py-2 text-xs"
                />
                <div className="relative">
                  <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-navy-400" />
                  <input
                    type="text"
                    required={!editingClientId}
                    value={clientForm.password}
                    onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                    placeholder={editingClientId ? 'New Password (Optional, 8+ strong)' : 'Strong Password * (8+ chars)'}
                    className="w-full border border-navy-200 pl-8 pr-3 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-[#0F2557] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{editingClientId ? 'Save Client Updates' : 'Create Client Account'}</span>
              </button>
            </form>

            {/* Existing Clients List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clients
                .filter((c) => {
                  if (!clientSearch.trim()) return true;
                  const q = clientSearch.toLowerCase();
                  return (
                    c.fullName?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.phone?.toLowerCase().includes(q) ||
                    c.address?.toLowerCase().includes(q)
                  );
                })
                .map((c) => (
                  <div key={c.id} className="bg-white border border-[#DBBB97] p-3.5 flex flex-col justify-between gap-2 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F2557] truncate">{c.fullName}</p>
                        <p className="text-xs text-navy-700 break-all">{c.email}</p>
                        <p className="text-xs font-semibold text-[#9A6B3B]">{c.phone}</p>
                        <p className="text-xs text-navy-600 mt-1">{c.address}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClientId(c.id);
                            setClientForm({
                              fullName: c.fullName || '',
                              email: c.email || '',
                              phone: c.phone || '',
                              address: c.address || '',
                              password: ''
                            });
                          }}
                          className="p-1.5 bg-navy-50 text-[#0F2557] hover:bg-[#0F2557] hover:text-white transition"
                          title="Edit Client Details & Password"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClientAccount(c.id, c.fullName)}
                          className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition"
                          title="Delete Client Account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* TAB 4: RECEIVED BOOKING ORDERS */
          <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4 bg-[#FBF8F4]">
            <h3 className="font-serif text-2xl font-bold text-[#0F2557]">
              Received Booking Orders ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <p className="text-xs text-navy-600">
                No booking orders yet. When clients submit their cart booking slip, it will appear here with full client details.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orders.map((ord) => (
                  <div key={ord.id} className="bg-white border-2 border-[#0F2557] p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-dashed border-[#B8844E] pb-2">
                      <span className="font-mono text-xs font-extrabold text-[#0F2557]">{ord.id}</span>
                      <span className="bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-xs space-y-1 bg-[#FBF8F4] p-2.5 border border-[#DBBB97]/60">
                      <p><strong>Client:</strong> {ord.client?.name}</p>
                      <p><strong>Phone:</strong> {ord.client?.phone}</p>
                      {ord.client?.email && <p><strong>Email:</strong> {ord.client?.email}</p>}
                      <p><strong>Address:</strong> {ord.client?.address}</p>
                      {ord.client?.notes && <p><strong>Notes:</strong> {ord.client?.notes}</p>}
                    </div>
                    <div className="space-y-1 text-xs">
                      {(ord.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.name} × {item.quantity}</span>
                          <span className="font-bold">TK {(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between border-t border-navy-100 pt-2 text-sm font-extrabold text-[#0F2557]">
                      <span>Total Amount</span>
                      <span>TK {Number(ord.totalAmount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
