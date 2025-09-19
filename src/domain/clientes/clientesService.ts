import { Customer, Sale, Product } from '../../shared/types';
import { getCustomerLevelRules } from '../configuracion/configuracionService';

// Tipos

export type CustomerStatsEntry = {
  customer: Customer;
  purchases: number;
  total: number;
  avgPurchase: number;
  lastPurchase: string;
};

// CRUD y validaciones para módulo Clientes
export type CustomerCreateInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
export type CustomerUpdateInput = Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>;

const ALLOWED_DISCOUNT: Customer['discountLevel'][] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export async function loadCustomers(): Promise<Customer[]> {
  if (!(window as any).electronAPI?.getCustomers) return [];
  return (await (window as any).electronAPI.getCustomers()) as Customer[];
}

export function filterCustomers(customers: Customer[], query: string): Customer[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return customers;
  return customers.filter((c) => {
    const phones = [c.phone, c.alternatePhone].filter(Boolean) as string[];
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      phones.some((p) => (p || '').toLowerCase().includes(q))
    );
  });
}

// Búsqueda en clientes usando capa de dominio: carga via IPC y filtra por nombre/email/teléfono (y adicionalmente por ID)
export async function searchCustomers(query: string): Promise<Customer[]> {
  const all = await loadCustomers();
  const base = filterCustomers(all, query);
  const q = (query || '').trim();
  if (!q) return base.slice(0, 50);
  // complemento: permitir match por ID parcial
  const byId = all.filter(c => String(c.id).includes(q));
  const merged = [...base];
  byId.forEach(c => { if (!merged.some(m => m.id === c.id)) merged.push(c); });
  return merged.slice(0, 50);
}

export function validateCustomer(input: Partial<Customer>): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = (input.name || '').trim();
  if (!name) errors.name = 'El nombre es obligatorio';

  const email = (input.email || '').trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Email inválido';

  const phone = (input.phone || '').trim();
  if (phone && phone.replace(/\D+/g, '').length < 7) errors.phone = 'Teléfono inválido';

  const discount = input.discountLevel as Customer['discountLevel'];
  if (discount && !ALLOWED_DISCOUNT.includes(discount)) errors.discountLevel = 'Nivel de descuento inválido';

  return { ok: Object.keys(errors).length === 0, errors };
}

function nowISO() {
  return new Date().toISOString();
}

export async function createCustomer(input: CustomerCreateInput): Promise<Customer> {
  const { ok, errors } = validateCustomer(input);
  if (!ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = errors;
    throw err;
  }
  const payload: CustomerCreateInput = {
    name: (input.name || '').trim(),
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    alternatePhone: input.alternatePhone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    discountLevel: input.discountLevel || 'Bronze',
    birthDate: input.birthDate,
    gender: input.gender,
    occupation: input.occupation,
    customerType: input.customerType || 'Particular',
    referredBy: input.referredBy,
    preferredContact: input.preferredContact,
    preferredCategories: input.preferredCategories,
    budgetRange: input.budgetRange,
    specialOccasions: input.specialOccasions,
    notes: input.notes,
    tags: input.tags,
    isActive: input.isActive ?? true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  } as any;
  return await (window as any).electronAPI.createCustomer(payload);
}

export async function updateCustomer(id: number, input: CustomerUpdateInput): Promise<Customer | null> {
  const { ok, errors } = validateCustomer({ ...input, name: input.name ?? 'x' });
  // Para update permitimos no enviar name, por eso ponemos dummy 'x' arriba; quitamos error si no venía name.
  if (!ok) {
    if (input.name === undefined) delete (errors as any).name;
    if (Object.keys(errors).length) {
      const err = new Error('VALIDATION_ERROR');
      (err as any).fields = errors;
      throw err;
    }
  }
  const patch: CustomerUpdateInput = { ...input };
  return await (window as any).electronAPI.updateCustomer(id, patch);
}

export async function deleteCustomer(id: number): Promise<boolean> {
  return await (window as any).electronAPI.deleteCustomer(id);
}

