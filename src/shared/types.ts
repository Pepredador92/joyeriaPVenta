// Tipos e interfaces para la aplicación de joyería

export type ProductStatus = 'Activo' | 'Inactivo';

export interface Product {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  categoryId?: string;
  description?: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CustomerLevel {
  id: number;
  name: string;
  discountPercent: number;
  logicOp: 'AND' | 'OR';
  minAmount: number | null;
  minOrders: number | null;
  withinDays: number | null;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;

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

  levelId?: number | null;
  levelName?: string | null;
  levelDiscountPercent?: number | null;
  // Compatibilidad con datos antiguos
  discountLevel?: string | null;

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
  appliedDiscountLevel?: string | null;
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

export type ProductCatalogEventType =
  | 'ProductoCreado'
  | 'ProductoActualizado'
  | 'ProductoEliminado'
  | 'StockActualizado';

export type ProductCatalogEvent =
  | { type: 'ProductoCreado'; payload: Product }
  | { type: 'ProductoActualizado'; payload: Product }
  | { type: 'ProductoEliminado'; payload: { id: number } }
  | { type: 'StockActualizado'; payload: { id: number; stock: number } };

// Canales IPC para comunicación entre procesos
export const IPC_CHANNELS = {
  // Productos
  GET_PRODUCTS: 'get-products',
  GET_CATEGORY_CATALOG: 'get-category-catalog',
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
  GET_SALES_BY_CUSTOMER: 'get-sales-by-customer',
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
  GET_CUSTOMER_LEVELS: 'get-customer-levels',
  CREATE_CUSTOMER_LEVEL: 'create-customer-level',
  UPDATE_CUSTOMER_LEVEL: 'update-customer-level',
  DELETE_CUSTOMER_LEVEL: 'delete-customer-level',
  COMPUTE_CUSTOMER_LEVEL: 'compute-customer-level',
  RECOMPUTE_CUSTOMER_LEVELS: 'recompute-customer-levels',

  // Administración avanzada
  DELETE_ALL_SALES: 'delete-all-sales',
  DELETE_ALL_CUSTOMERS: 'delete-all-customers',

  // Logging (renderer -> main)
  LOG_INFO: 'log-info',
  LOG_WARN: 'log-warn'
} as const;

export const DEFAULT_ADMIN_PASSWORD = '080808';
export const MASTER_ADMIN_PASSWORD = '000000';
