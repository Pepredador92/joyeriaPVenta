import { Product, Customer, Sale, CashSession, Setting } from '../../shared/types';

class DatabaseService {
  private products: Product[] = [
    {
      id: 1,
      sku: 'ANI001',
      name: 'Anillo de Oro 18k con Diamante',
      price: 15999.99,
      stock: 5,
      category: 'Anillos',
      description: 'Elegante anillo de oro 18k con diamante natural de 0.5 quilates',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      sku: 'COL001',
      name: 'Collar de Perlas Naturales',
      price: 8999.99,
      stock: 3,
      category: 'Collares',
      description: 'Hermoso collar de perlas naturales de agua dulce',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      sku: 'ARE001',
      name: 'Aretes de Esmeraldas',
      price: 12500.00,
      stock: 8,
      category: 'Aretes',
      description: 'Aretes de oro blanco con esmeraldas colombianas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 4,
      sku: 'PUL001',
      name: 'Pulsera de Oro Rosa',
      price: 5999.99,
      stock: 12,
      category: 'Pulseras',
      description: 'Pulsera tejida de oro rosa 14k',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 5,
      sku: 'REL001',
      name: 'Reloj Suizo de Lujo',
      price: 45000.00,
      stock: 2,
      category: 'Relojes',
      description: 'Reloj suizo automático con caja de acero inoxidable',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 6,
      sku: 'ANI002',
      name: 'Anillo de Compromiso Solitario',
      price: 25999.99,
      stock: 3,
      category: 'Anillos',
      description: 'Anillo solitario con diamante de 1 quilate en oro blanco 18k',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 7,
      sku: 'COL002',
      name: 'Cadena de Oro Amarillo',
      price: 3499.99,
      stock: 15,
      category: 'Collares',
      description: 'Cadena eslabón cubano de oro amarillo 14k, 60cm',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 8,
      sku: 'ARE002',
      name: 'Aretes de Perlas Tahitianas',
      price: 7800.00,
      stock: 6,
      category: 'Aretes',
      description: 'Aretes con perlas tahitianas de 12mm en oro blanco',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 9,
      sku: 'PUL002',
      name: 'Pulsera Tennis de Diamantes',
      price: 18900.00,
      stock: 4,
      category: 'Pulseras',
      description: 'Pulsera tennis con diamantes de 0.10ct cada uno',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 10,
      sku: 'REL002',
      name: 'Reloj de Oro para Dama',
      price: 12999.99,
      stock: 7,
      category: 'Relojes',
      description: 'Reloj elegante con caja de oro amarillo 18k y diamantes',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 11,
      sku: 'ANI003',
      name: 'Alianza de Matrimonio',
      price: 2999.99,
      stock: 20,
      category: 'Anillos',
      description: 'Alianza clásica en oro blanco 18k, 4mm de ancho',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 12,
      sku: 'COL003',
      name: 'Gargantilla de Diamantes',
      price: 22500.00,
      stock: 2,
      category: 'Collares',
      description: 'Gargantilla con diamantes engarzados en oro blanco 18k',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 13,
      sku: 'ARE003',
      name: 'Aretes Largos con Rubíes',
      price: 9800.00,
      stock: 5,
      category: 'Aretes',
      description: 'Aretes colgantes con rubíes birmanos y diamantes',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 14,
      sku: 'PUL003',
      name: 'Brazalete de Oro Martillado',
      price: 4500.00,
      stock: 9,
      category: 'Pulseras',
      description: 'Brazalete ancho de oro amarillo 14k con acabado martillado',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 15,
      sku: 'REL003',
      name: 'Cronógrafo Deportivo',
      price: 8900.00,
      stock: 6,
      category: 'Relojes',
      description: 'Reloj cronógrafo deportivo con correa de acero inoxidable',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 16,
      sku: 'OTR001',
      name: 'Broche de Mariposa',
      price: 1899.99,
      stock: 8,
      category: 'Otros',
      description: 'Broche decorativo en forma de mariposa con cristales',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 17,
      sku: 'OTR002',
      name: 'Gemelos de Oro',
      price: 3200.00,
      stock: 12,
      category: 'Otros',
      description: 'Gemelos para camisa en oro amarillo 18k con iniciales',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 18,
      sku: 'ANI004',
      name: 'Anillo de Zafiro Azul',
      price: 13500.00,
      stock: 4,
      category: 'Anillos',
      description: 'Anillo con zafiro azul central y diamantes laterales',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  private customers: Customer[] = [
    {
      id: 1,
      name: 'María García Hernández',
      email: 'maria.garcia@email.com',
      phone: '+52 55 1234 5678',
      alternatePhone: '+52 55 8765 4321',
      address: 'Av. Reforma 123, Col. Juárez, Ciudad de México, CDMX, CP 06600',
      discountLevel: 'Gold',
      birthDate: '1985-03-15',
      gender: 'Femenino',
      occupation: 'Doctora',
      customerType: 'Particular',
      referredBy: 'Ana López',
      preferredContact: 'Email',
      preferredCategories: ['Anillos', 'Aretes'],
      budgetRange: '$10,000 - $25,000',
      specialOccasions: ['Aniversario', 'Cumpleaños'],
      notes: 'Prefiere oro blanco. Alérgica a níquel.',
      tags: ['VIP', 'Frecuente'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Carlos Rodríguez Martínez',
      email: 'carlos.rodriguez@email.com',
      phone: '+52 55 9876 5432',
      alternatePhone: '',
      address: 'Calle Principal 456, Col. Centro, Guadalajara, Jalisco, CP 44100',
      discountLevel: 'Silver',
      birthDate: '1978-11-22',
      gender: 'Masculino',
      occupation: 'Ingeniero Civil',
      customerType: 'Particular',
      referredBy: '',
      preferredContact: 'Teléfono',
      preferredCategories: ['Relojes', 'Anillos'],
      budgetRange: '$5,000 - $10,000',
      specialOccasions: ['Navidad'],
      notes: 'Cliente desde 2020. Siempre compra en efectivo.',
      tags: ['Frecuente'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Ana López Vargas',
      email: 'ana.lopez@email.com',
      phone: '+52 81 2468 1357',
      alternatePhone: '+52 81 9999 8888',
      address: 'Blvd. Constitución 789, Col. Del Valle, Monterrey, Nuevo León, CP 64780',
      discountLevel: 'Platinum',
      birthDate: '1990-07-08',
      gender: 'Femenino',
      occupation: 'Empresaria',
      customerType: 'Empresa',
      referredBy: '',
      preferredContact: 'WhatsApp',
      preferredCategories: ['Collares', 'Pulseras', 'Aretes'],
      budgetRange: '$25,000+',
      specialOccasions: ['Cumpleaños', 'Día de la Madre', 'Navidad'],
      notes: 'CEO de empresa textil. Compra regalos para empleadas destacadas.',
      tags: ['VIP', 'Empresa', 'Frecuente'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 4,
      name: 'Jorge Mendoza Silva',
      email: 'jorge.mendoza@gmail.com',
      phone: '+52 33 5551 2234',
      alternatePhone: '',
      address: 'Av. López Mateos 1234, Col. Providencia, Guadalajara, Jalisco, CP 44630',
      discountLevel: 'Bronze',
      birthDate: '1992-02-14',
      gender: 'Masculino',
      occupation: 'Contador',
      customerType: 'Particular',
      referredBy: 'Carlos Rodríguez',
      preferredContact: 'Email',
      preferredCategories: ['Anillos'],
      budgetRange: '$2,000 - $5,000',
      specialOccasions: ['Aniversario'],
      notes: 'Buscando anillo de compromiso. Presupuesto limitado.',
      tags: ['Nuevo'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 5,
      name: 'Sofía Ramírez Torres',
      email: 'sofia.ramirez@hotmail.com',
      phone: '+52 442 123 4567',
      alternatePhone: '+52 442 987 6543',
      address: 'Calle Independencia 567, Centro Histórico, Querétaro, Qro, CP 76000',
      discountLevel: 'Gold',
      birthDate: '1982-09-30',
      gender: 'Femenino',
      occupation: 'Abogada',
      customerType: 'Particular',
      referredBy: '',
      preferredContact: 'SMS',
      preferredCategories: ['Aretes', 'Collares', 'Relojes'],
      budgetRange: '$10,000 - $25,000',
      specialOccasions: ['Cumpleaños', 'Día de San Valentín'],
      notes: 'Coleccionista de relojes vintage. Prefiere citas por la tarde.',
      tags: ['VIP', 'Coleccionista'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 6,
      name: 'Roberto Castillo Vega',
      email: 'r.castillo@empresa.com',
      phone: '+52 55 4444 5555',
      alternatePhone: '+52 55 6666 7777',
      address: 'Torre Corporativa, Piso 15, Santa Fe, Ciudad de México, CDMX, CP 01219',
      discountLevel: 'Platinum',
      birthDate: '1975-12-05',
      gender: 'Masculino',
      occupation: 'Director General',
      customerType: 'Mayorista',
      referredBy: '',
      preferredContact: 'Email',
      preferredCategories: ['Relojes', 'Gemelos', 'Anillos'],
      budgetRange: '$25,000+',
      specialOccasions: ['Navidad', 'Fin de Año'],
      notes: 'Compra regalos corporativos. Volumen alto. Facturación empresarial.',
      tags: ['VIP', 'Mayorista', 'Corporativo'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 7,
      name: 'Isabella Morales Cruz',
      email: 'isabella.morales@yahoo.com',
      phone: '+52 998 777 8889',
      alternatePhone: '',
      address: 'Zona Hotelera, Blvd. Kukulcán Km 12, Cancún, Quintana Roo, CP 77500',
      discountLevel: 'Silver',
      birthDate: '1995-06-18',
      gender: 'Femenino',
      occupation: 'Gerente de Hotel',
      customerType: 'Particular',
      referredBy: 'Sofía Ramírez',
      preferredContact: 'WhatsApp',
      preferredCategories: ['Pulseras', 'Aretes'],
      budgetRange: '$5,000 - $10,000',
      specialOccasions: ['Vacaciones', 'Cumpleaños'],
      notes: 'Trabaja en turismo. Prefiere joyería resistente al agua de mar.',
      tags: ['Frecuente', 'Turismo'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 8,
      name: 'Diego Herrera Ruiz',
      email: 'diego.herrera@tech.com',
      phone: '+52 664 333 2222',
      alternatePhone: '+52 664 111 9999',
      address: 'Zona Río, Av. Paseo de los Héroes 9889, Tijuana, Baja California, CP 22320',
      discountLevel: 'Gold',
      birthDate: '1988-04-12',
      gender: 'Masculino',
      occupation: 'Ingeniero en Sistemas',
      customerType: 'Particular',
      referredBy: '',
      preferredContact: 'Email',
      preferredCategories: ['Relojes', 'Cadenas'],
      budgetRange: '$10,000 - $25,000',
      specialOccasions: ['Aniversario', 'Día del Padre'],
      notes: 'Trabaja en empresa tecnológica. Interesado en relojes inteligentes de lujo.',
      tags: ['Tecnología', 'Frecuente'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 9,
      name: 'Valentina Jiménez Pérez',
      email: 'vale.jimenez@gmail.com',
      phone: '+52 222 555 6789',
      alternatePhone: '',
      address: 'Angelópolis, Vía Atlixcáyotl 5555, Puebla, Puebla, CP 72810',
      discountLevel: 'Bronze',
      birthDate: '1997-01-25',
      gender: 'Femenino',
      occupation: 'Estudiante de Medicina',
      customerType: 'Particular',
      referredBy: 'Isabella Morales',
      preferredContact: 'SMS',
      preferredCategories: ['Aretes', 'Cadenas'],
      budgetRange: '$500 - $2,000',
      specialOccasions: ['Graduación', 'Cumpleaños'],
      notes: 'Estudiante. Presupuesto limitado. Interesada en joyería sencilla y elegante.',
      tags: ['Estudiante', 'Presupuesto limitado'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 10,
      name: 'Alejandro Torres Sandoval',
      email: 'a.torres@constructora.mx',
      phone: '+52 477 888 9999',
      alternatePhone: '+52 477 777 5555',
      address: 'Zona Industrial, Blvd. Adolfo López Mateos 3456, León, Guanajuato, CP 37530',
      discountLevel: 'Platinum',
      birthDate: '1970-10-03',
      gender: 'Masculino',
      occupation: 'Constructor',
      customerType: 'Empresa',
      referredBy: 'Roberto Castillo',
      preferredContact: 'Teléfono',
      preferredCategories: ['Relojes', 'Cadenas', 'Anillos'],
      budgetRange: '$25,000+',
      specialOccasions: ['Navidad', 'Año Nuevo', 'Día del Padre'],
      notes: 'Dueño de constructora. Compra regalos para socios y familia extendida.',
      tags: ['VIP', 'Empresa', 'Constructor', 'Volumen Alto'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  private sales: Sale[] = [
    {
      id: 1,
      customerId: 1,
      subtotal: 15999.99,
      discount: 1279.99, // 8% Gold discount
      tax: 2355.20, // 16% tax on discounted amount
      total: 17075.20,
      paymentMethod: 'Tarjeta',
      status: 'Completada',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 días atrás
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      items: [
        {
          id: 1,
          saleId: 1,
          productId: 1,
          quantity: 1,
          unitPrice: 15999.99,
          subtotal: 15999.99
        }
      ]
    },
    {
      id: 2,
      customerId: 3,
      subtotal: 21499.99,
      discount: 2579.99, // 12% Platinum discount
      tax: 3027.20, // 16% tax
      total: 21947.20,
      paymentMethod: 'Efectivo',
      status: 'Completada',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 día atrás
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      items: [
        {
          id: 2,
          saleId: 2,
          productId: 2,
          quantity: 1,
          unitPrice: 8999.99,
          subtotal: 8999.99
        },
        {
          id: 3,
          saleId: 2,
          productId: 3,
          quantity: 1,
          unitPrice: 12500.00,
          subtotal: 12500.00
        }
      ]
    },
    {
      id: 3,
      customerId: 2,
      subtotal: 11999.98,
      discount: 599.99, // 5% Silver discount
      tax: 1824.00, // 16% tax
      total: 13223.99,
      paymentMethod: 'Transferencia',
      status: 'Completada',
      createdAt: new Date(Date.now() - 43200000).toISOString(), // 12 horas atrás
      updatedAt: new Date(Date.now() - 43200000).toISOString(),
      items: [
        {
          id: 4,
          saleId: 3,
          productId: 4,
          quantity: 2,
          unitPrice: 5999.99,
          subtotal: 11999.98
        }
      ]
    },
    {
      id: 4,
      customerId: 5,
      subtotal: 7300.00,
      discount: 584.00, // 8% Gold discount
      tax: 1074.56, // 16% tax
      total: 7790.56,
      paymentMethod: 'Tarjeta',
      status: 'Completada',
      createdAt: new Date(Date.now() - 21600000).toISOString(), // 6 horas atrás
      updatedAt: new Date(Date.now() - 21600000).toISOString(),
      items: [
        {
          id: 5,
          saleId: 4,
          productId: 7,
          quantity: 1,
          unitPrice: 3499.99,
          subtotal: 3499.99
        },
        {
          id: 6,
          saleId: 4,
          productId: 16,
          quantity: 2,
          unitPrice: 1899.99,
          subtotal: 3799.98
        }
      ]
    },
    {
      id: 5,
      customerId: 10,
      subtotal: 45000.00,
      discount: 5400.00, // 12% Platinum discount
      tax: 6336.00, // 16% tax
      total: 45936.00,
      paymentMethod: 'Transferencia',
      status: 'Completada',
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      items: [
        {
          id: 7,
          saleId: 5,
          productId: 5,
          quantity: 1,
          unitPrice: 45000.00,
          subtotal: 45000.00
        }
      ]
    },
    {
      id: 6,
      customerId: 4,
      subtotal: 5999.98,
      discount: 0, // 0% Bronze discount
      tax: 959.99, // 16% tax
      total: 6959.97,
      paymentMethod: 'Efectivo',
      status: 'Completada',
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      items: [
        {
          id: 8,
          saleId: 6,
          productId: 11,
          quantity: 2,
          unitPrice: 2999.99,
          subtotal: 5999.98
        }
      ]
    }
  ];
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
    if (index === -1) return null;
    
    this.settings[index] = {
      ...this.settings[index],
      value,
      updatedAt: new Date().toISOString()
    };
    return this.settings[index];
  }

  // Inicialización
  async initialize(): Promise<void> {
    console.log('🚀 Database service initialized with mock data');
    console.log(`📦 ${this.products.length} products loaded`);
    console.log(`👥 ${this.customers.length} customers loaded`);
    console.log(`💰 ${this.sales.length} sales loaded`);
    console.log(`📊 Total sales value: $${this.sales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}`);
    console.log(`⚙️ ${this.settings.length} settings loaded`);
  }
}

export const databaseService = new DatabaseService();
