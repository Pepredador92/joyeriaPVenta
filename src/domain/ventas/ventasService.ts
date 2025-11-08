// Domain service for Ventas business rules
// This module is UI-agnostic and contains pure functions plus thin IPC calls
import * as cfg from '../configuracion/configuracionService';

// Alias tolerante a nombres antiguos del servicio de configuración
type DiscountLevel = {
  id: number;
  name: string;
  discount_percent: number;
  priority?: number;
  active?: number;
  logic_op?: 'AND' | 'OR';
  min_amount?: number | null;
  min_orders?: number | null;
  within_days?: number | null;
};

const getDiscountLevelsCfg: () => Promise<DiscountLevel[]> =
  (cfg as any).getDiscountLevels ??
  (cfg as any).listCustomerLevels ??
  (cfg as any).getCustomerLevels ??
  (async () => []);

export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';

const normalizeCategoryId = (value: string) => (value || '').toString().trim().toLowerCase();
const formatCategoryName = (value: string) => {
  const trimmed = (value || '').toString().trim();
  if (!trimmed) return 'Sin categoría';
  return trimmed
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
};

const resolveProductStatus = (value: unknown) => (value === 'Inactivo' ? 'Inactivo' : 'Activo');

export type OrderItem = {
  id: number;
  type: 'product' | 'manual';
  productId?: number;
  name: string;
  categoryId: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
};

export type QuickSale = {
  fecha: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  notas?: string;
};

export type DiscountMap = { [level: string]: number };

export type VentasData = {
  products: any[];
  customers: any[];
  recentSales: any[];
};

export function filterActiveProducts<T extends { status?: string; stock?: number }>(products: T[]): T[] {
  return (products || []).filter((product) => {
    const status = resolveProductStatus((product as any)?.status);
    const stock = Number((product as any)?.stock ?? 0);
    return status === 'Activo' && Number.isFinite(stock) && stock >= 0;
  });
}

export function computeCategoryOptionsFromProducts(
  products: Array<{ status?: string; stock?: number; category?: string; categoryName?: string }>
): string[] {
  const active = filterActiveProducts(products);
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const product of active) {
    const label = formatCategoryName((product as any)?.category || (product as any)?.categoryName || '');
    if (!label || seen.has(label)) continue;
    seen.add(label);
    categories.push(label);
  }
  return categories.sort((a, b) => a.localeCompare(b, 'es'));
}

export function getInitialPaymentMethod(): PaymentMethod {
  try {
    const sys = localStorage.getItem('systemSettings');
    if (sys) {
      const parsed = JSON.parse(sys);
      if (parsed.defaultPaymentMethod) return parsed.defaultPaymentMethod as PaymentMethod;
    }
  } catch {}
  return 'Efectivo';
}

export async function loadVentasData(): Promise<VentasData> {
  if (!(window as any).electronAPI) return { products: [], customers: [], recentSales: [] };
  const [productsData, customersData, salesData] = await Promise.all([
    (window as any).electronAPI.getProducts(),
    (window as any).electronAPI.getCustomers(),
    (window as any).electronAPI.getSales()
  ]);
  const recentSales = [...salesData]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
  return { products: productsData, customers: customersData, recentSales };
}

export function readDiscountMapFromLocal(defaults: DiscountMap = { Bronze: 0, Silver: 0.05, Gold: 0.08, Platinum: 0.12 }): DiscountMap {
  try {
    const dl = localStorage.getItem('discountLevels');
    if (dl) {
      const parsed = JSON.parse(dl as string);
      return {
        Bronze: (parsed.Bronze ?? 0) / 100,
        Silver: (parsed.Silver ?? 5) / 100,
        Gold: (parsed.Gold ?? 8) / 100,
        Platinum: (parsed.Platinum ?? 12) / 100,
      };
    }
  } catch {}
  return defaults;
}

// Cargar mapa de descuentos desde Configuración (porcentaje → fracción)
export async function loadDiscountMapFromSettings(): Promise<DiscountMap> {
  try {
    const raw: any = await getDiscountLevelsCfg();
    const map: DiscountMap = {};
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!entry) continue;
        const name = (entry.name || '').toString().trim();
        if (!name) continue;
        const percent = Number(entry.discount_percent ?? 0);
        map[name] = Number.isFinite(percent) ? Math.max(0, percent) / 100 : 0;
      }
    } else if (raw && typeof raw === 'object') {
      for (const [name, percent] of Object.entries(raw as Record<string, number>)) {
        const trimmed = (name || '').toString().trim();
        if (!trimmed) continue;
        const value = Number(percent);
        map[trimmed] = Number.isFinite(value) ? Math.max(0, value) / 100 : 0;
      }
    }
    if (Object.keys(map).length) {
      return map;
    }
  } catch {}
  return { Bronze: 0, Silver: 0.05, Gold: 0.10, Platinum: 0.15 };
}

export function readTaxRateFromLocal(defaultRate = 0.16): number {
  try {
    const bs = localStorage.getItem('businessSettings');
    if (bs) {
      const parsed = JSON.parse(bs as string);
      if (typeof parsed.taxRate === 'number') return (parsed.taxRate || 16) / 100;
    }
  } catch {}
  return defaultRate;
}

export async function readTaxRateFromSettings(current: number): Promise<number> {
  try {
    if ((window as any).electronAPI?.getSettings) {
      const rows = await (window as any).electronAPI.getSettings();
      const tax = rows?.find((r: any) => r.key === 'tax_rate');
      if (tax && !Number.isNaN(parseFloat(tax.value))) {
        return parseFloat(tax.value); // already as 0.16
      }
    }
  } catch {}
  return current;
}

