// Tipos e interfaces para la aplicación de joyería

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  discountLevel: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  
  // Información demográfica
  birthDate?: string;
  gender?: string;
  occupation?: string;
  
  // Información comercial
  customerType?: 'Particular' | 'Empresa' | 'Mayorista';
  referredBy?: string;
  preferredContact?: 'Email' | 'Teléfono' | 'SMS' | 'WhatsApp';
  
  // Preferencias de compra
  preferredCategories?: string[];
  budgetRange?: string;
  specialOccasions?: string[];
  
  // Información adicional
  notes?: string;
  tags?: string[];
  isActive?: boolean;
  
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId?: number;
  categoryId?: string;
  categoryName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  type?: 'product' | 'manual';
}

export interface InventoryMovement {
  id: number;
  saleId?: number;
  productId?: number;
  categoryId?: string;
  categoryName?: string;
  quantity: number;
  type: 'entrada' | 'salida' | 'ajuste';
  createdAt: string;
  notes?: string;
}

export interface Sale {
  id: number;
  customerId?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  status: 'Completada' | 'Cancelada' | 'Pendiente';
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  // Auditoría de descuento aplicado en el momento de la venta
  appliedDiscountLevel?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  appliedDiscountPercent?: number; // porcentaje (ej. 5 para 5%)
  notes?: string;
  inventoryMovements?: InventoryMovement[];
}

export interface CashSession {
  id: number;
  startTime: string;
  endTime?: string;
  initialAmount: number;
  finalAmount?: number;
  expectedAmount?: number;
  difference?: number;
  status: 'Abierta' | 'Cerrada';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Setting {
  id: number;
  key: string;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Canales IPC para comunicación entre procesos
export const IPC_CHANNELS = {
  // Productos
  GET_PRODUCTS: 'get-products',
  CREATE_PRODUCT: 'create-product',
  UPDATE_PRODUCT: 'update-product',
  DELETE_PRODUCT: 'delete-product',

  // Clientes
  GET_CUSTOMERS: 'get-customers',
  CREATE_CUSTOMER: 'create-customer',
  UPDATE_CUSTOMER: 'update-customer',
  DELETE_CUSTOMER: 'delete-customer',

  // Ventas
  GET_SALES: 'get-sales',
  CREATE_SALE: 'create-sale',
  UPDATE_SALE: 'update-sale',
  DELETE_SALE: 'delete-sale',
  CLEAR_SALES: 'clear-sales',
  GET_SALES_BY_RANGE: 'get-sales-by-range',
  SALES_CHANGED: 'sales-changed',

  // Sesiones de caja
  GET_CASH_SESSIONS: 'get-cash-sessions',
  CREATE_CASH_SESSION: 'create-cash-session',
  UPDATE_CASH_SESSION: 'update-cash-session',
  DELETE_CASH_SESSION: 'delete-cash-session',

  // Configuración
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTING: 'update-setting',
  DELETE_SETTING: 'delete-setting',

  // Administración avanzada
  DELETE_ALL_SALES: 'delete-all-sales',
  DELETE_ALL_CUSTOMERS: 'delete-all-customers',

  // Logging (renderer -> main)
  LOG_INFO: 'log-info',
  LOG_WARN: 'log-warn'
} as const;

export const DEFAULT_ADMIN_PASSWORD = '080808';
export const MASTER_ADMIN_PASSWORD = '000000';
