import { Setting, Sale, Customer } from '../../shared/types';

export type Configuracion = {
  iva: number; // 0..100 (porcentaje)
  moneda: string; // MXN, USD, etc.
  nivelesDescuento: Record<string, number>; // ej: { VIP: 12, Mayorista: 8, Particular: 0 }
  tema: 'claro' | 'oscuro';
};

const DEFAULTS: Configuracion = {
  iva: 16,
  moneda: 'MXN',
  nivelesDescuento: { VIP: 12, Mayorista: 8, Particular: 0 },
  tema: 'claro',
};

export function getDefaultSettings(): Configuracion {
  return { ...DEFAULTS, nivelesDescuento: { ...DEFAULTS.nivelesDescuento } };
}

export function parseSettingsRows(rows: Setting[]): Configuracion {
  const defaults = getDefaultSettings();
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  const iva = map.has('tax_rate') ? Math.round(parseFloat(map.get('tax_rate') || '0') * 100) : defaults.iva;
  const moneda = map.get('currency') || defaults.moneda;
  const tema = (map.get('theme') as 'claro' | 'oscuro') || defaults.tema;
  let niveles: Record<string, number> = defaults.nivelesDescuento;
  const dl = map.get('discount_levels');
  if (dl) {
    try { niveles = JSON.parse(dl); } catch {}
  }
  return { iva, moneda, nivelesDescuento: niveles, tema };
}

export function validateSettings(s: Configuracion): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!Number.isFinite(s.iva) || s.iva < 0) errors.iva = 'IVA inválido';
  if (!s.moneda || !s.moneda.trim()) errors.moneda = 'Moneda requerida';
  for (const [k, v] of Object.entries(s.nivelesDescuento || {})) {
    if (!Number.isFinite(v) || v < 0 || v > 100) errors[`nivelesDescuento.${k}`] = 'Descuento inválido (0-100)';
  }
  if (s.tema !== 'claro' && s.tema !== 'oscuro') errors.tema = 'Tema inválido';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function parseMonthlyGoal(raw: string | null | undefined): number {
  return raw ? Number(raw) || 0 : 0;
}

// Niveles de descuento por nivel (Bronze/Silver/Gold/Platinum)
export type DiscountLevels = { Bronze: number; Silver: number; Gold: number; Platinum: number };

export type CustomerLevelRules = {
  criteria: 'amount' | 'purchases';
  thresholds: { Bronze: number; Silver: number; Gold: number; Platinum: number };
  periodMonths?: number; // aplica solo para purchases
};

const DEFAULT_RULES: CustomerLevelRules = {
  criteria: 'amount',
  thresholds: { Bronze: 0, Silver: 15000, Gold: 50000, Platinum: 100000 },
};

export function getDefaultDiscountLevels(): DiscountLevels {
  return { Bronze: 0, Silver: 5, Gold: 10, Platinum: 15 };
}

export function normalizeDiscountLevels(levels: DiscountLevels): DiscountLevels {
  return {
    Bronze: clamp0to100(levels.Bronze),
    Silver: clamp0to100(levels.Silver),
    Gold: clamp0to100(levels.Gold),
    Platinum: clamp0to100(levels.Platinum),
  };
}

export function parseDiscountLevels(raw: string | null | undefined): DiscountLevels | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      Bronze: Number(parsed.Bronze ?? 0),
      Silver: Number(parsed.Silver ?? 5),
      Gold: Number(parsed.Gold ?? 8),
      Platinum: Number(parsed.Platinum ?? 12),
    };
  } catch {
    return null;
  }
}

function clamp0to100(n: number) { return Math.max(0, Math.min(100, Number(n) || 0)); }

export function parseDashboardPassword(raw: string | null | undefined): string | null {
  const clean = (raw || '').trim();
  return clean ? clean : null;
}

export function getDefaultCustomerLevelRules(): CustomerLevelRules {
  return { ...DEFAULT_RULES, thresholds: { ...DEFAULT_RULES.thresholds } };
}

export function parseCustomerLevelRules(raw: string | null | undefined): CustomerLevelRules {
  if (!raw) return getDefaultCustomerLevelRules();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.criteria === 'amount' || parsed.criteria === 'purchases') && parsed.thresholds) {
      const th = parsed.thresholds;
      return {
        criteria: parsed.criteria,
        thresholds: {
          Bronze: Number(th.Bronze ?? 0),
          Silver: Number(th.Silver ?? 15000),
          Gold: Number(th.Gold ?? 50000),
          Platinum: Number(th.Platinum ?? 100000),
        },
        periodMonths: parsed.criteria === 'purchases' ? Math.max(1, Number(parsed.periodMonths ?? 6)) : undefined,
      };
    }
  } catch {}
  return getDefaultCustomerLevelRules();
}

export async function getCustomerLevelRules(): Promise<CustomerLevelRules> {
  return getDefaultCustomerLevelRules();
}

export function normalizeCustomerLevelRules(rules: CustomerLevelRules): CustomerLevelRules {
  return {
    criteria: rules.criteria === 'purchases' ? 'purchases' : 'amount',
    thresholds: {
      Bronze: Math.max(0, Number(rules.thresholds?.Bronze ?? 0)),
      Silver: Math.max(0, Number(rules.thresholds?.Silver ?? 15000)),
      Gold: Math.max(0, Number(rules.thresholds?.Gold ?? 50000)),
      Platinum: Math.max(0, Number(rules.thresholds?.Platinum ?? 100000)),
    },
    periodMonths: rules.criteria === 'purchases' ? Math.max(1, Number(rules.periodMonths ?? 6)) : undefined,
  };
}

export function computeCustomerDiscountLevel(
  customer: Customer,
  allSales: Sale[],
  rules: CustomerLevelRules,
  now: Date
): Customer['discountLevel'] {
  if (rules.criteria === 'amount') {
    const total = allSales.filter(s => s.customerId === customer.id).reduce((sum, s) => sum + (s.total || 0), 0);
    return pickLevelByThreshold(total, rules.thresholds);
  }
  const months = Math.max(1, rules.periodMonths ?? 6);
  const end = new Date(now);
  const start = new Date(now);
  start.setMonth(start.getMonth() - months);
  const count = allSales.filter(s => s.customerId === customer.id).filter(s => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  }).length;
  return pickLevelByThreshold(count, rules.thresholds);
}

function pickLevelByThreshold(value: number, thresholds: Record<string, number>): Customer['discountLevel'] {
  if (value >= (thresholds.Platinum ?? 100000)) return 'Platinum';
  if (value >= (thresholds.Gold ?? 50000)) return 'Gold';
  if (value >= (thresholds.Silver ?? 15000)) return 'Silver';
  return 'Bronze';
}

export function getSalesRangeForDay(date: string): { start: Date; end: Date } {
  const start = new Date(date);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getSalesRangeForWeek(weekStart: string): { start: Date; end: Date } {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getSalesRangeForMonth(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(n => parseInt(n, 10));
  const start = new Date(y, (m - 1), 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end };
}

export function filterSalesByRange(sales: Sale[], start: Date, end: Date): Sale[] {
  return sales.filter(s => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  });
}
