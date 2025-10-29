// Dominio de Reportes: funciones puras sobre colecciones ya cargadas (sin Electron)

export type SaleItem = {
  productId?: number;
  categoryId?: string;
  categoryName?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number; // sin impuestos
  type?: 'product' | 'manual';
};

export type Sale = {
  id: number;
  createdAt: string | number | Date;
  total?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  customerId?: number | null;
  paymentMethod?: string;
  items?: SaleItem[];
};

export type Product = { id: number; name: string; category?: string | null };
export type Customer = { id: number; name: string };

export type PeriodGranularity = 'day' | 'month' | 'year';
export type PeriodRange = { startDate: string; endDate: string; granularity?: PeriodGranularity };

const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function getVentasTotales(sales: Sale[]): number {
  return (sales || []).reduce((sum, s) => sum + (s.total || 0), 0);
}

export function getImpuestosTotales(sales: Sale[]): number {
  return (sales || []).reduce((sum, s) => sum + (s.tax || 0), 0);
}

// Extra útil para UI existente
export function getDescuentosTotales(sales: Sale[]): number {
  return (sales || []).reduce((sum, s) => sum + (s.discount || 0), 0);
}

export function getTopProductos(
  sales: Sale[],
  products: Product[],
  n = 10
): Array<{ id: number; name: string; category: string; quantity: number; revenue: number }> {
  const byId = new Map<number, { id: number; name: string; category: string; quantity: number; revenue: number }>();
  const prodMap = new Map(products.map(p => [p.id, p] as const));
  (sales || []).forEach(s => {
    (s.items || []).forEach(it => {
      const pid = it.productId ?? 0;
      const p = prodMap.get(pid);
      if (!p) return; // ignora ventas rápidas sin producto
      const cur = byId.get(pid) || { id: p.id, name: p.name, category: p.category || 'Sin categoría', quantity: 0, revenue: 0 };
      cur.quantity += it.quantity || 0;
      cur.revenue += it.subtotal || 0;
      byId.set(pid, cur);
    });
  });
  return Array.from(byId.values()).sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

export function getTopClientes(
  sales: Sale[],
  customers: Customer[],
  n = 10
): Array<{ customer: Customer; total: number; purchases: number; avg: number }> {
  const custMap = new Map(customers.map(c => [c.id, c] as const));
  const agg = new Map<number, { total: number; purchases: number }>();
  (sales || []).forEach(s => {
    const id = s.customerId ?? undefined;
    if (!id) return;
    const cur = agg.get(id) || { total: 0, purchases: 0 };
    cur.total += s.total || 0;
    cur.purchases += 1;
    agg.set(id, cur);
  });
  const out: Array<{ customer: Customer; total: number; purchases: number; avg: number }> = [];
  agg.forEach((v, id) => {
    const c = custMap.get(id);
    if (!c) return;
    out.push({ customer: c, total: v.total, purchases: v.purchases, avg: v.purchases ? v.total / v.purchases : 0 });
  });
  return out.sort((a, b) => b.total - a.total).slice(0, n);
}

export function getIngresosPorPeriodo(
  sales: Sale[],
  range: PeriodRange
): Array<{ key: string; date: Date; total: number }> {
  const granularity: PeriodGranularity = range.granularity || 'day';
  const start = new Date(range.startDate + (range.startDate.length <= 10 ? 'T00:00:00' : ''));
  const end = new Date(range.endDate + (range.endDate.length <= 10 ? 'T23:59:59' : ''));

  // Inicializa buckets
  const buckets: Array<{ key: string; date: Date; total: number }> = [];
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  const fmtKey = (d: Date) => {
    if (granularity === 'year') return String(d.getFullYear());
    if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return d.toISOString().split('T')[0];
  };

  if (granularity === 'day') {
    const s0 = toDateOnly(start);
    const e0 = toDateOnly(end);
    for (let d = new Date(s0); d <= e0; d = addDays(d, 1)) {
      buckets.push({ key: fmtKey(d), date: new Date(d), total: 0 });
    }
  } else if (granularity === 'month') {
    const s = new Date(start.getFullYear(), start.getMonth(), 1);
    const e = new Date(end.getFullYear(), end.getMonth(), 1);
    for (let d = new Date(s); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      buckets.push({ key: fmtKey(d), date: new Date(d), total: 0 });
    }
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const d = new Date(y, 0, 1);
      buckets.push({ key: fmtKey(d), date: d, total: 0 });
    }
  }

  const idx = new Map(buckets.map((b, i) => [b.key, i] as const));
  (sales || []).forEach(s => {
    const d = new Date(s.createdAt);
    if (d < start || d > end) return;
    const key = fmtKey(d);
    const i = idx.get(key);
    if (i === undefined) return;
    buckets[i].total += s.total || 0;
  });

  return buckets;
}
