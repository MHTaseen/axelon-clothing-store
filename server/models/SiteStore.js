const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { encryptData, decryptData } = require('../security/cryptoVault');
const v = require('../security/validators');

const VAULT_FILE = path.join(__dirname, 'axelon_vault.enc.json');
const LEGACY_MEDIA_INDEX = path.join(__dirname, '..', 'uploads', 'media_index.json');

// Delivery pricing is decided by the SERVER, never by the browser.
const DELIVERY_CHARGE = 120;
const FREE_DELIVERY_OVER = 3000;
const MAX_QTY_PER_ITEM = 20;
const MAX_ITEMS_PER_ORDER = 50;

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_SENDS_PER_HOUR = 5;

const CONFIG_KEYS = ['theme', 'topAnnouncementBar', 'mainNavbar', 'brandBannerBar', 'newsBulletin', 'footer'];

const DEFAULT_CONFIG = {
  theme: { navyDark: '#060F24', navyPrimary: '#0F2557', biscuit: '#DBBB97', goldBrown: '#B8844E' },
  topAnnouncementBar: {
    enabled: true,
    message: 'Welcome to Our New Collection — Free Express Home Delivery Across Bangladesh on Orders Over TK 3,000'
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
  brandBannerBar: { enabled: true, logoUrl: '/images/axelon-logo.png', brandName: 'AXELON' },
  newsBulletin: {
    enabled: true,
    items: [
      'New Winter Luxury Collection is now officially live across Bangladesh',
      'Free express home delivery on all orders above TK 3,000',
      'Easy 72-hour size exchange guarantee on every purchase',
      'Cash on Delivery available nationwide in all 64 districts',
      'Custom size & tailoring requests available directly through our Admin'
    ]
  },
  footer: {
    enabled: true,
    sections: [
      { id: 'ft-contact', title: 'Contact', content: 'Phone: (set in Admin Controls)\nEmail: (set in Admin Controls)' },
      { id: 'ft-location', title: 'Location', content: 'Store address (set in Admin Controls)' },
      {
        id: 'ft-about',
        title: 'About Us',
        content: 'AXELON is a modern luxury apparel store delivering premium quality fabrics, tailored silhouettes, and direct customer care across Bangladesh.'
      },
      {
        id: 'ft-privacy',
        title: 'Privacy & Policy',
        content: 'Your personal details, orders, and messages are sent over HTTPS, stored encrypted at rest (AES-256-GCM), are only visible to you and the store admin, and are never sold or shared with third parties.'
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
};

const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;
const DEFAULT_SECTIONS = [
  {
    id: 'sec-collection',
    name: 'Our Collection',
    subheading: 'All signature AXELON products across every category',
    isMandatory: true,
    showOnHomepage: true,
    linkedProductIds: [],
    products: []
  },
  {
    id: 'sec-winter-edit',
    name: 'Winter & Tailored Edit',
    subheading: 'Structured silhouettes in Navy Blue, Biscuit & Gold Brown',
    isMandatory: false,
    showOnHomepage: true,
    linkedProductIds: [],
    products: [
      {
        id: 'prod-1',
        name: 'Royal Navy Double-Breasted Suit',
        price: 5800,
        images: [unsplash('photo-1594938298603-c8148c4dae35'), unsplash('photo-1507679799987-c73779587ccf')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Suits', visibleToClient: true },
          { id: 'f2', label: 'Size', value: 'S, M, L, XL', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Navy Blue', visibleToClient: true },
          { id: 'f4', label: 'Fabric', value: '100% Superfine Wool', visibleToClient: true },
          { id: 'f5', label: 'Description', value: 'Internal tailor note: full canvas construction with horn buttons.', visibleToClient: false }
        ]
      },
      {
        id: 'prod-2',
        name: 'Warm Biscuit Cashmere Trench Coat',
        price: 4900,
        images: [unsplash('photo-1515886657613-9f3515b0c78f'), unsplash('photo-1539109136881-3be0616acf4b')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Coats', visibleToClient: true },
          { id: 'f2', label: 'Size', value: 'XS, S, M, L, XL', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Warm Biscuit', visibleToClient: true },
          { id: 'f4', label: 'Description', value: 'Water-resistant storm finish.', visibleToClient: false }
        ]
      },
      {
        id: 'prod-3',
        name: 'Crisp Ivory Cotton Dress Shirt',
        price: 1850,
        images: [unsplash('photo-1602810318383-e386cc2a3ccf')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Shirts', visibleToClient: true },
          { id: 'f2', label: 'Size', value: 'S, M, L, XL, XXL', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Crisp White', visibleToClient: true },
          { id: 'f4', label: 'Description', value: '2-ply breathable cotton.', visibleToClient: false }
        ]
      },
      {
        id: 'prod-4',
        name: 'Navy & Gold-Trim Cable Knit Sweater',
        price: 3100,
        images: [unsplash('photo-1620799140408-edc6dcb6d633')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Knitwear', visibleToClient: true },
          { id: 'f2', label: 'Size', value: 'S, M, L, XL', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Deep Navy', visibleToClient: true },
          { id: 'f4', label: 'Description', value: 'Heavy 4-ply winter yarn.', visibleToClient: false }
        ]
      },
      {
        id: 'prod-5',
        name: 'Tailored Pleated Formal Trousers',
        price: 2450,
        images: [unsplash('photo-1594633312681-425c7b97ccd1')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Trousers', visibleToClient: true },
          { id: 'f2', label: 'Size', value: '30, 32, 34, 36, 38', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Biscuit / Navy', visibleToClient: true }
        ]
      },
      {
        id: 'prod-6',
        name: 'Midnight Navy Winter Overcoat',
        price: 7200,
        images: [unsplash('photo-1544441893-675973e31985')],
        fields: [
          { id: 'f1', label: 'Category', value: 'Outerwear', visibleToClient: true },
          { id: 'f2', label: 'Size', value: 'M, L, XL', visibleToClient: true },
          { id: 'f3', label: 'Color', value: 'Midnight Navy', visibleToClient: true }
        ]
      }
    ]
  }
];

const clone = (o) => JSON.parse(JSON.stringify(o));
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;

// ---------- Deep config sanitiser (admin input) ----------
function cleanConfigValue(value, key = '', depth = 0) {
  if (depth > 6) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((x) => cleanConfigValue(x, key, depth + 1)).filter((x) => x !== undefined);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).slice(0, 60)) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(k)) continue;
      const c = cleanConfigValue(value[k], k, depth + 1);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    if (/url$/i.test(key)) return v.safeUrl(value, { allowMailTel: true });
    return v.str(value, 3000);
  }
  return undefined;
}

class SiteStore {
  constructor() {
    this.state = null;
    this.mongoReady = false;
    this.vaultExisted = fs.existsSync(VAULT_FILE);
    this.loadSync();
    this.migrateLegacyMediaIndex();
    setInterval(() => this.purgeExpiredOtps(), 5 * 60 * 1000).unref();
  }

  // ==================== PERSISTENCE ====================

  freshState() {
    const a = config.admin;
    const pwErr = v.passwordProblem(a.password);
    if (pwErr) {
      if (config.isProd) {
        console.error(`\n❌ ADMIN_PASSWORD is required on first start and must be strong: ${pwErr}\n`);
        process.exit(1);
      }
      a.password = crypto.randomBytes(9).toString('base64url') + 'aA1!';
      console.warn(`[dev] ADMIN_PASSWORD not set/weak. Temporary dev admin: ${a.email} / ${a.password}`);
    }
    return {
      config: clone(DEFAULT_CONFIG),
      sections: clone(DEFAULT_SECTIONS),
      orders: [],
      users: [],
      threads: {},
      media: {},
      pendingOtps: {},
      adminUser: {
        id: 'admin-master-1',
        fullName: a.fullName,
        phone: v.normPhone(a.phone),
        email: a.email,
        address: a.address,
        role: 'admin',
        emailVerified: true,
        tokenVersion: 0,
        passwordHash: bcrypt.hashSync(a.password, 12),
        createdAt: new Date().toISOString()
      }
    };
  }

  loadSync() {
    if (!this.vaultExisted) {
      this.state = this.freshState();
      this.saveDisk();
      return;
    }
    let parsed;
    try {
      const fileData = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
      parsed = JSON.parse(decryptData(fileData.encryptedVault));
    } catch (e) {
      // Never silently start with empty data — that would overwrite (destroy) the real vault.
      console.error(
        '\n❌ Could not decrypt the data vault (wrong ENCRYPTION_MASTER_KEY or corrupted file). ' +
          'Refusing to start so no data is overwritten.\n'
      );
      process.exit(1);
    }
    this.applyLoaded(parsed);
  }

  applyLoaded(parsed) {
    const base = this.state || {};
    this.state = {
      config: { ...clone(DEFAULT_CONFIG), ...(parsed.config || {}) },
      sections: Array.isArray(parsed.sections) && parsed.sections.length ? parsed.sections : clone(DEFAULT_SECTIONS),
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      threads: parsed.threads && typeof parsed.threads === 'object' ? parsed.threads : {},
      media: parsed.media && typeof parsed.media === 'object' ? parsed.media : base.media || {},
      pendingOtps: parsed.pendingOtps || {},
      adminUser: parsed.adminUser?.email ? parsed.adminUser : base.adminUser || this.freshState().adminUser
    };
    // Remove the old demo conversation if present
    delete this.state.threads['client-demo-1'];
    // Ensure token versions exist (used to revoke sessions)
    this.state.adminUser.tokenVersion = this.state.adminUser.tokenVersion || 0;
    this.state.users.forEach((u) => (u.tokenVersion = u.tokenVersion || 0));
    this.ensureMandatoryCollectionFirst();
  }

  migrateLegacyMediaIndex() {
    if (!fs.existsSync(LEGACY_MEDIA_INDEX)) return;
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_MEDIA_INDEX, 'utf8'));
      for (const [id, rec] of Object.entries(legacy)) {
        if (!this.state.media[id]) {
          this.state.media[id] = { ...rec, format: 1, purpose: 'legacy', ownerId: 'admin-master-1' };
        }
      }
      this.saveDisk();
      fs.unlinkSync(LEGACY_MEDIA_INDEX);
    } catch (e) {
      console.error('Legacy media index migration failed:', e.message);
    }
  }

  async connectMongo() {
    if (!config.mongoUri) return;
    try {
      const mongoose = require('mongoose');
      mongoose.set('strictQuery', true);
      const schema = new mongoose.Schema({
        key: { type: String, default: 'main', unique: true },
        encryptedVault: { type: Object, required: true },
        updatedAt: { type: Date, default: Date.now }
      });
      this.Model = mongoose.models.SiteVault || mongoose.model('SiteVault', schema);
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 3000 });
      this.mongoReady = true;
      // If the disk vault was missing (e.g. fresh redeploy) restore from the database backup.
      if (!this.vaultExisted) {
        const doc = await this.Model.findOne({ key: 'main' }).lean();
        if (doc?.encryptedVault) {
          this.applyLoaded(JSON.parse(decryptData(doc.encryptedVault)));
          this.saveDisk();
          console.log('Restored data vault from MongoDB backup.');
        }
      }
      this.saveDisk();
    } catch (e) {
      this.mongoReady = false;
      console.warn('MongoDB backup not available:', e.message);
    }
  }

  saveDisk() {
    try {
      this.ensureMandatoryCollectionFirst();
      const encryptedVault = encryptData(this.state);
      const tmp = `${VAULT_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ cipher: 'AES-256-GCM', updatedAt: new Date().toISOString(), encryptedVault }), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.renameSync(tmp, VAULT_FILE); // atomic replace — a crash can't leave a half-written vault
      if (this.mongoReady && this.Model) {
        this.Model.findOneAndUpdate({ key: 'main' }, { encryptedVault, updatedAt: new Date() }, { upsert: true }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to save encrypted vault:', err.message);
    }
  }

  // ==================== CATALOG ====================

  ensureMandatoryCollectionFirst() {
    if (!this.state) return;
    const colIdx = this.state.sections.findIndex((s) => s.id === 'sec-collection' || s.isMandatory);
    if (colIdx === -1) this.state.sections.unshift(clone(DEFAULT_SECTIONS[0]));
    else if (colIdx > 0) {
      const [col] = this.state.sections.splice(colIdx, 1);
      col.isMandatory = true;
      this.state.sections.unshift(col);
    }
  }

  getAllProductsFlat() {
    const map = new Map();
    (this.state.sections || []).forEach((sec) => {
      (sec.products || []).forEach((p, idx) => {
        map.set(p.id, { ...p, sourceSectionId: sec.id, sourceSectionName: sec.name, _fallbackOrder: idx });
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tB !== tA) return tB - tA;
      return (a._fallbackOrder ?? 0) - (b._fallbackOrder ?? 0);
    });
  }

  findProduct(productId) {
    for (const sec of this.state.sections || []) {
      const p = (sec.products || []).find((x) => x.id === productId);
      if (p) return p;
    }
    return null;
  }

  // Public view: hidden (admin-only) fields are removed before leaving the server.
  publicProduct(p) {
    if (!p) return null;
    return { ...p, fields: (p.fields || []).filter((f) => f.visibleToClient !== false) };
  }

  getResolvedSections({ admin = false } = {}) {
    this.ensureMandatoryCollectionFirst();
    const view = (p) => (admin ? p : this.publicProduct(p));
    const allProducts = this.getAllProductsFlat().map(view);
    const flatMap = new Map(allProducts.map((p) => [p.id, p]));
    const newestFirst = (list) =>
      [...list].sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0));

    return this.state.sections.map((sec) => {
      const base = { ...sec, products: (sec.products || []).map(view) };
      if (sec.isMandatory || sec.id === 'sec-collection') {
        return { ...base, showOnHomepage: sec.showOnHomepage !== false, resolvedProducts: allProducts };
      }
      const linked = (sec.linkedProductIds || []).map((id) => flatMap.get(id)).filter(Boolean);
      const seen = new Set();
      const combined = [];
      [...base.products, ...linked].forEach((p) => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          combined.push(p);
        }
      });
      return { ...base, showOnHomepage: sec.showOnHomepage !== false, resolvedProducts: newestFirst(combined) };
    });
  }

  getBootstrap({ admin = false } = {}) {
    const sections = this.getResolvedSections({ admin });
    const allProducts = this.getAllProductsFlat().map((p) => (admin ? p : this.publicProduct(p)));
    return {
      config: this.state.config,
      sections,
      allProducts,
      delivery: { charge: DELIVERY_CHARGE, freeOver: FREE_DELIVERY_OVER },
      stats: {
        totalCategories: sections.filter((s) => !s.isMandatory && s.id !== 'sec-collection').length,
        totalProducts: allProducts.length
      }
    };
  }

  publicSearch(q) {
    const all = this.getAllProductsFlat().map((p) => this.publicProduct(p));
    const query = v.str(q, 100).toLowerCase();
    if (!query) return all;
    return all.filter((p) => {
      if ((p.name || '').toLowerCase().includes(query)) return true;
      if ((p.sourceSectionName || '').toLowerCase().includes(query)) return true;
      return (p.fields || []).some(
        (f) => !(f.label || '').toLowerCase().includes('description') && `${f.label} ${f.value}`.toLowerCase().includes(query)
      );
    });
  }

  updateConfig(updates = {}) {
    for (const key of CONFIG_KEYS) {
      if (updates[key] === undefined || typeof updates[key] !== 'object' || updates[key] === null) continue;
      const cleaned = cleanConfigValue(updates[key], key);
      if (key === 'theme') {
        const theme = { ...this.state.config.theme };
        for (const [k, val] of Object.entries(cleaned || {})) if (v.isHexColor(val)) theme[k] = val;
        this.state.config.theme = theme;
      } else {
        this.state.config[key] = { ...(this.state.config[key] || {}), ...cleaned };
      }
    }
    this.saveDisk();
    return this.state.config;
  }

  cleanProductInput(data, existing = null) {
    const out = {};
    if (data.price !== undefined || !existing) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0 || price > 10000000) return { error: 'Price must be a number between 0 and 10,000,000.' };
      out.price = Math.round(price * 100) / 100;
    }
    if (Array.isArray(data.images)) {
      const imgs = data.images.slice(0, 20).map(v.safeImageUrl).filter(Boolean);
      out.images = imgs;
    }
    if (Array.isArray(data.fields)) {
      out.fields = data.fields.slice(0, 40).map((f, i) => ({
        id: /^[A-Za-z0-9_-]{1,60}$/.test(String(f?.id || '')) ? String(f.id) : `f-${Date.now().toString(36)}-${i}`,
        label: v.str(f?.label, 60) || 'Detail',
        value: v.str(f?.value, 2000),
        visibleToClient: f?.visibleToClient === undefined ? true : Boolean(f.visibleToClient)
      }));
    }
    return { data: out };
  }

  addSection({ name, subheading, showOnHomepage = true }) {
    const cleanName = v.str(name, 80);
    if (!cleanName) return { error: 'Category / Section name is required.' };
    if (this.state.sections.length >= 100) return { error: 'Too many sections.' };
    if (this.state.sections.some((s) => (s.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
      return { error: `Category "${cleanName}" already exists. Duplicate categories cannot be added twice.` };
    }
    const sec = {
      id: newId('sec'),
      name: cleanName,
      subheading: v.str(subheading, 200),
      isMandatory: false,
      showOnHomepage: Boolean(showOnHomepage),
      linkedProductIds: [],
      products: []
    };
    this.state.sections.push(sec);
    this.saveDisk();
    return { section: sec };
  }

  updateSection(sectionId, updates = {}) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    if (updates.name !== undefined) {
      const cleanName = v.str(updates.name, 80);
      if (!cleanName) return { error: 'Section name cannot be empty.' };
      if (this.state.sections.some((s) => s.id !== sectionId && (s.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
        return { error: `Category "${cleanName}" already exists. Duplicate categories are not allowed.` };
      }
      sec.name = cleanName;
    }
    if (updates.subheading !== undefined) sec.subheading = v.str(updates.subheading, 200);
    if (updates.showOnHomepage !== undefined) sec.showOnHomepage = Boolean(updates.showOnHomepage);
    if (Array.isArray(updates.linkedProductIds)) {
      sec.linkedProductIds = [...new Set(updates.linkedProductIds.map(String))].filter((id) => this.findProduct(id)).slice(0, 1000);
    }
    this.saveDisk();
    return { section: sec };
  }

  deleteSection(sectionId) {
    const idx = this.state.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return { error: 'Section not found' };
    if (this.state.sections[idx].isMandatory || sectionId === 'sec-collection') {
      return { error: 'The mandatory "Our Collection" section cannot be deleted.' };
    }
    const [removed] = this.state.sections.splice(idx, 1);
    this.saveDisk();
    return { success: true, mediaIdsToPurge: (removed.products || []).flatMap((p) => this.mediaIdsFromImages(p.images)) };
  }

  addProductToSection(sectionId, productData = {}) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    const cleanName = v.str(productData.name, 150);
    if (!cleanName) return { error: 'Product name is required.' };
    if (this.getAllProductsFlat().some((p) => (p.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
      return { error: `Product "${cleanName}" already exists. Duplicate products cannot be added twice.` };
    }
    const c = this.cleanProductInput(productData);
    if (c.error) return c;
    const prod = {
      id: newId('prod'),
      name: cleanName,
      price: c.data.price,
      images: c.data.images?.length ? c.data.images : [unsplash('photo-1594938298603-c8148c4dae35')],
      fields: c.data.fields || [],
      createdAt: new Date().toISOString()
    };
    sec.products.unshift(prod);
    this.saveDisk();
    return { product: prod };
  }

  updateProductInSection(sectionId, productId, updates = {}) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    const idx = sec.products.findIndex((p) => p.id === productId);
    if (idx === -1) return { error: 'Product not found' };
    const current = sec.products[idx];

    let name = current.name;
    if (updates.name !== undefined) {
      name = v.str(updates.name, 150);
      if (!name) return { error: 'Product name cannot be empty.' };
      if (this.getAllProductsFlat().some((p) => p.id !== productId && (p.name || '').trim().toLowerCase() === name.toLowerCase())) {
        return { error: `Product "${name}" already exists. Duplicate products are not allowed.` };
      }
    }
    const c = this.cleanProductInput(updates, current);
    if (c.error) return c;
    const removedImages = c.data.images ? (current.images || []).filter((u) => !c.data.images.includes(u)) : [];
    sec.products[idx] = { ...current, name, ...c.data, updatedAt: new Date().toISOString() };
    this.saveDisk();
    return { product: sec.products[idx], mediaIdsToPurge: this.mediaIdsFromImages(removedImages) };
  }

  mediaIdsFromImages(images = []) {
    return (images || [])
      .map((url) => (String(url).match(/^\/api\/media\/stream\/([a-z0-9-]+)$/) || [])[1])
      .filter((id) => id && v.MEDIA_ID_RE.test(id));
  }

  deleteProduct(productId) {
    let removed = null;
    this.state.sections.forEach((s) => {
      const found = (s.products || []).find((p) => p.id === productId);
      if (found) removed = found;
      s.products = (s.products || []).filter((p) => p.id !== productId);
      if (Array.isArray(s.linkedProductIds)) s.linkedProductIds = s.linkedProductIds.filter((id) => id !== productId);
    });
    if (!removed) return null;
    this.saveDisk();
    return { removedProduct: removed, mediaIdsToPurge: this.mediaIdsFromImages(removed.images) };
  }

  // ==================== ORDERS (server-side pricing) ====================

  createOrder(user, body = {}) {
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return { error: 'Your cart is empty.' };
    if (items.length > MAX_ITEMS_PER_ORDER) return { error: 'Too many items in one order.' };

    const name = v.str(body.client?.name, 80) || user.fullName;
    const phone = v.normPhone(body.client?.phone || user.phone);
    const address = v.str(body.client?.address, 300);
    const notes = v.str(body.client?.notes, 500);
    if (!v.isPhone(phone)) return { error: 'Please enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).' };
    if (address.length < 5) return { error: 'Please enter your full delivery address.' };

    const seen = new Set();
    const lines = [];
    for (const it of items) {
      const productId = String(it?.id || it?.productId || '');
      if (seen.has(productId)) continue;
      seen.add(productId);
      const product = this.findProduct(productId);
      if (!product) return { error: 'One of the products in your cart is no longer available. Please refresh and try again.' };
      const qty = Math.floor(Number(it.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
        return { error: `Quantity for "${product.name}" must be between 1 and ${MAX_QTY_PER_ITEM}.` };
      }
      lines.push({
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0, // price from the catalog — never from the browser
        image: product.images?.[0] || '',
        quantity: qty
      });
    }
    const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
    const deliveryCharge = subtotal === 0 || subtotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_CHARGE;
    let id;
    do id = 'AX-ORD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    while (this.state.orders.some((o) => o.id === id));

    const order = {
      id,
      clientId: user.id,
      client: { name, phone, email: user.email, address, notes },
      items: lines,
      subtotal,
      deliveryCharge,
      totalAmount: subtotal + deliveryCharge,
      status: 'Booking Received',
      createdAt: new Date().toISOString()
    };
    this.state.orders.unshift(order);
    this.saveDisk();
    return { order };
  }

  getOrders() {
    return this.state.orders || [];
  }

  // ==================== MEDIA INDEX ====================

  addMedia(record) {
    this.state.media[record.id] = record;
    this.saveDisk();
  }

  getMedia(id) {
    return v.MEDIA_ID_RE.test(String(id)) ? this.state.media[id] || null : null;
  }

  removeMedia(ids = []) {
    const removed = [];
    ids.forEach((id) => {
      if (this.getMedia(id)) {
        delete this.state.media[id];
        removed.push(id);
      }
    });
    if (removed.length) this.saveDisk();
    return removed;
  }

  // ==================== CHAT ====================

  ensureThread(clientId, clientName = 'Customer', clientPhone = '', clientEmail = '') {
    if (!this.state.threads[clientId]) {
      this.state.threads[clientId] = {
        clientId,
        clientName: v.str(clientName, 80) || 'Customer',
        clientPhone: v.str(clientPhone, 30),
        clientEmail: v.str(clientEmail, 254),
        unreadAdmin: 0,
        unreadClient: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: newId('msg'),
            threadId: clientId,
            sender: 'admin',
            senderName: 'AXELON Admin',
            text: `Hello ${v.str(clientName, 80) || 'there'}! Welcome to AXELON Messenger. Send text, audio, video, photos, or PDFs anytime.`,
            attachments: [],
            inquiredProduct: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
      this.saveDisk();
    }
    return this.state.threads[clientId];
  }

  getThread(clientId) {
    return this.state.threads?.[clientId] || null;
  }

  addMessage({ clientId, sender, senderName, text, attachments = [], inquiredProduct = null }) {
    const thread = this.state.threads[clientId];
    if (!thread) return null;
    const msg = {
      id: newId('msg'),
      threadId: clientId,
      sender: sender === 'admin' ? 'admin' : 'client',
      senderName: v.str(senderName, 80) || (sender === 'admin' ? 'AXELON Admin' : thread.clientName),
      text: v.str(text, 4000),
      attachments,
      inquiredProduct,
      createdAt: new Date().toISOString()
    };
    thread.messages.push(msg);
    if (thread.messages.length > 2000) thread.messages.splice(0, thread.messages.length - 2000);
    thread.updatedAt = msg.createdAt;
    if (msg.sender === 'client') thread.unreadAdmin = (thread.unreadAdmin || 0) + 1;
    else thread.unreadClient = (thread.unreadClient || 0) + 1;
    this.saveDisk();
    return { thread, message: msg };
  }

  getAllThreads() {
    return Object.values(this.state.threads || {}).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  deleteMessage(clientId, messageId) {
    const thread = this.getThread(clientId);
    if (!thread) return null;
    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx === -1) return null;
    const [removed] = thread.messages.splice(idx, 1);
    thread.updatedAt = thread.messages.length ? thread.messages[thread.messages.length - 1].createdAt : new Date().toISOString();
    this.saveDisk();
    return { thread, removedAttachmentIds: (removed.attachments || []).map((a) => a.id).filter(Boolean) };
  }

  deleteThread(clientId) {
    const thread = this.getThread(clientId);
    if (!thread) return null;
    const removedAttachmentIds = (thread.messages || []).flatMap((m) => (m.attachments || []).map((a) => a.id)).filter(Boolean);
    delete this.state.threads[clientId];
    this.saveDisk();
    return { removedAttachmentIds };
  }

  // ==================== USERS ====================

  findUserById(id) {
    if (!id) return null;
    if (this.state.adminUser?.id === id) return this.state.adminUser;
    return (this.state.users || []).find((u) => u.id === id) || null;
  }

  findUserByEmail(email) {
    const norm = v.normEmail(email);
    if (!norm) return null;
    if (this.state.adminUser?.email?.toLowerCase() === norm) return this.state.adminUser;
    return (this.state.users || []).find((u) => u.email.toLowerCase() === norm) || null;
  }

  findUserByPhone(phone) {
    const norm = v.normPhone(phone).replace(/^\+?88/, '');
    if (!norm) return null;
    const same = (p) => v.normPhone(p).replace(/^\+?88/, '') === norm;
    if (same(this.state.adminUser?.phone)) return this.state.adminUser;
    return (this.state.users || []).find((u) => same(u.phone)) || null;
  }

  publicUser(u) {
    return { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, address: u.address, role: u.role };
  }

  setPasswordHash(user, passwordHash, { keepDeviceId = null } = {}) {
    user.passwordHash = passwordHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // revokes every existing session
    // Other devices must verify again by email after a password change
    user.trustedDevices = (user.trustedDevices || []).filter((d) => keepDeviceId && d.id === keepDeviceId);
    user.updatedAt = new Date().toISOString();
    this.saveDisk();
  }

  // ---------- Trusted devices (admin new-device email verification) ----------
  isTrustedDevice(user, deviceId) {
    if (!deviceId) return false;
    const d = (user.trustedDevices || []).find((x) => x.id === deviceId);
    if (!d) return false;
    d.lastUsedAt = new Date().toISOString();
    return true;
  }

  addTrustedDevice(user, userAgent = '') {
    const id = crypto.randomBytes(24).toString('hex');
    user.trustedDevices = (user.trustedDevices || []).slice(-19); // keep the 20 most recent devices
    user.trustedDevices.push({
      id,
      label: v.str(userAgent, 160),
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString()
    });
    this.saveDisk();
    return id;
  }

  changeEmail(user, newEmail) {
    const old = user.email;
    user.email = newEmail;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.updatedAt = new Date().toISOString();
    const t = this.state.threads?.[user.id];
    if (t) t.clientEmail = newEmail;
    this.saveDisk();
    return old;
  }

  // ==================== ONE-TIME CODES ====================

  hashOtp(purpose, email, code) {
    return crypto.createHmac('sha256', config.otpPepper).update(`${purpose}:${email}:${code}`).digest('hex');
  }

  purgeExpiredOtps() {
    const now = Date.now();
    let changed = false;
    for (const [email, p] of Object.entries(this.state.pendingOtps || {})) {
      if (now > (p.expiresAt || 0) && now - (p.windowStart || 0) > 60 * 60 * 1000) {
        delete this.state.pendingOtps[email];
        changed = true;
      }
    }
    if (changed) this.saveDisk();
  }

  // Returns { code } or { error, retryAfterSec }
  // Each purpose has its own slot + limits, so e.g. password-reset spam can't block admin sign-in codes.
  otpKey(purpose, email) {
    return `${purpose}|${email}`;
  }

  getPendingOtp(purpose, email) {
    return this.state.pendingOtps[this.otpKey(purpose, email)] || null;
  }

  createOtp(purpose, email, payload = null) {
    const now = Date.now();
    const key = this.otpKey(purpose, email);
    const prev = this.state.pendingOtps[key];
    let windowStart = now;
    let sends = 0;
    if (prev && now - (prev.windowStart || 0) < 60 * 60 * 1000) {
      windowStart = prev.windowStart;
      sends = prev.sends || 0;
      if (now - (prev.lastSentAt || 0) < OTP_RESEND_COOLDOWN_MS) {
        return { error: 'Please wait a minute before requesting another code.', retryAfterSec: 60 };
      }
      if (sends >= OTP_MAX_SENDS_PER_HOUR) {
        return { error: 'Too many codes requested for this email. Please try again in an hour.', retryAfterSec: 3600 };
      }
    }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    this.state.pendingOtps[key] = {
      purpose,
      codeHash: this.hashOtp(purpose, email, code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      sends: sends + 1,
      windowStart,
      lastSentAt: now,
      payload
    };
    this.saveDisk();
    return { code };
  }

  // Returns { pending } on success or { error }
  verifyOtp(purpose, email, code) {
    const generic = { error: 'Invalid or expired code. Please check the code or request a new one.' };
    const pending = this.state.pendingOtps[this.otpKey(purpose, email)];
    if (!pending || pending.purpose !== purpose || !pending.codeHash) return generic;
    if (Date.now() > pending.expiresAt || pending.attempts >= OTP_MAX_ATTEMPTS) {
      pending.codeHash = null; // burn the code, keep send counters
      this.saveDisk();
      return generic;
    }
    const provided = Buffer.from(this.hashOtp(purpose, email, String(code || '').trim()), 'hex');
    const expected = Buffer.from(pending.codeHash, 'hex');
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      pending.attempts += 1;
      if (pending.attempts >= OTP_MAX_ATTEMPTS) pending.codeHash = null;
      this.saveDisk();
      return pending.attempts >= OTP_MAX_ATTEMPTS
        ? { error: 'Too many wrong attempts. Please request a new code.' }
        : generic;
    }
    const result = { pending: { ...pending } };
    pending.codeHash = null; // single use
    pending.payload = null;
    this.saveDisk();
    return result;
  }

  createUserFromPending(payload) {
    const user = {
      id: newId('user'),
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      role: 'customer',
      emailVerified: true,
      tokenVersion: 0,
      passwordHash: payload.passwordHash,
      createdAt: new Date().toISOString()
    };
    this.state.users.unshift(user);
    this.saveDisk();
    return user;
  }

  // ==================== ADMIN: CLIENT ACCOUNTS ====================

  getAllClients() {
    return (this.state.users || []).map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role || 'customer',
      emailVerified: Boolean(u.emailVerified ?? true),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt || null
    }));
  }

  validateProfile({ fullName, email, phone, address }, { partial = false } = {}) {
    const out = {};
    if (!partial || fullName !== undefined) {
      out.fullName = v.str(fullName, 80);
      if (!out.fullName) return { error: 'Full name is required.' };
    }
    if (!partial || email !== undefined) {
      out.email = v.normEmail(email);
      if (!v.isEmail(out.email)) return { error: 'Please provide a valid email address.' };
    }
    if (!partial || phone !== undefined) {
      out.phone = v.normPhone(phone);
      if (!v.isPhone(out.phone)) return { error: 'Please enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX).' };
    }
    if (!partial || address !== undefined) {
      out.address = v.str(address, 300);
      if (out.address.length < 5) return { error: 'Please enter a full address.' };
    }
    return { data: out };
  }

  adminCreateClient(profile, passwordHash) {
    const user = {
      id: newId('user'),
      ...profile,
      role: 'customer',
      emailVerified: true,
      tokenVersion: 0,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    this.state.users.unshift(user);
    this.saveDisk();
    return user;
  }

  adminUpdateClient(userId, data, passwordHash = null) {
    const u = (this.state.users || []).find((x) => x.id === userId);
    if (!u) return { error: 'Client account not found.' };
    if (data.email && data.email !== u.email) {
      const c = this.findUserByEmail(data.email);
      if (c && c.id !== userId) return { error: 'This email address is already used by another account.' };
    }
    if (data.phone && v.normPhone(data.phone) !== v.normPhone(u.phone)) {
      const c = this.findUserByPhone(data.phone);
      if (c && c.id !== userId) return { error: 'This phone number is already used by another account.' };
    }
    const emailChanged = data.email && data.email !== u.email;
    Object.assign(u, data);
    if (passwordHash || emailChanged) {
      u.tokenVersion = (u.tokenVersion || 0) + 1;
      if (passwordHash) u.passwordHash = passwordHash;
    }
    u.updatedAt = new Date().toISOString();
    this.saveDisk();
    return { client: u };
  }

  adminDeleteClient(userId) {
    const idx = (this.state.users || []).findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    this.state.users.splice(idx, 1);
    this.saveDisk();
    return true;
  }
}

const store = new SiteStore();
store.DELIVERY_CHARGE = DELIVERY_CHARGE;
store.FREE_DELIVERY_OVER = FREE_DELIVERY_OVER;
module.exports = store;
