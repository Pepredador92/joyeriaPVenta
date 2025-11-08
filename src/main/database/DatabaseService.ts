import { Product, Customer, Sale, CashSession, Setting, Category, InventoryMovement, CustomerLevel } from '../../shared/types';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

class DatabaseService {
  // Ahora arrancamos sin datos de ejemplo; los arreglos comienzan vacíos.
  private products: Product[] = [];
  private categories: Category[] = [];
  private categoryIndex = new Map<string, Category>();
  private customers: Customer[] = [];
  private customerLevels: CustomerLevel[] = [];
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
  private categoriesFilePath: string | null = null;
  private customersFilePath: string | null = null;
  private salesFilePath: string | null = null;
  private cashSessionsFilePath: string | null = null;
  private customerLevelsFilePath: string | null = null;

  private normalizeSku(value: string | undefined | null): string {
    return (value || '')
      .toString()
      .trim()
      .toUpperCase();
  }

  private normalizeCategoryId(name: string | undefined | null): string {
    return (name || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private formatCategoryName(name: string): string {
    const clean = (name || '')
      .toString()
      .trim()
      .replace(/\s+/g, ' ');
    if (!clean) return '';
    return clean
      .split(' ')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  private customerLevelIndex = new Map<number, CustomerLevel>();

  private syncCategoryIndex() {
    this.categoryIndex = new Map<string, Category>();
    for (const category of this.categories) {
      this.categoryIndex.set(category.id, { ...category });
    }
  }

  private syncCustomerLevelIndex() {
    this.customerLevelIndex = new Map<number, CustomerLevel>();
    for (const level of this.customerLevels) {
      this.customerLevelIndex.set(level.id, { ...level });
    }
  }

  private ensureCategory(raw: string | undefined | null): Category {
    const normalizedId = this.normalizeCategoryId(raw);
    const nowIso = new Date().toISOString();
    if (!normalizedId) {
      return {
        id: 'otros',
        name: 'Otros',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }
    const existing = this.categoryIndex.get(normalizedId);
    const displayName = this.formatCategoryName(raw || normalizedId) || 'Otros';
    if (existing) {
      if (displayName && existing.name !== displayName) {
        existing.name = displayName;
        existing.updatedAt = nowIso;
        const idx = this.categories.findIndex((cat) => cat.id === existing.id);
        if (idx >= 0) this.categories[idx] = { ...existing };
      }
      return existing;
    }
    const newCategory: Category = {
      id: normalizedId,
      name: displayName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.categories.push(newCategory);
    this.categoryIndex.set(normalizedId, newCategory);
    return newCategory;
  }

  private rebuildCategoriesFromProducts() {
    const map = new Map<string, Category>();
    for (const product of this.products) {
      const entry = this.ensureCategory(product.category || product.categoryId);
      product.categoryId = entry.id;
      product.category = entry.name;
      map.set(entry.id, { ...entry });
    }
    this.categories = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    this.syncCategoryIndex();
  }

  private normalizeLevelName(name: string | undefined | null): string {
    return (name || '').toString().trim();
  }

  private sanitizeLevelDraft(
    draft: Partial<CustomerLevel> & {
      name?: string;
      discountPercent?: number;
      logicOp?: string;
      minAmount?: number | null;
      minOrders?: number | null;
      withinDays?: number | null;
      priority?: number;
      active?: boolean;
    },
    fallbackName?: string
  ): Omit<CustomerLevel, 'id' | 'createdAt' | 'updatedAt'> {
    const nameSource = draft.name ?? fallbackName ?? '';
    const name = this.normalizeLevelName(nameSource);
    if (!name) {
      const err = new Error('LEVEL_NAME_REQUIRED');
      (err as any).code = 'LEVEL_NAME_REQUIRED';
      throw err;
    }
    const discount = Number(draft.discountPercent ?? draft.discount_percent ?? 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      const err = new Error('LEVEL_DISCOUNT_INVALID');
      (err as any).code = 'LEVEL_DISCOUNT_INVALID';
      throw err;
    }
    const logicOp: 'AND' | 'OR' = draft.logicOp === 'OR' ? 'OR' : 'AND';
    const minAmount = draft.minAmount === null || draft.minAmount === undefined
      ? null
      : Math.max(0, Number(draft.minAmount) || 0);
    const minOrders = draft.minOrders === null || draft.minOrders === undefined
      ? null
      : Math.max(0, Math.floor(Number(draft.minOrders) || 0));
    const withinDays = draft.withinDays === null || draft.withinDays === undefined
      ? null
      : Math.max(1, Math.floor(Number(draft.withinDays) || 0));
    if (minAmount === null && minOrders === null) {
      const err = new Error('LEVEL_CRITERIA_REQUIRED');
      (err as any).code = 'LEVEL_CRITERIA_REQUIRED';
      throw err;
    }
    return {
      name,
      discountPercent: Math.max(0, Math.min(100, discount)),
      logicOp,
      minAmount,
      minOrders,
      withinDays,
      priority: Math.floor(Number(draft.priority ?? 0) || 0),
      active: draft.active === false ? false : true,
    };
  }

  private ensureDefaultCustomerLevels() {
    if (this.customerLevels.length > 0) {
      this.syncCustomerLevelIndex();
      return;
    }
    const now = new Date().toISOString();
    const defaults: Array<Omit<CustomerLevel, 'id'>> = [
      {
        name: 'Bronze',
        discountPercent: 0,
        logicOp: 'OR',
        minAmount: 0,
        minOrders: 0,
        withinDays: null,
        priority: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Silver',
        discountPercent: 5,
        logicOp: 'OR',
        minAmount: 15000,
        minOrders: 3,
        withinDays: 365,
        priority: 10,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Gold',
        discountPercent: 10,
        logicOp: 'OR',
        minAmount: 50000,
        minOrders: 5,
        withinDays: 365,
        priority: 20,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Platinum',
        discountPercent: 15,
        logicOp: 'OR',
        minAmount: 100000,
        minOrders: 8,
        withinDays: 365,
        priority: 30,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    this.customerLevels = defaults.map((level, index) => ({ id: index + 1, ...level }));
    this.syncCustomerLevelIndex();
  }

  private findLevelByIdOrName(id?: number | null, name?: string | null): CustomerLevel | null {
    if (typeof id === 'number' && this.customerLevelIndex.has(id)) {
      return this.customerLevelIndex.get(id)!;
    }
    const normalized = this.normalizeLevelName(name);
    if (!normalized) return null;
    const lower = normalized.toLowerCase();
    const found = this.customerLevels.find((level) => level.name.toLowerCase() === lower);
    return found || null;
  }

  private summarizeCustomerPurchases(customerId: number, withinDays: number | null) {
    const now = Date.now();
    const threshold = withinDays && withinDays > 0 ? now - withinDays * 86400000 : null;
    let amount = 0;
    let orders = 0;
    for (const sale of this.sales) {
      if (!sale || sale.customerId !== customerId) continue;
      if (sale.status && sale.status !== 'Completada') continue;
      const created = new Date(sale.createdAt || sale.updatedAt || '').getTime();
      if (Number.isNaN(created)) continue;
      if (threshold !== null && created < threshold) continue;
      const total = Number(sale.total ?? 0);
      amount += Number.isFinite(total) ? Math.max(0, total) : 0;
      orders += 1;
    }
    return { amount, orders };
  }

  private determineCustomerLevel(customerId: number): CustomerLevel | null {
    if (!this.customerLevels.length) return null;
    const activeLevels = this.customerLevels.filter((level) => level && level.active !== false);
    if (!activeLevels.length) return null;
    const cache = new Map<number, { amount: number; orders: number }>();
    const getStats = (withinDays: number | null) => {
      const key = withinDays === null ? -1 : withinDays;
      if (!cache.has(key)) {
        cache.set(key, this.summarizeCustomerPurchases(customerId, withinDays));
      }
      return cache.get(key)!;
    };
    const candidates: Array<{ level: CustomerLevel; priority: number; discount: number }> = [];
    for (const level of activeLevels) {
      const stats = getStats(level.withinDays ?? null);
      const meetsAmount = level.minAmount === null || stats.amount >= level.minAmount;
      const meetsOrders = level.minOrders === null || stats.orders >= level.minOrders;
      let qualifies: boolean;
      if (level.logicOp === 'OR') {
        const checks: boolean[] = [];
        if (level.minAmount !== null) checks.push(meetsAmount);
        if (level.minOrders !== null) checks.push(meetsOrders);
        qualifies = checks.length === 0 ? true : checks.some(Boolean);
      } else {
        qualifies = (level.minAmount === null || meetsAmount) && (level.minOrders === null || meetsOrders);
      }
      if (qualifies) {
        candidates.push({ level, priority: level.priority ?? 0, discount: level.discountPercent ?? 0 });
      }
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.discount !== a.discount) return b.discount - a.discount;
      return a.level.id - b.level.id;
    });
    return candidates[0].level;
  }

  private applyLevelToCustomer(customer: Customer, level: CustomerLevel | null, touchTimestamp = true): boolean {
    const nextId = level ? level.id : null;
    const nextName = level ? level.name : null;
    const nextPercent = level ? level.discountPercent : null;
    const prevId = customer.levelId ?? null;
    const prevName = customer.levelName ?? null;
    const prevPercent = customer.levelDiscountPercent ?? null;
    const prevLegacy = customer.discountLevel ?? null;
    const changed = prevId !== nextId || prevName !== nextName || prevPercent !== nextPercent || prevLegacy !== (nextName || null);
    customer.levelId = nextId;
    customer.levelName = nextName;
    customer.levelDiscountPercent = nextPercent;
    customer.discountLevel = nextName || undefined;
    if (changed && touchTimestamp) {
      customer.updatedAt = new Date().toISOString();
    }
    return changed;
  }

  private async persistCategories() {
    if (!this.categoriesFilePath) return;
    try {
      const dir = path.dirname(this.categoriesFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(
        this.categoriesFilePath,
        JSON.stringify(this.categories, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.warn('⚠️ Failed to save categories to disk:', e);
    }
  }

  private async loadCustomerLevelsFromDiskSafe() {
    if (!this.customerLevelsFilePath) return;
    try {
      if (fs.existsSync(this.customerLevelsFilePath)) {
        const raw = await fs.promises.readFile(this.customerLevelsFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.customerLevels = arr
            .filter((level) => level && (typeof level.name === 'string' || typeof level.id === 'number'))
            .map((level, index) => ({
              id: typeof level.id === 'number' ? level.id : index + 1,
              name: this.normalizeLevelName(level.name) || `Nivel ${index + 1}`,
              discountPercent: Number.isFinite(Number(level.discountPercent))
                ? Math.max(0, Math.min(100, Number(level.discountPercent)))
                : 0,
              logicOp: level.logicOp === 'OR' ? 'OR' : 'AND',
              minAmount: level.minAmount === null || level.minAmount === undefined
                ? null
                : Math.max(0, Number(level.minAmount) || 0),
              minOrders: level.minOrders === null || level.minOrders === undefined
                ? null
                : Math.max(0, Math.floor(Number(level.minOrders) || 0)),
              withinDays: level.withinDays === null || level.withinDays === undefined
                ? null
                : Math.max(1, Math.floor(Number(level.withinDays) || 0)),
              priority: Math.floor(Number(level.priority ?? 0) || 0),
              active: level.active === false ? false : true,
              createdAt: level.createdAt || new Date().toISOString(),
              updatedAt: level.updatedAt || new Date().toISOString(),
            }));
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load customer levels from disk:', e);
    } finally {
      this.ensureDefaultCustomerLevels();
    }
  }

  private async saveCustomerLevelsToDiskSafe() {
    if (!this.customerLevelsFilePath) return;
    try {
      const dir = path.dirname(this.customerLevelsFilePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.customerLevelsFilePath, JSON.stringify(this.customerLevels, null, 2), 'utf-8');
    } catch (e) {
      console.warn('⚠️ Failed to save customer levels to disk:', e);
    }
  }

  // Productos
  async getProducts(): Promise<Product[]> {
    if (!this.categories.length && this.products.length) {
      this.rebuildCategoriesFromProducts();
    }
    return [...this.products];
  }

  async getCategoryCatalog(term?: string): Promise<Category[]> {
    if (!this.categories.length && this.products.length) {
      this.rebuildCategoriesFromProducts();
    }
    if (!term) {
      return [...this.categories].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    const q = term.trim().toLowerCase();
    return this.categories
      .filter((cat) => cat.name.toLowerCase().includes(q) || cat.id.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const nowIso = new Date().toISOString();
    const cleanName = (productData.name || '').toString().trim();
    const cleanSku = this.normalizeSku(productData.sku);
    if (!cleanSku) {
      const err = new Error('INVALID_SKU');
      (err as any).code = 'INVALID_SKU';
      throw err;
    }
    const duplicate = this.products.some((p) => this.normalizeSku(p.sku) === cleanSku);
    if (duplicate) {
      const err = new Error('DUPLICATE_SKU');
      (err as any).code = 'DUPLICATE_SKU';
      throw err;
    }
    const cleanDescription = productData.description?.toString().trim() || undefined;
    const cleanStock = Math.max(0, Math.floor(Number(productData.stock || 0)));
    const cleanPrice = Number(productData.price ?? 0);
    const categoryEntry = this.ensureCategory(productData.category || productData.categoryId || 'Otros');
    const status = productData.status === 'Inactivo' ? 'Inactivo' : 'Activo';
    const newProduct: Product = {
      id: Math.max(...this.products.map(p => p.id), 0) + 1,
      sku: cleanSku,
      name: cleanName,
      price: Number.isFinite(cleanPrice) ? cleanPrice : 0,
      stock: cleanStock,
      category: categoryEntry.name,
      categoryId: categoryEntry.id,
      description: cleanDescription,
      status,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    this.products.push(newProduct);
    this.rebuildCategoriesFromProducts();
    await Promise.all([this.saveProductsToDiskSafe(), this.persistCategories()]);
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const nowIso = new Date().toISOString();
    const current = this.products[index];
    const nextSku =
      productData.sku !== undefined ? this.normalizeSku(productData.sku) : this.normalizeSku(current.sku);
    if (!nextSku) {
      const err = new Error('INVALID_SKU');
      (err as any).code = 'INVALID_SKU';
      throw err;
    }
    const duplicate = this.products.some(
      (p, idx) => idx !== index && this.normalizeSku(p.sku) === nextSku
    );
    if (duplicate) {
      const err = new Error('DUPLICATE_SKU');
      (err as any).code = 'DUPLICATE_SKU';
      throw err;
    }
    const nextStatus =
      productData.status !== undefined
        ? productData.status === 'Inactivo'
          ? 'Inactivo'
          : 'Activo'
        : current.status === 'Inactivo'
        ? 'Inactivo'
        : 'Activo';
    const next: Product = {
      ...current,
      ...productData,
      sku: nextSku,
      name: productData.name !== undefined ? (productData.name || '').toString().trim() : current.name,
      price: productData.price !== undefined ? Number(productData.price) || 0 : current.price,
      stock:
        productData.stock !== undefined
          ? Math.max(0, Math.floor(Number(productData.stock)))
          : current.stock,
      description:
        productData.description !== undefined
          ? (productData.description || '').toString().trim() || undefined
          : current.description,
      status: nextStatus,
      updatedAt: nowIso,
    };
    if (productData.category !== undefined || productData.categoryId !== undefined) {
      const entry = this.ensureCategory(productData.category || productData.categoryId || current.category);
      next.category = entry.name;
      next.categoryId = entry.id;
    } else if (!next.categoryId) {
      const entry = this.ensureCategory(next.category);
      next.category = entry.name;
      next.categoryId = entry.id;
    }
    this.products[index] = next;
    this.rebuildCategoriesFromProducts();
    await Promise.all([this.saveProductsToDiskSafe(), this.persistCategories()]);
    return this.products[index];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return false;

  this.products.splice(index, 1);
  this.rebuildCategoriesFromProducts();
  await Promise.all([this.saveProductsToDiskSafe(), this.persistCategories()]);
  return true;
  }

  // Clientes
  async getCustomers(): Promise<Customer[]> {
    return [...this.customers];
  }

  async createCustomer(customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: Math.max(...this.customers.map(c => c.id), 0) + 1,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone,
      alternatePhone: customerData.alternatePhone,
      address: customerData.address,
      birthDate: customerData.birthDate,
      gender: customerData.gender,
      occupation: customerData.occupation,
      customerType: customerData.customerType,
      referredBy: customerData.referredBy,
      preferredContact: customerData.preferredContact,
      preferredCategories: customerData.preferredCategories,
      budgetRange: customerData.budgetRange,
      specialOccasions: customerData.specialOccasions,
      notes: customerData.notes,
      tags: customerData.tags,
      isActive: customerData.isActive,
      levelId: customerData.levelId ?? null,
      levelName: customerData.levelName ?? undefined,
      levelDiscountPercent: customerData.levelDiscountPercent ?? undefined,
      discountLevel: customerData.discountLevel,
      createdAt: now,
      updatedAt: now,
    } as Customer;
    const initialLevel = this.findLevelByIdOrName(newCustomer.levelId, newCustomer.levelName || newCustomer.discountLevel || null);
    this.applyLevelToCustomer(newCustomer, initialLevel, false);
    this.customers.push(newCustomer);
    await this.saveCustomersToDiskSafe();
    return newCustomer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | null> {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return null;
    const current = this.customers[index];
    const merged: Customer = {
      ...current,
      ...customerData,
    };
    const targetLevel = this.findLevelByIdOrName(
      customerData.levelId !== undefined ? customerData.levelId : merged.levelId,
      customerData.levelName ?? customerData.discountLevel ?? merged.levelName ?? merged.discountLevel ?? null
    );
    this.applyLevelToCustomer(merged, targetLevel);
    merged.updatedAt = new Date().toISOString();
    this.customers[index] = merged;
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

  async getCustomerLevels(): Promise<CustomerLevel[]> {
    return this.customerLevels.map((level) => ({ ...level }));
  }

  async createCustomerLevel(levelData: Partial<CustomerLevel> & { name?: string }): Promise<CustomerLevel> {
    const payload = this.sanitizeLevelDraft(levelData);
    const normalizedName = payload.name.toLowerCase();
    if (this.customerLevels.some((level) => level.name.toLowerCase() === normalizedName)) {
      const err = new Error('LEVEL_DUPLICATE');
      (err as any).code = 'LEVEL_DUPLICATE';
      throw err;
    }
    const now = new Date().toISOString();
    const newLevel: CustomerLevel = {
      id: Math.max(0, ...this.customerLevels.map((level) => level.id)) + 1,
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    this.customerLevels.push(newLevel);
    this.syncCustomerLevelIndex();
    await this.saveCustomerLevelsToDiskSafe();
    return { ...newLevel };
  }

  async updateCustomerLevel(id: number, levelData: Partial<CustomerLevel> & { name?: string }): Promise<CustomerLevel | null> {
    const index = this.customerLevels.findIndex((level) => level.id === id);
    if (index === -1) return null;
    const existing = this.customerLevels[index];
    const payload = this.sanitizeLevelDraft(levelData, existing.name);
    const normalizedName = payload.name.toLowerCase();
    if (
      this.customerLevels.some(
        (level, idx) => idx !== index && level.name.toLowerCase() === normalizedName
      )
    ) {
      const err = new Error('LEVEL_DUPLICATE');
      (err as any).code = 'LEVEL_DUPLICATE';
      throw err;
    }
    const now = new Date().toISOString();
    this.customerLevels[index] = {
      ...existing,
      ...payload,
      updatedAt: now,
    };
    this.syncCustomerLevelIndex();
    await this.saveCustomerLevelsToDiskSafe();
    // Si el nombre cambió, sincronizar clientes
    if (existing.name !== payload.name) {
      let touched = false;
      for (const customer of this.customers) {
        if (customer.levelId === id) {
          this.applyLevelToCustomer(customer, this.customerLevels[index], false);
          touched = true;
        }
      }
      if (touched) {
        await this.saveCustomersToDiskSafe();
      }
    }
    return { ...this.customerLevels[index] };
  }

  async deleteCustomerLevel(id: number): Promise<boolean> {
    const index = this.customerLevels.findIndex((level) => level.id === id);
    if (index === -1) return false;
    this.customerLevels.splice(index, 1);
    this.syncCustomerLevelIndex();
    let touched = false;
    for (const customer of this.customers) {
      if (customer.levelId === id) {
        this.applyLevelToCustomer(customer, null, false);
        touched = true;
      }
    }
    await Promise.all([
      this.saveCustomerLevelsToDiskSafe(),
      touched ? this.saveCustomersToDiskSafe() : Promise.resolve(),
    ]);
    return true;
  }

  async computeCustomerLevel(customerId: number): Promise<Customer | null> {
    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer) return null;
    const level = this.determineCustomerLevel(customerId);
    const changed = this.applyLevelToCustomer(customer, level);
    if (changed) {
      await this.saveCustomersToDiskSafe();
    }
    return { ...customer };
  }

  async recomputeCustomerLevels(): Promise<{ updated: number; examined: number }> {
    let updated = 0;
    let examined = 0;
    for (const customer of this.customers) {
      examined += 1;
      const level = this.determineCustomerLevel(customer.id);
      if (this.applyLevelToCustomer(customer, level)) {
        updated += 1;
      }
    }
    if (updated > 0) {
      await this.saveCustomersToDiskSafe();
    }
    return { updated, examined };
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

  async getSalesByCustomer(customerId: number): Promise<Sale[]> {
    const id = Number(customerId);
    if (!Number.isInteger(id) || id <= 0) return [];
    return this.sales
      .filter((sale) => sale.customerId === id)
      .map((sale) => ({
        ...sale,
        items: sale.items.map((item) => ({ ...item })),
        inventoryMovements: (sale.inventoryMovements || []).map((mov) => ({ ...mov })),
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createSale(
    saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'inventoryMovements'> & {
      createdAt?: string;
      items: Array<Partial<Sale['items'][number]>>;
    }
  ): Promise<Sale> {
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
      const err = new Error('INVALID_ITEM');
      (err as any).code = 'INVALID_ITEM';
      throw err;
    }

    const nowIso = new Date().toISOString();
    const createdAt = saleData.createdAt || nowIso;

    const productsClone = this.products.map((p) => ({ ...p }));
    const findProductClone = (id?: number) =>
      typeof id === 'number' && id > 0 ? productsClone.find((p) => p.id === id) : undefined;

    const currentMaxSaleId = Math.max(0, ...this.sales.map((s) => s.id));
    const currentMaxItemId = this.sales.reduce((max, sale) => {
      const localMax = Math.max(0, ...sale.items.map((item) => item.id || 0));
      return Math.max(max, localMax);
    }, 0);
    const currentMaxMovementId = this.sales.reduce((max, sale) => {
      const localMax = Math.max(0, ...(sale.inventoryMovements || []).map((mov) => mov.id || 0));
      return Math.max(max, localMax);
    }, 0);

    let nextItemId = currentMaxItemId;
    let nextMovementId = currentMaxMovementId;

    let customerId: number | undefined;
    if (saleData.customerId !== undefined && saleData.customerId !== null) {
      const candidate = Number(saleData.customerId);
      if (!Number.isInteger(candidate) || candidate <= 0 || !this.customers.some((c) => c.id === candidate)) {
        const err = new Error('CUSTOMER_NOT_FOUND');
        (err as any).code = 'CUSTOMER_NOT_FOUND';
        throw err;
      }
      customerId = candidate;
    }

    type ItemMeta = {
      rawIndex: number;
      product?: Product;
      categoryId: string;
      categoryName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      notes?: string;
      type: 'product' | 'manual';
    };

    const metas: ItemMeta[] = saleData.items.map((item, index) => {
      const quantity = Math.floor(Number(item.quantity ?? 0));
      const unitPrice = Number(item.unitPrice ?? 0);
      if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        const err = new Error('INVALID_ITEM');
        (err as any).code = 'INVALID_ITEM';
        (err as any).details = item;
        throw err;
      }
      const product = findProductClone(item.productId as number);
      const categorySource =
        item.categoryName || item.categoryId || (product ? product.category || product.categoryId : 'Otros');
      const categoryEntry = this.ensureCategory(categorySource || 'Otros');
      const notes = typeof item.notes === 'string' ? item.notes.trim() || undefined : undefined;
      return {
        rawIndex: index,
        product,
        categoryId: categoryEntry.id,
        categoryName: categoryEntry.name,
        quantity,
        unitPrice,
        subtotal: +(unitPrice * quantity).toFixed(2),
        notes,
        type: product ? 'product' : 'manual',
      };
    });

    const movements: InventoryMovement[] = [];
    const resolvedItems: Sale['items'] = [];

    const pushMovement = (product: Product, meta: ItemMeta, quantity: number) => {
      if (quantity <= 0) return;
      movements.push({
        id: ++nextMovementId,
        saleId: 0,
        productId: product.id,
        categoryId: meta.categoryId,
        categoryName: meta.categoryName,
        quantity,
        type: 'salida',
        createdAt: nowIso,
        notes: saleData.notes?.toString().trim() || undefined,
      });
    };

    try {
      for (const meta of metas.filter((m) => m.product)) {
        const product = meta.product!;
        const available = Math.max(0, Number(product.stock ?? 0));
        if (available < meta.quantity) {
          const err = new Error('INSUFFICIENT_STOCK');
          (err as any).code = 'INSUFFICIENT_STOCK';
          (err as any).categoryName = meta.categoryName;
          throw err;
        }
        product.stock = available - meta.quantity;
        product.updatedAt = nowIso;
        pushMovement(product, meta, meta.quantity);
        resolvedItems.push({
          id: ++nextItemId,
          saleId: 0,
          productId: product.id,
          categoryId: meta.categoryId,
          categoryName: meta.categoryName,
          quantity: meta.quantity,
          unitPrice: meta.unitPrice,
          subtotal: meta.subtotal,
          notes: meta.notes,
          type: 'product',
        });
      }

      for (const meta of metas.filter((m) => !m.product)) {
        const candidates = productsClone
          .filter((p) => this.normalizeCategoryId(p.category || p.categoryId) === meta.categoryId)
          .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
        const totalAvailable = candidates.reduce((sum, product) => sum + Math.max(0, Number(product.stock ?? 0)), 0);
        if (totalAvailable < meta.quantity) {
          const err = new Error('INSUFFICIENT_STOCK');
          (err as any).code = 'INSUFFICIENT_STOCK';
          (err as any).categoryName = meta.categoryName;
          throw err;
        }
        let remaining = meta.quantity;
        for (const candidate of candidates) {
          if (remaining <= 0) break;
          const available = Math.max(0, Number(candidate.stock ?? 0));
          if (!available) continue;
          const take = Math.min(available, remaining);
          candidate.stock = available - take;
          candidate.updatedAt = nowIso;
          remaining -= take;
          pushMovement(candidate, meta, take);
        }
        resolvedItems.push({
          id: ++nextItemId,
          saleId: 0,
          productId: undefined,
          categoryId: meta.categoryId,
          categoryName: meta.categoryName,
          quantity: meta.quantity,
          unitPrice: meta.unitPrice,
          subtotal: meta.subtotal,
          notes: meta.notes,
          type: 'manual',
        });
      }

      const subtotal = resolvedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
      let discount = Number(saleData.discount ?? 0);
      if (!Number.isFinite(discount) || discount < 0) discount = 0;
      if (discount > subtotal) discount = subtotal;
      let tax = Number(saleData.tax ?? 0);
      if (!Number.isFinite(tax) || tax < 0) tax = 0;
      const total = +(subtotal - discount + tax);

      const paymentMethod: Sale['paymentMethod'] =
        saleData.paymentMethod === 'Tarjeta' || saleData.paymentMethod === 'Transferencia'
          ? saleData.paymentMethod
          : 'Efectivo';

      const saleId = currentMaxSaleId + 1;
      const itemsWithSaleId = resolvedItems.map((item) => ({ ...item, saleId }));
      const movementsWithSaleId = movements.map((movement) => ({ ...movement, saleId }));
      const notes = typeof saleData.notes === 'string' ? saleData.notes.trim() || undefined : undefined;
      const appliedLevel = saleData.appliedDiscountLevel;
      const appliedPercent = saleData.appliedDiscountPercent;

      const newSale: Sale = {
        id: saleId,
        customerId,
        subtotal,
        discount,
        tax,
        total,
        paymentMethod,
        status: 'Completada',
        createdAt,
        updatedAt: nowIso,
        items: itemsWithSaleId,
        appliedDiscountLevel: appliedLevel,
        appliedDiscountPercent: appliedPercent,
        notes,
        inventoryMovements: movementsWithSaleId,
      };

      this.products = productsClone;
      this.rebuildCategoriesFromProducts();
      this.sales.push(newSale);
      await Promise.all([
        this.saveSalesToDiskSafe(),
        this.saveProductsToDiskSafe(),
        this.persistCategories(),
      ]);
      if (customerId) {
        try {
          await this.computeCustomerLevel(customerId);
        } catch (e) {
          console.warn('⚠️ Failed to recompute customer level after sale:', e);
        }
      }
      return newSale;
    } catch (error: any) {
      if (error?.code === 'CUSTOMER_NOT_FOUND' || error?.code === 'INSUFFICIENT_STOCK' || error?.code === 'INVALID_ITEM') {
        throw error;
      }
      console.error('Failed to confirm sale', {
        message: error?.message || error,
        customerId: saleData?.customerId,
      });
      const fail = new Error('SALE_CONFIRMATION_FAILED');
      (fail as any).code = 'SALE_CONFIRMATION_FAILED';
      throw fail;
    }
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
    if (Array.isArray(sale.inventoryMovements) && sale.inventoryMovements.length > 0) {
      for (const movement of sale.inventoryMovements) {
        if (!movement || movement.type !== 'salida') continue;
        if (!movement.productId) continue;
        const product = this.products.find((p) => p.id === movement.productId);
        if (!product) continue;
        const qty = Math.max(0, Number(movement.quantity ?? 0));
        product.stock += qty;
        product.updatedAt = nowIso;
      }
      return;
    }
    for (const item of sale.items || []) {
      if (!item || !item.productId) continue;
      const product = this.products.find((p) => p.id === item.productId);
      if (!product) continue;
      const qty = Math.max(0, Number(item.quantity ?? 0));
      product.stock += qty;
      product.updatedAt = nowIso;
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
      this.categoriesFilePath = path.join(userData, 'categories.json');
      this.customersFilePath = path.join(userData, 'customers.json');
      this.salesFilePath = path.join(userData, 'sales.json');
      this.cashSessionsFilePath = path.join(userData, 'cash_sessions.json');
      this.customerLevelsFilePath = path.join(userData, 'customer_levels.json');
      await this.loadSettingsFromDiskSafe();
      await this.loadCustomerLevelsFromDiskSafe();
      await Promise.all([
        this.loadCategoriesFromDiskSafe(),
        this.loadProductsFromDiskSafe(),
        this.loadCustomersFromDiskSafe(),
        this.loadSalesFromDiskSafe(),
        this.loadCashSessionsFromDiskSafe()
      ]);
      if (!this.categories.length && this.products.length) {
        this.rebuildCategoriesFromProducts();
      }
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
  private async loadCategoriesFromDiskSafe() {
    if (!this.categoriesFilePath) return;
    try {
      if (fs.existsSync(this.categoriesFilePath)) {
        const raw = await fs.promises.readFile(this.categoriesFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.categories = arr
            .filter((c) => c && typeof c.id === 'string')
            .map((c) => ({
              id: this.normalizeCategoryId(c.id),
              name: this.formatCategoryName(c.name || c.id),
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString(),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
          this.syncCategoryIndex();
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load categories from disk:', e);
    }
  }

  private async loadProductsFromDiskSafe() {
    if (!this.productsFilePath) return;
    try {
      if (fs.existsSync(this.productsFilePath)) {
        const raw = await fs.promises.readFile(this.productsFilePath, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.products = arr
            .filter(p => p && typeof p.name === 'string')
            .map((p, idx) => ({
              id: typeof p.id === 'number' ? p.id : idx + 1,
              sku: String(p.sku ?? ''),
              name: String(p.name ?? ''),
              price: Number(p.price ?? 0),
              stock: Number(p.stock ?? 0),
              category: String(p.category ?? ''),
              categoryId: typeof p.categoryId === 'string' ? this.normalizeCategoryId(p.categoryId) : undefined,
              description: typeof p.description === 'string' ? p.description : undefined,
              status: p.status === 'Inactivo' ? 'Inactivo' : 'Activo',
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString()
            }));
          this.rebuildCategoriesFromProducts();
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
              levelId: typeof c.levelId === 'number' ? c.levelId : undefined,
              levelName: typeof c.levelName === 'string' ? this.normalizeLevelName(c.levelName) : undefined,
              levelDiscountPercent: Number.isFinite(Number(c.levelDiscountPercent)) ? Number(c.levelDiscountPercent) : undefined,
              discountLevel: typeof c.discountLevel === 'string' ? this.normalizeLevelName(c.discountLevel) : undefined,
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString()
            }))
            .map((customer) => {
              const level = this.findLevelByIdOrName(customer.levelId, customer.levelName || customer.discountLevel || null);
              this.applyLevelToCustomer(customer, level, false);
              return customer;
            });
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
          this.sales = arr
            .filter(s => s && Array.isArray(s.items))
            .map((s, idx) => ({
              id: typeof s.id === 'number' ? s.id : idx + 1,
              customerId: typeof s.customerId === 'number' ? s.customerId : undefined,
              subtotal: Number(s.subtotal ?? 0),
              discount: Number(s.discount ?? 0),
              tax: Number(s.tax ?? 0),
              total: Number(s.total ?? 0),
              paymentMethod: (s.paymentMethod === 'Tarjeta' || s.paymentMethod === 'Transferencia') ? s.paymentMethod : 'Efectivo',
              status: (s.status === 'Cancelada' || s.status === 'Pendiente') ? s.status : 'Completada',
              createdAt: s.createdAt || new Date().toISOString(),
              updatedAt: s.updatedAt || new Date().toISOString(),
              items: Array.isArray(s.items) ? s.items.map((it: any, i: number) => ({
                id: typeof it.id === 'number' ? it.id : i + 1,
                saleId: typeof it.saleId === 'number' ? it.saleId : (typeof s.id === 'number' ? s.id : idx + 1),
                productId: typeof it.productId === 'number' ? it.productId : undefined,
                categoryId: typeof it.categoryId === 'string' ? this.normalizeCategoryId(it.categoryId) : undefined,
                categoryName: typeof it.categoryName === 'string' ? this.formatCategoryName(it.categoryName) : undefined,
                quantity: Math.max(0, Number(it.quantity ?? 0)),
                unitPrice: Number(it.unitPrice ?? 0),
                subtotal: Number(it.subtotal ?? (Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0))),
                notes: typeof it.notes === 'string' ? it.notes : undefined,
                type: it.type === 'product' ? 'product' : it.type === 'manual' ? 'manual' : undefined,
              })) : [],
              appliedDiscountLevel: ['Bronze','Silver','Gold','Platinum'].includes(s.appliedDiscountLevel) ? s.appliedDiscountLevel : undefined,
              appliedDiscountPercent: typeof s.appliedDiscountPercent === 'number' ? Number(s.appliedDiscountPercent) : undefined,
              notes: typeof s.notes === 'string' ? s.notes : undefined,
              inventoryMovements: Array.isArray(s.inventoryMovements)
                ? s.inventoryMovements.map((mov: any, m: number) => ({
                    id: typeof mov.id === 'number' ? mov.id : m + 1,
                    saleId: typeof mov.saleId === 'number' ? mov.saleId : (typeof s.id === 'number' ? s.id : idx + 1),
                    productId: typeof mov.productId === 'number' ? mov.productId : undefined,
                    categoryId: typeof mov.categoryId === 'string' ? this.normalizeCategoryId(mov.categoryId) : undefined,
                    categoryName: typeof mov.categoryName === 'string' ? this.formatCategoryName(mov.categoryName) : undefined,
                    quantity: Math.max(0, Number(mov.quantity ?? 0)),
                    type: mov.type === 'entrada' || mov.type === 'ajuste' ? mov.type : 'salida',
                    createdAt: mov.createdAt || new Date().toISOString(),
                    notes: typeof mov.notes === 'string' ? mov.notes : undefined,
                  }))
                : [],
            }));
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
