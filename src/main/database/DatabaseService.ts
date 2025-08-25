import { Product, Customer, Sale, CashSession, Setting } from '../../shared/types';

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
      value: 'Joyería Elegante',
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
    return this.products[index];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    
    this.products.splice(index, 1);
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
    return this.customers[index];
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.customers.splice(index, 1);
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
    return newSale;
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
    return this.cashSessions[index];
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
      return newSetting;
    }
    this.settings[index] = { ...this.settings[index], value, updatedAt: now };
    return this.settings[index];
  }

  // Inicialización
  async initialize(): Promise<void> {
    console.log('🚀 Database service initialized (no seed data)');
    console.log(`📦 ${this.products.length} products`);
    console.log(`👥 ${this.customers.length} customers`);
    console.log(`💰 ${this.sales.length} sales`);
    console.log(`⚙️ ${this.settings.length} settings`);
  }
}

export const databaseService = new DatabaseService();
