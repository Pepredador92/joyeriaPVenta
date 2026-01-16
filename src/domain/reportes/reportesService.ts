// Dominio de Reportes: funciones puras sobre colecciones ya cargadas (sin Electron)

export type SaleItem = {
  productId?: number;
  quantity?: number;
  subtotal?: number; // sin impuestos
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
export type RangeKind = 'hoy' | '7d' | '30d' | 'mes' | 'custom';

const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function getRangeForKind(
  rangeKind: RangeKind,
  customStart: string,
  customEnd: string,
  now = new Date()
): { start: Date; end: Date } {
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
  const floorDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
  const today = floorDate(now);
  switch (rangeKind) {
    case 'hoy':
      return { start: today, end: addDays(today, 1) };
    case '7d':
      return { start: addDays(today, -6), end: addDays(today, 1) };
    case '30d':
      return { start: addDays(today, -29), end: addDays(today, 1) };
    case 'mes':
      return { start: startOfMonth(today), end: addDays(today, 1) };
    case 'custom': {
      const s = new Date(customStart + 'T00:00:00');
      const e = addDays(new Date(customEnd + 'T00:00:00'), 1);
      return { start: s, end: e };
    }
    default:
      return { start: today, end: addDays(today, 1) };
  }
}

export function filterSalesByRange(sales: Sale[], start: Date, end: Date): Sale[] {
  return (sales || []).filter((s) => {
    const d = new Date(s.createdAt);
    return d >= start && d < end;
  });
}

export function buildKpis(sales: Sale[]): { total: number; count: number; avg: number; byMethod: Record<string, number> } {
  const total = (sales || []).reduce((sum, s) => sum + (s.total || 0), 0);
  const count = (sales || []).length;
  const avg = count ? total / count : 0;
  const byMethod: Record<string, number> = {};
  (sales || []).forEach((s) => {
    const m = s.paymentMethod || 'Otro';
    byMethod[m] = (byMethod[m] || 0) + (s.total || 0);
  });
  return { total, count, avg, byMethod };
}

export function buildDailySeries(
  sales: Sale[],
  start: Date,
  end: Date,
  maxDays = 30
): Array<{ date: Date; total: number }> {
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
  const days = Math.min(maxDays, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const series: { date: Date; total: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d0 = addDays(start, i);
    const d1 = addDays(start, i + 1);
    const t = (sales || []).reduce((sum: number, s: Sale) => {
      const d = new Date(s.createdAt);
      return (d >= d0 && d < d1) ? sum + (s.total || 0) : sum;
    }, 0);
    series.push({ date: d0, total: t });
  }
  return series;
}

export function getTopCategorias(
  sales: Sale[],
  products: Product[],
  limit = 5
): Array<[string, number]> {
  const map = new Map<string, number>();
  (sales || []).forEach((s) => {
    (s.items || []).forEach((it: any) => {
      let cat = 'Otros';
      if (it.productId && it.productId !== 0) {
        const p = products.find((pr) => pr.id === it.productId);
        cat = p?.category || 'Otros';
      } else if ((s as any).notes && typeof (s as any).notes === 'string') {
        const m = (s as any).notes.match(/Categoría:\s*([^|]+)/i);
        if (m) cat = m[1].trim();
      }
      map.set(cat, (map.get(cat) || 0) + (it.subtotal || 0));
    });
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function getLowStock(products: Product[], maxItems = 6): Product[] {
  return (products || [])
    .filter((p: any) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 10)
    .sort((a: any, b: any) => a.stock - b.stock)
    .slice(0, maxItems);
}

export function getTopClientes(
  sales: Sale[],
  customers: Customer[],
  limit = 5
): Array<{ customer: Customer; total: number }> {
  const byCustomer = new Map<number, { customer: Customer; total: number }>();
  (sales || []).forEach((s) => {
    const id = s.customerId ?? undefined;
    if (!id) return;
    const c = customers.find((cc) => cc.id === id);
    if (!c) return;
    const cur = byCustomer.get(id) || { customer: c, total: 0 };
    cur.total += s.total || 0;
    byCustomer.set(id, cur);
  });
  return Array.from(byCustomer.values()).sort((a, b) => b.total - a.total).slice(0, limit);
}

export function getNewVsReturning(
  sales: Sale[],
  filteredSales: Sale[],
  start: Date
): { nuevos: number; recurrentes: number } {
  let nuevos = 0, recurrentes = 0;
  const startTs = start.getTime();
  const salesByCustomer = new Map<number, number[]>();
  (sales || []).forEach((s) => {
    if (s.customerId) {
      const arr = salesByCustomer.get(s.customerId) || [];
      arr.push(new Date(s.createdAt).getTime());
      salesByCustomer.set(s.customerId, arr);
    }
  });
  const idsInRange = new Set<number>();
  (filteredSales || []).forEach((s) => { if (s.customerId) idsInRange.add(s.customerId); });
  idsInRange.forEach((id) => {
    const arr = (salesByCustomer.get(id) || []).filter(ts => ts < startTs);
    if (arr.length === 0) nuevos++; else recurrentes++;
  });
  return { nuevos, recurrentes };
}

export function getOpenSession<T extends { status?: string }>(sessions: T[]): T | null {
  return (sessions || []).find((s) => s.status === 'Abierta') || null;
}

export function getRecentSales(sales: Sale[], limit = 10): Sale[] {
  return [...(sales || [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

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
