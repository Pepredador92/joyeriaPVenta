import { Product, Customer, Sale, CashSession, Setting, InventoryMovement } from '../../shared/types';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

class DatabaseService {
  // Ahora arrancamos sin datos de ejemplo; los arreglos comienzan vacíos.
  private products: Product[] = [];
  private customers: Customer[] = [];
  private sales: Sale[] = [];
  private cashSessions: CashSession[] = [];
  private settings: Setting[] = [
    {
      id: 1,
      key: 'business_name',
  value: 'Vangelico',
      description: 'Nombre del negocio',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      key: 'tax_rate',
      value: '0.16',
      description: 'Tasa de IVA (16%)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  private settingsFilePath: string | null = null;
  private productsFilePath: string | null = null;
  private customersFilePath: string | null = null;
  private salesFilePath: string | null = null;
  private cashSessionsFilePath: string | null = null;

  private saleItemSequence = 0;
  private inventoryMovementSequence = 0;
  private categoryDisplayById = new Map<string, string>();

  private normalizeCategoryId(name: string | undefined | null): string {
    return (name ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private cleanCategoryName(name: string | undefined | null): string {
    return (name ?? '')
      .toString()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private formatCategoryDisplay(name: string): string {
    const clean = this.cleanCategoryName(name);
    if (!clean) return '';
    return clean
      .split(' ')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim();
  }

  private ensureCategoryCatalogEntry(raw: string): { id: string; name: string } {
    const normalizedId = this.normalizeCategoryId(raw);
    if (!normalizedId) return { id: '', name: '' };
    const existing = this.categoryDisplayById.get(normalizedId);
    const formatted = this.formatCategoryDisplay(raw) || this.formatCategoryDisplay(normalizedId) || 'Otros';
    if (existing) {
      if (formatted && formatted !== existing) {
        this.categoryDisplayById.set(normalizedId, formatted);
        return { id: normalizedId, name: formatted };
      }
      return { id: normalizedId, name: existing };
    }
    this.categoryDisplayById.set(normalizedId, formatted);
    return { id: normalizedId, name: formatted };
  }

  private rebuildCategoryCatalog() {
    this.categoryDisplayById = new Map<string, string>();
    for (const product of this.products) {
      const source = product.category || product.categoryId || '';
      const entry = this.ensureCategoryCatalogEntry(source);
      if (entry.id) {
        product.categoryId = entry.id;
        product.category = entry.name;
      } else {
        product.categoryId = undefined;
        product.category = '';
      }
    }
  }

  private cleanSku(value: string | undefined | null): string {
    return (value ?? '').toString().trim().toUpperCase();
  }

  private cleanName(value: string | undefined | null): string {
    return this.cleanCategoryName(value) || '';
  }

  private cleanDescription(value: string | undefined | null): string | undefined {
    const clean = this.cleanCategoryName(value);
    return clean || undefined;
  }

  private cleanStock(value: number | string | undefined | null): number {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.floor(num));
  }

  // Productos
  async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const nowIso = new Date().toISOString();
    const { id: categoryId, name: categoryName } = this.ensureCategoryCatalogEntry(
      productData.category || productData.categoryId || 'Otros'
    );
    const newProduct: Product = {
      id: Math.max(...this.products.map((p) => p.id), 0) + 1,
      sku: this.cleanSku(productData.sku),
      name: this.cleanName(productData.name),
      price: Number.isFinite(productData.price) ? Number(productData.price) : 0,
      stock: this.cleanStock(productData.stock),
      categoryId: categoryId || undefined,
      category: categoryName,
      description: this.cleanDescription(productData.description),
      createdAt: nowIso,
      updatedAt: nowIso,
    } as Product;
    this.products.push(newProduct);
    this.rebuildCategoryCatalog();
    await this.saveProductsToDiskSafe();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const current = this.products[index];
    const patch: Partial<Product> = {};
    const nowIso = new Date().toISOString();

    if (typeof productData.sku === 'string') patch.sku = this.cleanSku(productData.sku);
    if (typeof productData.name === 'string') patch.name = this.cleanName(productData.name);
    if (typeof productData.description !== 'undefined') patch.description = this.cleanDescription(productData.description);
    if (typeof productData.stock !== 'undefined') patch.stock = this.cleanStock(productData.stock);
    if (typeof productData.price !== 'undefined') patch.price = Number(productData.price);

    if (typeof productData.category !== 'undefined' || typeof productData.categoryId !== 'undefined') {
      const rawCategory =
        (typeof productData.category === 'string' && productData.category) ||
        (typeof productData.categoryId === 'string' && productData.categoryId) ||
        current.category ||
        current.categoryId ||
        '';
      const entry = this.ensureCategoryCatalogEntry(rawCategory);
      patch.category = entry.name;
      patch.categoryId = entry.id || undefined;
    }

    this.products[index] = {
      ...current,
      ...patch,
      updatedAt: nowIso,
    } as Product;
    this.rebuildCategoryCatalog();
    await this.saveProductsToDiskSafe();
    return this.products[index];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.products.splice(index, 1);
    this.rebuildCategoryCatalog();
    await this.saveProductsToDiskSafe();
    return true;
  }

  // Clientes
  async getCustomers(): Promise<Customer[]> {
    return [...this.customers];
  }

  async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const newCustomer: Customer = {
      id: Math.max(...this.customers.map(c => c.id), 0) + 1,
      ...customerData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.customers.push(newCustomer);
  await this.saveCustomersToDiskSafe();
  return newCustomer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | null> {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    this.customers[index] = {
      ...this.customers[index],
      ...customerData,
      updatedAt: new Date().toISOString()
    };
  await this.saveCustomersToDiskSafe();
  return this.customers[index];
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return false;
    
  this.customers.splice(index, 1);
  await this.saveCustomersToDiskSafe();
  return true;
  }

  // Ventas
  async getSales(): Promise<Sale[]> {
    return [...this.sales];
  }

  async getSalesByRange(startDate: string, endDate: string): Promise<Sale[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.sales.filter(s => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    });
  }

  async createSale(saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<Sale> {
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
      throw new Error('INVALID_ITEM');
    }

    const round2 = (value: number) => Math.round(value * 100) / 100;
    const nowIso = new Date().toISOString();
    const createdAt = saleData.createdAt || nowIso;

    const productsClone = this.products.map((p) => ({ ...p }));
    let tempItemSeq = this.saleItemSequence;
    let tempMovementSeq = this.inventoryMovementSequence;
    const sanitizedItems: Sale['items'] = [];
    const movementDrafts: InventoryMovement[] = [];

    for (const rawItem of saleData.items) {
      const quantity = Math.max(0, Math.floor(Number(rawItem?.quantity ?? 0)));
      const unitPrice = round2(Number(rawItem?.unitPrice ?? 0));
      if (!quantity || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        const err = new Error('INVALID_ITEM');
        (err as any).details = rawItem;
        throw err;
      }

      let productId: number | undefined = undefined;
      if (typeof rawItem?.productId === 'number' && rawItem.productId > 0) {
        productId = rawItem.productId;
      }

      const snapshotProduct = productId ? productsClone.find((p) => p.id === productId) : undefined;
      if (productId && !snapshotProduct) {
        const err = new Error('INVALID_ITEM');
        (err as any).details = rawItem;
        throw err;
      }

      let categoryName = (typeof rawItem?.categoryName === 'string' && rawItem.categoryName.trim())
        ? rawItem.categoryName.trim()
        : (typeof rawItem?.categoryId === 'string' && rawItem.categoryId.trim())
          ? rawItem.categoryId.trim()
          : '';
      let categoryId = this.normalizeCategoryId(rawItem?.categoryId || categoryName);

      if (snapshotProduct) {
        if (!categoryName) categoryName = snapshotProduct.category || 'Sin categoría';
        if (!categoryId) categoryId = this.normalizeCategoryId(snapshotProduct.category);
      }

      if (!categoryId) {
        const err = new Error('INVALID_ITEM');
        (err as any).details = rawItem;
        throw err;
      }
      if (!categoryName) categoryName = categoryId;

      if (snapshotProduct) {
        if ((snapshotProduct.stock ?? 0) < quantity) {
          const err = new Error('INSUFFICIENT_STOCK');
          (err as any).code = 'INSUFFICIENT_STOCK';
          (err as any).categoryName = categoryName;
          throw err;
        }
        snapshotProduct.stock = Math.max(0, (snapshotProduct.stock ?? 0) - quantity);
        snapshotProduct.updatedAt = nowIso;
        movementDrafts.push({
          id: 0,
          saleId: 0,
          productId: snapshotProduct.id,
          categoryId,
          categoryName,
          quantity,
          type: 'salida',
          createdAt: nowIso,
          notes: typeof saleData.notes === 'string' ? saleData.notes : undefined,
        });
      } else {
        const candidates = productsClone.filter((p) => this.normalizeCategoryId(p.category) === categoryId);
        const totalStock = candidates.reduce((sum, p) => sum + Math.max(0, p.stock ?? 0), 0);
        if (totalStock < quantity) {
          const err = new Error('INSUFFICIENT_STOCK');
          (err as any).code = 'INSUFFICIENT_STOCK';
          (err as any).categoryName = categoryName;
          throw err;
        }
        let remaining = quantity;
        const sorted = [...candidates].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
        for (const candidate of sorted) {
          if (remaining <= 0) break;
          const available = Math.max(0, candidate.stock ?? 0);
          if (!available) continue;
          const take = Math.min(available, remaining);
          candidate.stock = available - take;
          candidate.updatedAt = nowIso;
          remaining -= take;
          movementDrafts.push({
            id: 0,
            saleId: 0,
            productId: candidate.id,
            categoryId,
            categoryName,
            quantity: take,
            type: 'salida',
            createdAt: nowIso,
            notes: typeof saleData.notes === 'string' ? saleData.notes : undefined,
          });
        }
      }

      const subtotal = round2(unitPrice * quantity);
      const notes = typeof rawItem?.notes === 'string' && rawItem.notes.trim() ? rawItem.notes.trim() : undefined;
      const type = rawItem?.type === 'manual' ? 'manual' : 'product';

      sanitizedItems.push({
        id: ++tempItemSeq,
        saleId: 0,
        productId,
        categoryId,
        categoryName,
        quantity,
        unitPrice,
        subtotal,
        notes,
        type,
      });
    }

    const subtotalValue = round2(sanitizedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0));
    let discountValue = round2(Number(saleData.discount ?? 0));
    if (!Number.isFinite(discountValue) || discountValue < 0) discountValue = 0;
    if (discountValue > subtotalValue) discountValue = subtotalValue;
    let taxValue = round2(Number(saleData.tax ?? 0));
    if (!Number.isFinite(taxValue) || taxValue < 0) taxValue = 0;
    const totalValue = round2(subtotalValue - discountValue + taxValue);

    const paymentMethod: Sale['paymentMethod'] =
      saleData.paymentMethod === 'Tarjeta' || saleData.paymentMethod === 'Transferencia'
        ? saleData.paymentMethod
        : 'Efectivo';

    const newSaleId = Math.max(0, ...this.sales.map((s) => s.id)) + 1;
    const itemsWithSaleId = sanitizedItems.map((item) => ({ ...item, saleId: newSaleId }));

    let movementSeq = tempMovementSeq;
    const movements = movementDrafts
      .filter((mov) => mov.quantity > 0)
      .map((mov) => ({ ...mov, id: ++movementSeq, saleId: newSaleId, createdAt: mov.createdAt || nowIso }));

    const notes = typeof saleData.notes === 'string' && saleData.notes.trim() ? saleData.notes.trim() : undefined;
    const appliedLevel =
      saleData.appliedDiscountLevel && ['Bronze', 'Silver', 'Gold', 'Platinum'].includes(saleData.appliedDiscountLevel)
        ? saleData.appliedDiscountLevel
        : undefined;
    const appliedPercent = typeof saleData.appliedDiscountPercent === 'number'
      ? Number(saleData.appliedDiscountPercent)
      : undefined;

    const newSale: Sale = {
      id: newSaleId,
      customerId: typeof saleData.customerId === 'number' ? saleData.customerId : undefined,
      subtotal: subtotalValue,
      discount: discountValue,
      tax: taxValue,
      total: totalValue,
      paymentMethod,
      status: 'Completada',
      createdAt,
      updatedAt: nowIso,
      items: itemsWithSaleId,
      appliedDiscountLevel: appliedLevel,
      appliedDiscountPercent: appliedPercent,
      notes,
      inventoryMovements: movements,
    };

    this.products = productsClone;
    this.sales.push(newSale);
    this.saleItemSequence = tempItemSeq;
    this.inventoryMovementSequence = movementSeq;

    await Promise.all([
      this.saveSalesToDiskSafe(),
      this.saveProductsToDiskSafe()
    ]);
    return newSale;
  }

  async updateSale(id: number, saleData: Partial<Sale>): Promise<Sale | null> {
    const index = this.sales.findIndex(s => s.id === id);
    if (index === -1) return null;

    // Nota: Para simplicidad no recalculamos stock si cambian los items.
    // La edición típica desde Configuración será de status/pago/totales.
    const prev = this.sales[index];
    this.sales[index] = {
      ...prev,
      ...saleData,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    } as Sale;
    await this.saveSalesToDiskSafe();
    return this.sales[index];
  }

  private restoreStockFromSale(sale: Sale) {
    const nowIso = new Date().toISOString();
    let restored = false;

    if (Array.isArray(sale?.inventoryMovements)) {
      for (const mov of sale.inventoryMovements) {
        if (!mov || mov.type !== 'salida') continue;
        const qty = Math.max(0, Number(mov.quantity ?? 0));
        if (!qty) continue;
        if (typeof mov.productId === 'number') {
          const product = this.products.find((p) => p.id === mov.productId);
          if (product) {
            product.stock += qty;
            product.updatedAt = nowIso;
            restored = true;
          }
        }
      }
    }

    if (restored) return;

    for (const item of sale.items || []) {
      const qty = Math.max(0, Number(item.quantity ?? 0));
      if (!qty) continue;
      if (item.productId) {
        const product = this.products.find((p) => p.id === item.productId);
        if (product) {
          product.stock += qty;
          product.updatedAt = nowIso;
          restored = true;
        }
      } else if (item.categoryId || item.categoryName) {
        const categoryId = this.normalizeCategoryId(item.categoryId || item.categoryName || '');
        if (!categoryId) continue;
        const candidate = this.products.find((p) => this.normalizeCategoryId(p.category) === categoryId);
        if (candidate) {
          candidate.stock += qty;
          candidate.updatedAt = nowIso;
          restored = true;
        }
      }
    }
  }

  async deleteSale(id: number): Promise<boolean> {
    const index = this.sales.findIndex(s => s.id === id);
    if (index === -1) return false;
    const sale = this.sales[index];
    try { this.restoreStockFromSale(sale); } catch {}
    this.sales.splice(index, 1);
    await Promise.all([
      this.saveSalesToDiskSafe(),
      this.saveProductsToDiskSafe()
    ]);
    return true;
  }

  async clearSales(): Promise<boolean> {
    try {
      for (const sale of this.sales) {
        this.restoreStockFromSale(sale);
      }
    } catch {}
    this.sales = [];
    await Promise.all([
      this.saveSalesToDiskSafe(),
      this.saveProductsToDiskSafe()
    ]);
    return true;
  }

  async deleteAllSales(): Promise<boolean> {
    try {
      for (const sale of this.sales) {
        this.restoreStockFromSale(sale);
      }
    } catch {}
    this.sales = [];
    await Promise.all([this.saveSalesToDiskSafe(), this.saveProductsToDiskSafe()]);
    return true;
  }

  async deleteAllCustomers(): Promise<boolean> {
    this.customers = [];
    await this.saveCustomersToDiskSafe();
    return true;
  }

  // Sesiones de caja
  async getCashSessions(): Promise<CashSession[]> {
    return [...this.cashSessions];
  }

  async createCashSession(sessionData: Omit<CashSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<CashSession> {
    const newSession: CashSession = {
      id: Math.max(...this.cashSessions.map(s => s.id), 0) + 1,
      ...sessionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.cashSessions.push(newSession);
  await this.saveCashSessionsToDiskSafe();
  return newSession;
  }

  async updateCashSession(id: number, sessionData: Partial<CashSession>): Promise<CashSession | null> {
    const index = this.cashSessions.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    this.cashSessions[index] = {
      ...this.cashSessions[index],
      ...sessionData,
      updatedAt: new Date().toISOString()
    };
  await this.saveCashSessionsToDiskSafe();
  return this.cashSessions[index];
  }

  async deleteCashSession(id: number): Promise<boolean> {
    const index = this.cashSessions.findIndex(s => s.id === id);
    if (index === -1) return false;
  this.cashSessions.splice(index, 1);
  await this.saveCashSessionsToDiskSafe();
  return true;
  }

  // Configuración
  async getSettings(): Promise<Setting[]> {
    return [...this.settings];
  }

  async updateSetting(key: string, value: string): Promise<Setting | null> {
    const index = this.settings.findIndex(s => s.key === key);
    const now = new Date().toISOString();
    if (index === -1) {
      const newSetting: Setting = {
        id: Math.max(...this.settings.map(s => s.id), 0) + 1,
        key,
        value,
        description: '',
        createdAt: now,
        updatedAt: now
      };
      this.settings.push(newSetting);
      await this.saveSettingsToDiskSafe();
      return newSetting;
    }
    this.settings[index] = { ...this.settings[index], value, updatedAt: now };
    await this.saveSettingsToDiskSafe();
    return this.settings[index];
  }

  // Inicialización
  async initialize(): Promise<void> {
    try {
      const userData = app.getPath('userData');
      this.settingsFilePath = path.join(userData, 'settings.json');
      this.productsFilePath = path.join(userData, 'products.json');
      this.customersFilePath = path.join(userData, 'customers.json');
      this.salesFilePath = path.join(userData, 'sales.json');
      this.cashSessionsFilePath = path.join(userData, 'cash_sessions.json');
      await this.loadSettingsFromDiskSafe();
      await Promise.all([
        this.loadProductsFromDiskSafe(),
        this.loadCustomersFromDiskSafe(),
        this.loadSalesFromDiskSafe(),
        this.loadCashSessionsFromDiskSafe()
      ]);
    } catch (e) {
      console.warn('⚠️ Could not prepare settings persistence:', e);
    }
    console.log('🚀 Database service initialized (no seed data)');
    console.log(`📦 ${this.products.length} products`);
    console.log(`👥 ${this.customers.length} customers`);
    console.log(`💰 ${this.sales.length} sales`);
    console.log(`⚙️ ${this.settings.length} settings`);
  }

  private async loadSettingsFromDiskSafe() {
    if (!this.settingsFilePath) return;
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const raw = await fs.promises.readFile(this.settingsFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          // Validate minimal shape
          this.settings = arr
            .filter(s => s && typeof s.key === 'string')
            .map((s, idx) => ({
              id: typeof s.id === 'number' ? s.id : idx + 1,
              key: s.key,
              value: String(s.value ?? ''),
              description: typeof s.description === 'string' ? s.description : '',
              createdAt: s.createdAt || new Date().toISOString(),
              updatedAt: s.updatedAt || new Date().toISOString()
            }));
        }
      } else {
        // Seed file with defaults
        await this.saveSettingsToDiskSafe();
      }
    } catch (e) {
      console.warn('⚠️ Failed to load settings from disk, using defaults:', e);
    }
  }

  private async saveSettingsToDiskSafe() {
    if (!this.settingsFilePath) return;
    try {
      const dir = path.dirname(this.settingsFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.settingsFilePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save settings to disk:', e);
    }
  }

  // ===== Persistence helpers for entities =====
  private async loadProductsFromDiskSafe() {
    if (!this.productsFilePath) return;
    try {
      if (fs.existsSync(this.productsFilePath)) {
        const raw = await fs.promises.readFile(this.productsFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.categoryDisplayById = new Map<string, string>();
          this.products = arr
            .filter(p => p && typeof p.name === 'string')
            .map((p, idx) => {
              const { id, name } = this.ensureCategoryCatalogEntry(p.category ?? p.categoryId ?? '');
              return {
                id: typeof p.id === 'number' ? p.id : idx + 1,
                sku: this.cleanSku(p.sku),
                name: this.cleanName(p.name),
                price: Number(p.price ?? 0),
                stock: this.cleanStock(p.stock),
                categoryId: id || undefined,
                category: name,
                description: this.cleanDescription(p.description),
                createdAt: p.createdAt || new Date().toISOString(),
                updatedAt: p.updatedAt || new Date().toISOString()
              } as Product;
            });
          this.rebuildCategoryCatalog();
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load products from disk:', e);
    }
  }

  private async saveProductsToDiskSafe() {
    if (!this.productsFilePath) return;
    try {
      const dir = path.dirname(this.productsFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.productsFilePath, JSON.stringify(this.products, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save products to disk:', e);
    }
  }

  private async loadCustomersFromDiskSafe() {
    if (!this.customersFilePath) return;
    try {
      if (fs.existsSync(this.customersFilePath)) {
        const raw = await fs.promises.readFile(this.customersFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.customers = arr
            .filter(c => c && typeof c.name === 'string')
            .map((c, idx) => ({
              id: typeof c.id === 'number' ? c.id : idx + 1,
              name: String(c.name ?? ''),
              email: typeof c.email === 'string' ? c.email : undefined,
              phone: typeof c.phone === 'string' ? c.phone : undefined,
              alternatePhone: typeof c.alternatePhone === 'string' ? c.alternatePhone : undefined,
              address: typeof c.address === 'string' ? c.address : undefined,
              discountLevel: (c.discountLevel === 'Silver' || c.discountLevel === 'Gold' || c.discountLevel === 'Platinum') ? c.discountLevel : 'Bronze',
              birthDate: typeof c.birthDate === 'string' ? c.birthDate : undefined,
              gender: typeof c.gender === 'string' ? c.gender : undefined,
              occupation: typeof c.occupation === 'string' ? c.occupation : undefined,
              customerType: c.customerType,
              referredBy: typeof c.referredBy === 'string' ? c.referredBy : undefined,
              preferredContact: c.preferredContact,
              preferredCategories: Array.isArray(c.preferredCategories) ? c.preferredCategories : undefined,
              budgetRange: typeof c.budgetRange === 'string' ? c.budgetRange : undefined,
              specialOccasions: Array.isArray(c.specialOccasions) ? c.specialOccasions : undefined,
              notes: typeof c.notes === 'string' ? c.notes : undefined,
              tags: Array.isArray(c.tags) ? c.tags : undefined,
              isActive: typeof c.isActive === 'boolean' ? c.isActive : undefined,
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString()
            }));
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load customers from disk:', e);
    }
  }

  private async saveCustomersToDiskSafe() {
    if (!this.customersFilePath) return;
    try {
      const dir = path.dirname(this.customersFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.customersFilePath, JSON.stringify(this.customers, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save customers to disk:', e);
    }
  }

  private async loadSalesFromDiskSafe() {
    if (!this.salesFilePath) return;
    try {
      if (fs.existsSync(this.salesFilePath)) {
        const raw = await fs.promises.readFile(this.salesFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          let maxItemId = this.saleItemSequence;
          let maxMovementId = this.inventoryMovementSequence;
          this.sales = arr
            .filter(s => s && Array.isArray(s.items))
            .map((s, idx) => {
              const saleId = typeof s.id === 'number' ? s.id : idx + 1;
              const items = Array.isArray(s.items)
                ? s.items.map((it: any, i: number) => {
                    const itemId = typeof it?.id === 'number' ? it.id : i + 1;
                    if (itemId > maxItemId) maxItemId = itemId;
                    const productId = typeof it?.productId === 'number' && it.productId > 0 ? it.productId : undefined;
                    const quantity = Math.max(0, Math.floor(Number(it?.quantity ?? 0)));
                    const unitPrice = Number(it?.unitPrice ?? 0);
                    const subtotal = Number(it?.subtotal ?? quantity * unitPrice);
                    const categoryId = typeof it?.categoryId === 'string' && it.categoryId.trim()
                      ? this.normalizeCategoryId(it.categoryId)
                      : undefined;
                    const categoryName = typeof it?.categoryName === 'string' && it.categoryName.trim()
                      ? it.categoryName.trim()
                      : undefined;
                    const notes = typeof it?.notes === 'string' && it.notes.trim() ? it.notes.trim() : undefined;
                    const type = it?.type === 'manual' ? 'manual' : 'product';
                    return {
                      id: itemId,
                      saleId,
                      productId,
                      categoryId,
                      categoryName,
                      quantity,
                      unitPrice,
                      subtotal,
                      notes,
                      type,
                    };
                  })
                : [];

              const movements = Array.isArray(s.inventoryMovements)
                ? s.inventoryMovements
                    .filter((mov: any) => mov && typeof mov.quantity !== 'undefined')
                    .map((mov: any, j: number) => {
                      const movementId = typeof mov?.id === 'number' ? mov.id : j + 1;
                      if (movementId > maxMovementId) maxMovementId = movementId;
                      const productId = typeof mov?.productId === 'number' ? mov.productId : undefined;
                      const categoryId = typeof mov?.categoryId === 'string' && mov.categoryId.trim()
                        ? this.normalizeCategoryId(mov.categoryId)
                        : undefined;
                      const categoryName = typeof mov?.categoryName === 'string' && mov.categoryName.trim()
                        ? mov.categoryName.trim()
                        : undefined;
                      const notes = typeof mov?.notes === 'string' && mov.notes.trim() ? mov.notes.trim() : undefined;
                      const type = mov?.type === 'entrada' || mov?.type === 'ajuste' ? mov.type : 'salida';
                      const quantity = Math.max(0, Number(mov?.quantity ?? 0));
                      return {
                        id: movementId,
                        saleId,
                        productId,
                        categoryId,
                        categoryName,
                        quantity,
                        type,
                        createdAt: mov?.createdAt || new Date().toISOString(),
                        notes,
                      } as InventoryMovement;
                    })
                : [];

              return {
                id: saleId,
                customerId: typeof s.customerId === 'number' ? s.customerId : undefined,
                subtotal: Number(s.subtotal ?? 0),
                discount: Number(s.discount ?? 0),
                tax: Number(s.tax ?? 0),
                total: Number(s.total ?? 0),
                paymentMethod: (s.paymentMethod === 'Tarjeta' || s.paymentMethod === 'Transferencia') ? s.paymentMethod : 'Efectivo',
                status: (s.status === 'Cancelada' || s.status === 'Pendiente') ? s.status : 'Completada',
                createdAt: s.createdAt || new Date().toISOString(),
                updatedAt: s.updatedAt || new Date().toISOString(),
                items,
                appliedDiscountLevel: ['Bronze','Silver','Gold','Platinum'].includes(s.appliedDiscountLevel) ? s.appliedDiscountLevel : undefined,
                appliedDiscountPercent: typeof s.appliedDiscountPercent === 'number' ? Number(s.appliedDiscountPercent) : undefined,
                notes: typeof s.notes === 'string' && s.notes.trim() ? s.notes.trim() : undefined,
                inventoryMovements: movements,
              } as Sale;
            });
          this.saleItemSequence = maxItemId;
          this.inventoryMovementSequence = maxMovementId;
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load sales from disk:', e);
    }
  }

  private async saveSalesToDiskSafe() {
    if (!this.salesFilePath) return;
    try {
      const dir = path.dirname(this.salesFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.salesFilePath, JSON.stringify(this.sales, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save sales to disk:', e);
    }
  }

  private async loadCashSessionsFromDiskSafe() {
    if (!this.cashSessionsFilePath) return;
    try {
      if (fs.existsSync(this.cashSessionsFilePath)) {
        const raw = await fs.promises.readFile(this.cashSessionsFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.cashSessions = arr
            .filter(s => s && typeof s.status === 'string')
            .map((s, idx) => ({
              id: typeof s.id === 'number' ? s.id : idx + 1,
              startTime: s.startTime || new Date().toISOString(),
              endTime: typeof s.endTime === 'string' ? s.endTime : undefined,
              initialAmount: Number(s.initialAmount ?? 0),
              finalAmount: typeof s.finalAmount !== 'undefined' ? Number(s.finalAmount) : undefined,
              expectedAmount: typeof s.expectedAmount !== 'undefined' ? Number(s.expectedAmount) : undefined,
              difference: typeof s.difference !== 'undefined' ? Number(s.difference) : undefined,
              status: s.status === 'Cerrada' ? 'Cerrada' : 'Abierta',
              notes: typeof s.notes === 'string' ? s.notes : undefined,
              createdAt: s.createdAt || new Date().toISOString(),
              updatedAt: s.updatedAt || new Date().toISOString()
            }));
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load cash sessions from disk:', e);
    }
  }

  private async saveCashSessionsToDiskSafe() {
    if (!this.cashSessionsFilePath) return;
    try {
      const dir = path.dirname(this.cashSessionsFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.cashSessionsFilePath, JSON.stringify(this.cashSessions, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save cash sessions to disk:', e);
    }
  }
}

export const databaseService = new DatabaseService();
