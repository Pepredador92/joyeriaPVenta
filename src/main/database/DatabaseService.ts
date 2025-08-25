import { Product, Customer, Sale, CashSession, Setting } from '../../shared/types';
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

  // Productos
  async getProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const newProduct: Product = {
      id: Math.max(...this.products.map(p => p.id), 0) + 1,
      ...productData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.products.push(newProduct);
  await this.saveProductsToDiskSafe();
  return newProduct;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    this.products[index] = {
      ...this.products[index],
      ...productData,
      updatedAt: new Date().toISOString()
    };
  await this.saveProductsToDiskSafe();
  return this.products[index];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    
  this.products.splice(index, 1);
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

  async createSale(saleData: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string }): Promise<Sale> {
    const newSale: Sale = {
      id: Math.max(...this.sales.map(s => s.id), 0) + 1,
      ...saleData,
      status: 'Completada',
      createdAt: saleData.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Actualizar stock de productos
    for (const item of saleData.items) {
      const product = this.products.find(p => p.id === item.productId);
      if (product) {
        product.stock -= item.quantity;
        product.updatedAt = new Date().toISOString();
      }
    }
    
    this.sales.push(newSale);
    await Promise.all([
      this.saveSalesToDiskSafe(),
      this.saveProductsToDiskSafe()
    ]);
    return newSale;
  }

  async clearSales(): Promise<boolean> {
    this.sales = [];
    await this.saveSalesToDiskSafe();
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
          this.products = arr
            .filter(p => p && typeof p.name === 'string')
            .map((p, idx) => ({
              id: typeof p.id === 'number' ? p.id : idx + 1,
              sku: String(p.sku ?? ''),
              name: String(p.name ?? ''),
              price: Number(p.price ?? 0),
              stock: Number(p.stock ?? 0),
              category: String(p.category ?? ''),
              description: typeof p.description === 'string' ? p.description : undefined,
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString()
            }));
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
                productId: Number(it.productId ?? 0),
                quantity: Number(it.quantity ?? 0),
                unitPrice: Number(it.unitPrice ?? 0),
                subtotal: Number(it.subtotal ?? (Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0)))
              })) : []
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
