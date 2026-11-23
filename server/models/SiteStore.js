const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encryptData, decryptData } = require('../security/cryptoVault');

const VAULT_FILE = path.join(__dirname, 'axelon_vault.enc.json');

const SiteVaultSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  encryptedVault: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

const SiteVaultModel = mongoose.models.SiteVault || mongoose.model('SiteVault', SiteVaultSchema);

const DEFAULT_STATE = {
  config: {
    theme: {
      navyDark: '#060F24',
      navyPrimary: '#0F2557',
      biscuit: '#DBBB97',
      goldBrown: '#B8844E'
    },
    topAnnouncementBar: {
      enabled: true,
      message: 'Welcome to Our New 2026 Collection — Free Express Home Delivery Across Bangladesh on Orders Over TK 3,000'
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
        {
          id: 'ft-contact',
          title: 'Contact',
          content: 'Phone: 01600332120\nEmail: aajmhtaseen@gmail.com'
        },
        {
          id: 'ft-location',
          title: 'Location',
          content: '1126, Jhawtola, Cumilla, Bangladesh'
        },
        {
          id: 'ft-about',
          title: 'About Us',
          content: 'AXELON is a modern luxury apparel store delivering premium quality fabrics, tailored silhouettes, and direct customer care across Bangladesh.'
        },
        {
          id: 'ft-privacy',
          title: 'Privacy & Policy',
          content: 'Your personal details, orders, and messages are protected with end-to-end AES-256-GCM encryption and are never shared with third parties.'
        }
      ],
      linksSectionTitle: 'Links',
      showLinksSection: true,
      socialLinks: [
        { id: 'soc-fb', label: 'Facebook', icon: 'facebook', url: 'https://facebook.com' },
        { id: 'soc-ig', label: 'Instagram', icon: 'instagram', url: 'https://instagram.com' },
        { id: 'soc-tw', label: 'Twitter', icon: 'twitter', url: 'https://twitter.com' }
      ],
      copyright: '@AXELOn All rights Reserved'
    }
  },
  // All product sections: "Our Collection" is ALWAYS mandatory and first!
  sections: [
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
          images: [
            'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=900&q=85',
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=85'
          ],
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
          images: [
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85',
            'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=85'
          ],
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
          images: [
            'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=85'
          ],
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
          images: [
            'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=85'
          ],
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
          images: [
            'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=85'
          ],
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
          images: [
            'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=900&q=85'
          ],
          fields: [
            { id: 'f1', label: 'Category', value: 'Outerwear', visibleToClient: true },
            { id: 'f2', label: 'Size', value: 'M, L, XL', visibleToClient: true },
            { id: 'f3', label: 'Color', value: 'Midnight Navy', visibleToClient: true }
          ]
        }
      ]
    }
  ],
  orders: [],
  users: [],
  pendingOtps: {}, // email -> { codeHash, purpose: 'register' | 'reset', expiresAt, payload }
  adminUser: {
    id: 'admin-master-1',
    fullName: process.env.ADMIN_FULL_NAME || 'Mahmudul Hassan Taseen',
    phone: process.env.ADMIN_PHONE || '01600332120',
    email: process.env.ADMIN_EMAIL || 'aajmhtaseen@gmail.com',
    address: process.env.ADMIN_ADDRESS || '1126, Jhawtola, Cumilla',
    role: 'admin',
    emailVerified: true,
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Abc@1234', 12)
  },
  threads: {
    'client-demo-1': {
      clientId: 'client-demo-1',
      clientName: 'Ariful Islam',
      clientPhone: '01711-000111',
      clientEmail: 'ariful@example.com',
      unreadAdmin: 0,
      unreadClient: 0,
      updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      messages: [
        {
          id: 'msg-demo-1',
          threadId: 'client-demo-1',
          sender: 'admin',
          senderName: 'AXELON Admin',
          text: 'Welcome to AXELON Messenger. You can ask about any product or send text, voice notes, images, videos, or PDFs up to 100MB.',
          attachments: [],
          inquiredProduct: null,
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        }
      ]
    }
  }
};