export function addProductToOrder(items: OrderItem[], product: any): OrderItem[] {
  if (product.stock <= 0) return items;
  const found = items.find((i) => i.type === 'product' && i.productId === product.id);
  if (found) {
    return items.map((i) => (i === found ? { ...i, quantity: i.quantity + 1 } : i));
  }
  const categoryName = formatCategoryName(product.category || product.categoryName || '');
  const categoryId = normalizeCategoryId(product.categoryId || product.category || categoryName);
  return [
    ...items,
    {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: 'product',
      productId: product.id,
      name: product.name,
      categoryId,
      categoryName,
      unitPrice: product.price,
      quantity: 1,
    },
  ];
}

export function addManualQuickSale(items: OrderItem[], quick: QuickSale): OrderItem[] {
  if (quick.cantidad < 1 || quick.precioUnitario <= 0) return items;
  const categoryName = formatCategoryName(quick.categoria);
  const categoryId = normalizeCategoryId(quick.categoria);
  return [
    ...items,
    {
      id: Date.now(),
      type: 'manual',
      name: `Venta rápida · ${quick.categoria}`,
      categoryId,
      categoryName,
      unitPrice: Number(quick.precioUnitario) || 0,
      quantity: Math.floor(quick.cantidad) || 1,
      notes: quick.notas?.trim() || '',
    },
  ];
}

export const removeItem = (items: OrderItem[], id: number) => items.filter((i) => i.id !== id);
export const updateQty = (items: OrderItem[], id: number, qty: number) =>
  items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.floor(qty) || 1) } : i));
export const updatePrice = (items: OrderItem[], id: number, price: number) =>
  items.map((i) => (i.id === id ? { ...i, unitPrice: Math.min(999999, Math.max(0, Number(price) || 0)) } : i));

export function computeFilteredCustomers(customers: any[], customerQuery: string): any[] {
  const raw = customerQuery.trim();
  if (!raw) return customers.slice(0, 50);
  const q = raw.toLowerCase();
  const qDigits = raw.replace(/\D+/g, '');
  return customers
    .filter((c: any) => {
      const idMatch = String(c.id).includes(raw);
      const nameMatch = (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
      const phones = [c.phone, c.alternatePhone].filter(Boolean) as string[];
      const phoneMatch = qDigits.length > 0 && phones.some((p) => p.replace(/\D+/g, '').includes(qDigits));
      return idMatch || nameMatch || phoneMatch;
    })
    .slice(0, 50);
}

export function computeFilteredProducts(
  products: any[],
  term: string,
  category?: string,
  onlyInStock?: boolean
): any[] {
  const active = filterActiveProducts(products);
  const q = (term || '').trim().toLowerCase();
  const normalizedCategory = (category || '').trim().toLowerCase();
  return active.filter((p: any) => {
    const productCategory = ((p.categoryName ?? p.category) || '').toString().trim().toLowerCase();
    const matchesQuery = !q
      || (p.name || '').toLowerCase().includes(q)
      || (p.sku || '').toLowerCase().includes(q)
      || productCategory.includes(q);
    if (!matchesQuery) return false;
    const matchesCategory = !normalizedCategory
      || productCategory === normalizedCategory;
    if (!matchesCategory) return false;
    if (onlyInStock) {
      const stock = Number(p.stock ?? 0);
      if (!(stock > 0)) return false;
    }
    return true;
  });
}

export function computeTotals(items: OrderItem[], selectedCustomer: any, discountMap: DiscountMap, taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const discountRate = selectedCustomer ? discountMap[selectedCustomer.discountLevel] || 0 : 0;
  const discount = +(subtotal * discountRate).toFixed(2);
  const tax = +(((subtotal - discount) * taxRate)).toFixed(2);
  const total = +(subtotal - discount + tax).toFixed(2);
  return { subtotal, discountRate, discount, tax, total };
}

export async function confirmOrder(
  items: OrderItem[],
  selectedCustomer: any,
  paymentMethod: PaymentMethod,
  totals: { subtotal: number; discount: number; tax: number; total: number }
): Promise<void> {
  if (items.length === 0) return;
  // Require customer if configured
  try {
    const sys = localStorage.getItem('systemSettings');
    if (sys) {
      const parsed = JSON.parse(sys);
      if (parsed.requireCustomerForSale && !selectedCustomer) {
        throw new Error('REQUIRE_CUSTOMER');
      }
    }
  } catch {}

  const saleItems = items.map((i) => ({
    productId: i.type === 'product' && i.productId ? i.productId : undefined,
    categoryId: i.categoryId,
    categoryName: i.categoryName,
    quantity: Math.max(1, Math.floor(i.quantity)),
    unitPrice: +(i.unitPrice || 0),
    subtotal: +(i.unitPrice * i.quantity).toFixed(2),
    notes: i.notes || undefined,
    type: i.type,
  }));
  const manualNotes = items
    .filter((i) => i.type === 'manual')
    .map((i) => `Categoría: ${i.categoryName}${i.notes ? ' | ' + i.notes : ''}`);

  const appliedDiscountPercent = totals.subtotal > 0 ? +(totals.discount / totals.subtotal * 100).toFixed(2) : 0;

  const saleData = {
    customerId: selectedCustomer?.id || undefined,
    paymentMethod,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    items: saleItems,
    notes: manualNotes.join(' || ') || undefined,
    createdAt: new Date().toISOString(),
    appliedDiscountLevel: (selectedCustomer?.discountLevel as any) || 'Bronze',
    appliedDiscountPercent,
  } as any;

  const api = (window as any).electronAPI;
  if (!api?.createSale) throw new Error('API_NOT_AVAILABLE');
  await api.createSale(saleData);
}