// Util: color por tipo de cliente
export function getCustomerTypeColor(type: string = 'Particular'): string {
  switch (type) {
    case 'Mayorista':
      return '#9c27b0';
    case 'VIP':
      return '#ff9800';
    case 'Particular':
    default:
      return '#2196f3';
  }
}

// Construir estadísticas por cliente a partir de ventas filtradas
export function getCustomerStats(sales: Array<Sale & { items: any[] }>, customers: Customer[]): CustomerStatsEntry[] {
  const byId: Record<number, CustomerStatsEntry> = {};
  sales.forEach((sale) => {
    if (!sale.customerId) return;
    const customer = customers.find((c) => c.id === sale.customerId);
    if (!customer) return;
    if (!byId[sale.customerId]) {
      byId[sale.customerId] = {
        customer,
        purchases: 0,
        total: 0,
        avgPurchase: 0,
        lastPurchase: sale.createdAt,
      };
    }
    const entry = byId[sale.customerId];
    entry.purchases += 1;
    entry.total += sale.total || 0;
    if (new Date(sale.createdAt) > new Date(entry.lastPurchase)) {
      entry.lastPurchase = sale.createdAt;
    }
  });
  Object.values(byId).forEach((e) => {
    e.avgPurchase = e.purchases ? e.total / e.purchases : 0;
  });
  return Object.values(byId).sort((a, b) => b.total - a.total);
}

// Filtrar lista de estadísticas por query (nombre/email/teléfono)
export function filterCustomerStats(list: CustomerStatsEntry[], query: string): CustomerStatsEntry[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter(({ customer: c }) => {
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });
}

// Estadísticas detalladas para un cliente (incluye top categorías y ventas recientes)
export function getStatsForCustomer(
  id: number,
  sales: Array<Sale & { items: any[] }>,
  customers: Customer[],
  products: Product[]
) {
  const cust = customers.find((c) => c.id === id);
  const custSales = sales
    .filter((s) => s.customerId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const purchases = custSales.length;
  const total = custSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avg = purchases ? total / purchases : 0;
  const lastPurchase = purchases ? custSales[0].createdAt : null;
  const catCount: Record<string, number> = {};
  custSales.forEach((s) => {
    (s.items || []).forEach((it: any) => {
      const p = products.find((pp) => pp.id === it.productId);
      const cat = p?.category || 'Otros';
      catCount[cat] = (catCount[cat] || 0) + it.quantity;
    });
  });
  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const recent = custSales.slice(0, 10);
  return { customer: cust, purchases, total, avg, lastPurchase, topCategories, recent };
}

// Decidir nivel de cliente a partir del total gastado (reglas actuales)
// Compat: mantiene lógica antigua para mapear tipos heredados
export function decideCustomerLevelFromTotal(total: number, current: string = 'Particular'): string {
  let level = current || 'Particular';
  if (total > 50000) level = 'VIP';
  else if (total > 15000) level = 'Mayorista';
  else level = 'Particular';
  return level;
}

// Nueva: determina nivel de descuento (Bronze/Silver/Gold/Platinum) segun reglas configurables
export async function decideCustomerLevelForCustomer(customer: Customer, allSales: Sale[]): Promise<Customer['discountLevel']> {
  const rules = await getCustomerLevelRules();
  if (rules.criteria === 'amount') {
    const total = allSales.filter(s => s.customerId === customer.id).reduce((sum, s) => sum + (s.total || 0), 0);
    return pickLevelByThreshold(total, rules.thresholds);
  } else {
    // purchases
    const months = Math.max(1, rules.periodMonths ?? 6);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const count = allSales.filter(s => s.customerId === customer.id).filter(s => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    }).length;
    return pickLevelByThreshold(count, rules.thresholds);
  }
}

function pickLevelByThreshold(value: number, thresholds: Record<string, number>): Customer['discountLevel'] {
  // Asignación por mayor o igual al umbral
  if (value >= (thresholds.Platinum ?? 100000)) return 'Platinum';
  if (value >= (thresholds.Gold ?? 50000)) return 'Gold';
  if (value >= (thresholds.Silver ?? 15000)) return 'Silver';
  return 'Bronze';
}

// Utilidades
export function phoneDigits(phone?: string): string {
  return (phone || '').replace(/\D+/g, '');
}