class SiteStore {
  constructor() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.mongoReady = false;
    this.init();
  }

  async init() {
    if (fs.existsSync(VAULT_FILE)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
        const decrypted = decryptData(fileData.encryptedVault);
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          this.state = {
            ...DEFAULT_STATE,
            ...parsed,
            config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) },
            sections: Array.isArray(parsed.sections) && parsed.sections.length ? parsed.sections : DEFAULT_STATE.sections,
            users: Array.isArray(parsed.users) ? parsed.users : [],
            pendingOtps: parsed.pendingOtps || {},
            adminUser: parsed.adminUser?.email ? parsed.adminUser : DEFAULT_STATE.adminUser
          };
          this.ensureMandatoryCollectionFirst();
        }
      } catch (e) {
        console.error('Vault load warning:', e.message);
      }
    } else {
      this.saveDisk();
    }

    if (process.env.MONGO_URI) {
      try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 1800 });
        this.mongoReady = true;
      } catch {
        this.mongoReady = false;
      }
    }
  }

  ensureMandatoryCollectionFirst() {
    let colIdx = this.state.sections.findIndex((s) => s.id === 'sec-collection' || s.isMandatory);
    if (colIdx === -1) {
      this.state.sections.unshift(JSON.parse(JSON.stringify(DEFAULT_STATE.sections[0])));
    } else if (colIdx > 0) {
      const [col] = this.state.sections.splice(colIdx, 1);
      col.isMandatory = true;
      this.state.sections.unshift(col);
    }
  }

  saveDisk() {
    try {
      this.ensureMandatoryCollectionFirst();
      fs.writeFileSync(
        VAULT_FILE,
        JSON.stringify(
          {
            cipher: 'AES-256-GCM',
            updatedAt: new Date().toISOString(),
            encryptedVault: encryptData(this.state)
          },
          null,
          2
        ),
        'utf8'
      );
      if (this.mongoReady) {
        SiteVaultModel.findOneAndUpdate(
          { key: 'main' },
          { encryptedVault: encryptData(this.state), updatedAt: new Date() },
          { upsert: true }
        ).catch(() => { });
      }
    } catch (err) {
      console.error('Failed to save encrypted vault:', err.message);
    }
  }

  getAllProductsFlat() {
    const map = new Map();
    (this.state.sections || []).forEach((sec) => {
      (sec.products || []).forEach((p) => {
        map.set(p.id, { ...p, sourceSectionId: sec.id, sourceSectionName: sec.name });
      });
    });
    return Array.from(map.values());
  }

  getResolvedSections() {
    this.ensureMandatoryCollectionFirst();
    const allProducts = this.getAllProductsFlat();
    const flatMap = new Map();
    allProducts.forEach((p) => flatMap.set(p.id, p));

    return this.state.sections.map((sec) => {
      // Mandatory "Our Collection" displays ALL website products across every category together!
      if (sec.isMandatory || sec.id === 'sec-collection') {
        return {
          ...sec,
          name: sec.name === 'Collection' ? 'Our Collection' : sec.name,
          showOnHomepage: sec.showOnHomepage !== false,
          resolvedProducts: allProducts
        };
      }

      const linked = (sec.linkedProductIds || [])
        .map((id) => flatMap.get(id))
        .filter(Boolean);
      const own = sec.products || [];
      const seen = new Set();
      const combined = [];
      [...own, ...linked].forEach((p) => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          combined.push(p);
        }
      });
      return {
        ...sec,
        showOnHomepage: sec.showOnHomepage !== false,
        resolvedProducts: combined
      };
    });
  }

  getBootstrap() {
    const resolvedSections = this.getResolvedSections();
    const allProducts = this.getAllProductsFlat();
    const categoryCount = resolvedSections.filter((s) => !s.isMandatory && s.id !== 'sec-collection').length;
    return {
      config: this.state.config,
      sections: resolvedSections,
      allProducts,
      stats: {
        totalCategories: categoryCount,
        totalProducts: allProducts.length
      }
    };
  }

  updateConfig(updates) {
    this.state.config = { ...this.state.config, ...updates };
    this.saveDisk();
    return this.state.config;
  }

  addSection({ name, subheading, showOnHomepage = true }) {
    const cleanName = (name || '').trim();
    if (!cleanName) return { error: 'Category / Section name is required.' };
    const exists = this.state.sections.some(
      (s) => (s.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      return { error: `Category "${cleanName}" already exists. Duplicate categories cannot be added twice.` };
    }

    const newSec = {
      id: 'sec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      name: cleanName,
      subheading: (subheading || '').trim(),
      isMandatory: false,
      showOnHomepage: Boolean(showOnHomepage),
      linkedProductIds: [],
      products: []
    };
    this.state.sections.push(newSec);
    this.saveDisk();
    return { section: newSec };
  }

  updateSection(sectionId, updates) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim();
      if (!cleanName) return { error: 'Section name cannot be empty.' };
      const duplicate = this.state.sections.some(
        (s) => s.id !== sectionId && (s.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        return { error: `Category "${cleanName}" already exists. Duplicate categories are not allowed.` };
      }
      sec.name = cleanName;
    }
    if (updates.subheading !== undefined) sec.subheading = String(updates.subheading).trim();
    if (updates.showOnHomepage !== undefined) sec.showOnHomepage = Boolean(updates.showOnHomepage);
    if (Array.isArray(updates.linkedProductIds)) sec.linkedProductIds = updates.linkedProductIds;
    this.saveDisk();
    return { section: sec };
  }

  deleteSection(sectionId) {
    const idx = this.state.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return { error: 'Section not found' };
    if (this.state.sections[idx].isMandatory || sectionId === 'sec-collection') {
      return { error: 'The mandatory "Our Collection" section cannot be deleted.' };
    }
    this.state.sections.splice(idx, 1);
    this.saveDisk();
    return { success: true };
  }

  addProductToSection(sectionId, productData) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    const cleanName = (productData.name || '').trim();
    if (!cleanName) return { error: 'Product name is required.' };

    const all = this.getAllProductsFlat();
    if (all.some((p) => (p.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
      return { error: `Product "${cleanName}" already exists. Duplicate products cannot be added twice.` };
    }

    const newProd = {
      id: 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      name: cleanName,
      price: Number(productData.price) || 0,
      images: Array.isArray(productData.images) && productData.images.length
        ? productData.images
        : ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=900&q=85'],
      fields: Array.isArray(productData.fields)
        ? productData.fields.map((f, i) => ({
          id: f.id || `f-${Date.now()}-${i}`,
          label: (f.label || 'Detail').trim(),
          value: String(f.value ?? '').trim(),
          visibleToClient: Boolean(f.visibleToClient ?? true)
        }))
        : []
    };
    sec.products.unshift(newProd);
    this.saveDisk();
    return { product: newProd };
  }

  updateProductInSection(sectionId, productId, updates) {
    const sec = this.state.sections.find((s) => s.id === sectionId);
    if (!sec) return { error: 'Section not found' };
    const idx = sec.products.findIndex((p) => p.id === productId);
    if (idx === -1) return { error: 'Product not found' };

    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim();
      const all = this.getAllProductsFlat();
      if (all.some((p) => p.id !== productId && (p.name || '').trim().toLowerCase() === cleanName.toLowerCase())) {
        return { error: `Product "${cleanName}" already exists. Duplicate products are not allowed.` };
      }
      sec.products[idx].name = cleanName;
    }

    sec.products[idx] = {
      ...sec.products[idx],
      price: updates.price !== undefined ? Number(updates.price) : sec.products[idx].price,
      images: Array.isArray(updates.images) ? updates.images : sec.products[idx].images,
      fields: Array.isArray(updates.fields) ? updates.fields : sec.products[idx].fields
    };
    this.saveDisk();
    return { product: sec.products[idx] };
  }

  deleteProductFromSection(sectionId, productId) {
    let removedProduct = null;
    this.state.sections.forEach((s) => {
      const found = (s.products || []).find((p) => p.id === productId);
      if (found) removedProduct = found;
      s.products = (s.products || []).filter((p) => p.id !== productId);
      if (Array.isArray(s.linkedProductIds)) {
        s.linkedProductIds = s.linkedProductIds.filter((id) => id !== productId);
      }
    });
    if (!removedProduct) return null;

    // Extract any local encrypted media IDs (/api/media/stream/<fileId>) so disk files are also permanently deleted
    const mediaIdsToPurge = (removedProduct.images || [])
      .map((url) => {
        const match = String(url).match(/\/api\/media\/stream\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    this.saveDisk();
    return { removedProduct, mediaIdsToPurge };
  }

  createOrder(orderPayload) {
    const order = {
      id: 'AX-ORD-' + Math.floor(100000 + Math.random() * 900000),
      clientId: orderPayload.clientId,
      client: {
        name: orderPayload.client?.name || 'Customer',
        phone: orderPayload.client?.phone || '',
        email: orderPayload.client?.email || '',
        address: orderPayload.client?.address || '',
        notes: orderPayload.client?.notes || ''
      },
      encryptedClientRecord: encryptData(orderPayload.client || {}),
      items: orderPayload.items || [],
      subtotal: Number(orderPayload.subtotal) || 0,
      deliveryCharge: Number(orderPayload.deliveryCharge) || 0,
      totalAmount: Number(orderPayload.totalAmount) || 0,
      status: 'Booking Received',
      createdAt: new Date().toISOString()
    };
    this.state.orders.unshift(order);
    this.saveDisk();
    return order;
  }

  getOrders() {
    return this.state.orders || [];
  }

  ensureThread(clientId, clientName = 'Customer', clientPhone = '', clientEmail = '') {
    if (!this.state.threads[clientId]) {
      this.state.threads[clientId] = {
        clientId,
        clientName: clientName || 'Customer',
        clientPhone: clientPhone || '',
        clientEmail: clientEmail || '',
        unreadAdmin: 0,
        unreadClient: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-welcome-' + Date.now(),
            threadId: clientId,
            sender: 'admin',
            senderName: 'AXELON Admin',
            text: `Hello ${clientName || 'there'}! Welcome to AXELON Messenger. Send text, audio, video, photos, or PDFs (up to 100MB) anytime.`,
            attachments: [],
            inquiredProduct: null,
            createdAt: new Date().toISOString()
          }
        ]
      };
      this.saveDisk();
    } else {
      const t = this.state.threads[clientId];
      if (clientName && clientName !== 'Customer') t.clientName = clientName;
      if (clientPhone) t.clientPhone = clientPhone;
      if (clientEmail) t.clientEmail = clientEmail;
    }
    return this.state.threads[clientId];
  }

  addMessage({ clientId, clientName, clientPhone, clientEmail, sender, senderName, text, attachments = [], inquiredProduct = null }) {
    const thread = this.ensureThread(clientId, clientName, clientPhone, clientEmail);
    const msg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      threadId: clientId,
      sender: sender === 'admin' ? 'admin' : 'client',
      senderName: senderName || (sender === 'admin' ? 'AXELON Admin' : thread.clientName),
      text: text || '',
      encryptedBody: encryptData({ text: text || '', attachmentsCount: attachments.length }),
      attachments,
      inquiredProduct,
      createdAt: new Date().toISOString()
    };
    thread.messages.push(msg);
    thread.updatedAt = msg.createdAt;
    if (msg.sender === 'client') thread.unreadAdmin = (thread.unreadAdmin || 0) + 1;
    else thread.unreadClient = (thread.unreadClient || 0) + 1;
    this.saveDisk();
    return { thread, message: msg };
  }

  getAllThreads() {
    return Object.values(this.state.threads || {}).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    );
  }

  deleteMessage(clientId, messageId) {
    const thread = this.state.threads?.[clientId];
    if (!thread) return null;
    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx === -1) return null;

    const [removed] = thread.messages.splice(idx, 1);
    const removedAttachmentIds = (removed.attachments || []).map((a) => a.id).filter(Boolean);
    thread.updatedAt = thread.messages.length
      ? thread.messages[thread.messages.length - 1].createdAt
      : new Date().toISOString();

    this.saveDisk();
    return { thread, removedAttachmentIds };
  }

  deleteThread(clientId) {
    const thread = this.state.threads?.[clientId];
    if (!thread) return null;

    const removedAttachmentIds = [];
    (thread.messages || []).forEach((m) => {
      (m.attachments || []).forEach((a) => {
        if (a.id) removedAttachmentIds.push(a.id);
      });
    });

    delete this.state.threads[clientId];
    this.saveDisk();
    return { removedAttachmentIds };
  }

  // ==================== AUTHENTICATION, EMAIL OTP VERIFICATION & PASSWORD RESET ====================

  validatePasswordStrength(password = '') {
    if (typeof password !== 'string' || password.length < 8) {
      return 'Password must be at least 8 characters long.';
    }
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter (a-z).';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter (A-Z).';
    if (!/[0-9]/.test(password)) return 'Password must include at least one digit (0-9).';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      return 'Password must include at least one special character (e.g. !, @, ), #, $).';
    }
    return null;
  }

  normalizePhone(phone = '') {
    return String(phone).replace(/[\s\-()]/g, '').trim();
  }

  findUserByEmail(email = '') {
    const norm = String(email).toLowerCase().trim();
    if (!norm) return null;
    if (this.state.adminUser?.email?.toLowerCase() === norm) {
      return this.state.adminUser;
    }
    return (this.state.users || []).find((u) => u.email.toLowerCase() === norm) || null;
  }

  findUserByPhone(phone = '') {
    const norm = this.normalizePhone(phone);
    if (!norm) return null;
    if (this.normalizePhone(this.state.adminUser?.phone) === norm) {
      return this.state.adminUser;
    }
    return (this.state.users || []).find((u) => this.normalizePhone(u.phone) === norm) || null;
  }

  createRegistrationOtp({ fullName, email, phone, address, password }) {
    const normEmail = String(email || '').toLowerCase().trim();
    const normPhone = this.normalizePhone(phone);

    if (!fullName?.trim() || !normEmail || !normPhone || !address?.trim() || !password) {
      return { error: 'All fields (Full Name, Email, Phone Number, Address, Password) are required.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail)) {
      return { error: 'Please provide a valid email address.' };
    }
    const pwErr = this.validatePasswordStrength(password);
    if (pwErr) return { error: pwErr };

    if (this.findUserByEmail(normEmail)) {
      return { error: 'An account with this email address already exists. Only 1 account is allowed per email.' };
    }
    if (this.findUserByPhone(normPhone)) {
      return { error: 'An account with this phone number already exists. Only 1 account is allowed per phone number.' };
    }

    const code = String(crypto.randomInt(100000, 999999));
    if (!this.state.pendingOtps) this.state.pendingOtps = {};
    this.state.pendingOtps[normEmail] = {
      purpose: 'register',
      codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      payload: {
        fullName: fullName.trim(),
        email: normEmail,
        phone: normPhone,
        address: address.trim(),
        passwordHash: bcrypt.hashSync(password, 12)
      }
    };
    this.saveDisk();
    return { email: normEmail, verificationCode: code };
  }

  verifyRegistrationOtp(email, code) {
    const normEmail = String(email || '').toLowerCase().trim();
    const pending = this.state.pendingOtps?.[normEmail];
    if (!pending || pending.purpose !== 'register') {
      return { error: 'No pending email verification found. Please request a new code.' };
    }
    if (Date.now() > pending.expiresAt) {
      delete this.state.pendingOtps[normEmail];
      this.saveDisk();
      return { error: 'Verification code expired. Please register again.' };
    }
    const providedHash = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (providedHash !== pending.codeHash) {
      return { error: 'Invalid verification code. Please check and try again.' };
    }

    // Re-check uniqueness before finalizing
    if (this.findUserByEmail(normEmail) || this.findUserByPhone(pending.payload.phone)) {
      delete this.state.pendingOtps[normEmail];
      this.saveDisk();
      return { error: 'An account with this email or phone number already exists.' };
    }

    const newUser = {
      id: 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      fullName: pending.payload.fullName,
      email: normEmail,
      phone: pending.payload.phone,
      address: pending.payload.address,
      role: 'customer',
      emailVerified: true,
      passwordHash: pending.payload.passwordHash,
      encryptedProfile: encryptData({
        fullName: pending.payload.fullName,
        email: normEmail,
        phone: pending.payload.phone,
        address: pending.payload.address
      }),
      createdAt: new Date().toISOString()
    };

    if (!Array.isArray(this.state.users)) this.state.users = [];
    this.state.users.unshift(newUser);
    delete this.state.pendingOtps[normEmail];
    this.saveDisk();
    return { user: newUser };
  }

  createPasswordResetOtp(email) {
    const normEmail = String(email || '').toLowerCase().trim();
    const user = this.findUserByEmail(normEmail);
    if (!user) {
      return { error: 'No registered account found with this email address.' };
    }
    const code = String(crypto.randomInt(100000, 999999));
    if (!this.state.pendingOtps) this.state.pendingOtps = {};
    this.state.pendingOtps[normEmail] = {
      purpose: 'reset',
      codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    this.saveDisk();
    return { email: normEmail, verificationCode: code };
  }

  confirmPasswordReset(email, code, newPassword) {
    const normEmail = String(email || '').toLowerCase().trim();
    const pwErr = this.validatePasswordStrength(newPassword);
    if (pwErr) return { error: pwErr };

    const pending = this.state.pendingOtps?.[normEmail];
    if (!pending || pending.purpose !== 'reset') {
      return { error: 'No password reset code found for this email.' };
    }
    if (Date.now() > pending.expiresAt) {
      delete this.state.pendingOtps[normEmail];
      this.saveDisk();
      return { error: 'Reset code expired. Please request a new one.' };
    }
    const providedHash = crypto.createHash('sha256').update(String(code || '').trim()).digest('hex');
    if (providedHash !== pending.codeHash) {
      return { error: 'Invalid verification code.' };
    }

    const user = this.findUserByEmail(normEmail);
    if (!user) return { error: 'Account not found.' };

    user.passwordHash = bcrypt.hashSync(newPassword, 12);
    delete this.state.pendingOtps[normEmail];
    this.saveDisk();
    return { success: true };
  }

  // ==================== ADMIN CLIENT ACCOUNTS CRUD (VIEW, ADD, EDIT, PASSWORD, DELETE) ====================

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

  adminCreateClient({ fullName, email, phone, address, password }) {
    const normEmail = String(email || '').toLowerCase().trim();
    const normPhone = this.normalizePhone(phone);
    if (!fullName?.trim() || !normEmail || !normPhone || !address?.trim() || !password) {
      return { error: 'Full Name, Email, Phone Number, Address, and Password are all required.' };
    }
    const pwErr = this.validatePasswordStrength(password);
    if (pwErr) return { error: pwErr };

    if (this.findUserByEmail(normEmail)) {
      return { error: 'An account with this email already exists.' };
    }
    if (this.findUserByPhone(normPhone)) {
      return { error: 'An account with this phone number already exists.' };
    }

    const newUser = {
      id: 'user-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      fullName: fullName.trim(),
      email: normEmail,
      phone: normPhone,
      address: address.trim(),
      role: 'customer',
      emailVerified: true,
      passwordHash: bcrypt.hashSync(password, 12),
      encryptedProfile: encryptData({ fullName: fullName.trim(), email: normEmail, phone: normPhone, address: address.trim() }),
      createdAt: new Date().toISOString()
    };
    if (!Array.isArray(this.state.users)) this.state.users = [];
    this.state.users.unshift(newUser);
    this.saveDisk();
    return { client: newUser };
  }

  adminUpdateClient(userId, { fullName, email, phone, address, newPassword }) {
    const idx = (this.state.users || []).findIndex((u) => u.id === userId);
    if (idx === -1) return { error: 'Client account not found.' };
    const u = this.state.users[idx];

    if (email !== undefined) {
      const normEmail = String(email).toLowerCase().trim();
      if (normEmail !== u.email.toLowerCase()) {
        const conflict = this.findUserByEmail(normEmail);
        if (conflict && conflict.id !== userId) {
          return { error: 'This email address is already used by another account.' };
        }
        u.email = normEmail;
      }
    }

    if (phone !== undefined) {
      const normPhone = this.normalizePhone(phone);
      if (normPhone !== this.normalizePhone(u.phone)) {
        const conflict = this.findUserByPhone(normPhone);
        if (conflict && conflict.id !== userId) {
          return { error: 'This phone number is already used by another account.' };
        }
        u.phone = normPhone;
      }
    }

    if (fullName && fullName.trim()) u.fullName = fullName.trim();
    if (address && address.trim()) u.address = address.trim();

    if (newPassword && newPassword.trim()) {
      const pwErr = this.validatePasswordStrength(newPassword.trim());
      if (pwErr) return { error: pwErr };
      u.passwordHash = bcrypt.hashSync(newPassword.trim(), 12);
    }

    u.encryptedProfile = encryptData({
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      address: u.address
    });
    u.updatedAt = new Date().toISOString();
    this.state.users[idx] = u;
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

module.exports = new SiteStore();
