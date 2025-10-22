import { Setting, Sale, Customer, DEFAULT_ADMIN_PASSWORD } from '../../shared/types';
import { loadCustomers, updateCustomer, decideCustomerLevelForCustomer } from '../clientes/clientesService';

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

export async function loadSettings(): Promise<Configuracion> {
  try {
    const rows: Setting[] = (await (window as any).electronAPI?.getSettings?.()) || [];
    const map = new Map(rows.map((r) => [r.key, r.value] as const));
    const iva = map.has('tax_rate') ? Math.round(parseFloat(map.get('tax_rate') || '0') * 100) : DEFAULTS.iva;
    const moneda = map.get('currency') || DEFAULTS.moneda;
    const tema = (map.get('theme') as 'claro' | 'oscuro') || DEFAULTS.tema;
    let niveles: Record<string, number> = DEFAULTS.nivelesDescuento;
    const dl = map.get('discount_levels');
    if (dl) {
      try { niveles = JSON.parse(dl); } catch {}
    }
    return { iva, moneda, nivelesDescuento: niveles, tema };
  } catch {
    return DEFAULTS;
  }
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

// updateSettings guardando clave por clave usando updateSetting existente
export async function updateSettings(settings: Configuracion): Promise<void> {
  const { ok, errors } = validateSettings(settings);
  if (!ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = errors;
    throw err;
  }
  const api = (window as any).electronAPI;
  if (!api?.updateSetting) return; // stub: si no está, salimos silenciosamente

  // tax_rate como fracción (0.16)
  await api.updateSetting('tax_rate', String(settings.iva / 100));
  await api.updateSetting('currency', settings.moneda);
  await api.updateSetting('theme', settings.tema);
  await api.updateSetting('discount_levels', JSON.stringify(settings.nivelesDescuento || {}));
}

// ===== Reglas de negocio ampliadas =====

// Meta mensual
export async function setMonthlyGoal(amount: number): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api?.updateSetting) return;
  const v = Math.max(0, Number(amount) || 0);
  await api.updateSetting('monthly_goal', String(v));
}

export async function getMonthlyGoal(): Promise<number> {
  const rows: Setting[] = (await (window as any).electronAPI?.getSettings?.()) || [];
  const map = new Map(rows.map(r => [r.key, r.value] as const));
  const raw = map.get('monthly_goal');
  return raw ? Number(raw) || 0 : 0;
}

// Niveles de descuento por nivel (Bronze/Silver/Gold/Platinum)
export type DiscountLevels = { Bronze: number; Silver: number; Gold: number; Platinum: number };

export async function getDiscountLevels(): Promise<DiscountLevels> {
  // Persistimos en settings como 'discountLevels' para UI y guardamos también en 'discount_levels' para compatibilidad
  const rows: Setting[] = (await (window as any).electronAPI?.getSettings?.()) || [];
  const map = new Map(rows.map(r => [r.key, r.value] as const));
  const raw = map.get('discountLevels') || map.get('discount_levels');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        Bronze: Number(parsed.Bronze ?? 0),
        Silver: Number(parsed.Silver ?? 5),
        Gold: Number(parsed.Gold ?? 8),
        Platinum: Number(parsed.Platinum ?? 12),
      };
    } catch {}
  }
  return { Bronze: 0, Silver: 5, Gold: 10, Platinum: 15 };
}

export async function setDiscountLevels(levels: DiscountLevels): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api?.updateSetting) return;
  const clean: DiscountLevels = {
    Bronze: clamp0to100(levels.Bronze),
    Silver: clamp0to100(levels.Silver),
    Gold: clamp0to100(levels.Gold),
    Platinum: clamp0to100(levels.Platinum),
  };
  await api.updateSetting('discountLevels', JSON.stringify(clean));
  await api.updateSetting('discount_levels', JSON.stringify(clean));
  try { localStorage.setItem('discountLevels', JSON.stringify(clean)); } catch {}
}

function clamp0to100(n: number) { return Math.max(0, Math.min(100, Number(n) || 0)); }

export async function getDashboardPassword(): Promise<string> {
  try {
    const rows: Setting[] = (await (window as any).electronAPI?.getSettings?.()) || [];
    const map = new Map(rows.map(r => [r.key, r.value] as const));
    const stored = (map.get('dashboardPassword') || '').trim();
    if (stored) return stored;
  } catch {}
  try {
    const local = (localStorage.getItem('dashboardPassword') || '').trim();
    if (local) return local;
  } catch {}
  return DEFAULT_ADMIN_PASSWORD;
}

export async function setDashboardPassword(nextPassword: string): Promise<void> {
  const clean = (nextPassword || '').trim();
  if (!clean) {
    const err = new Error('PASSWORD_EMPTY');
    throw err;
  }
  const api = (window as any).electronAPI;
  if (api?.updateSetting) {
    await api.updateSetting('dashboardPassword', clean);
  }
  try { localStorage.setItem('dashboardPassword', clean); } catch {}
}

// Ventas del día
export async function getTodaySales(): Promise<Sale[]> {
  const all: Sale[] = (await (window as any).electronAPI?.getSales?.()) || [];
  const today = new Date().toDateString();
  return all.filter(s => new Date(s.createdAt).toDateString() === today);
}

export async function updateSale(id: number, patch: Partial<Sale>): Promise<Sale | null> {
  if (!(window as any).electronAPI?.updateSale) return null;
  return await (window as any).electronAPI.updateSale(id, patch);
}

export async function deleteSale(id: number): Promise<boolean> {
  if (!(window as any).electronAPI?.deleteSale) return false;
  return await (window as any).electronAPI.deleteSale(id);
}

// Actualizar niveles de clientes según total gastado histórico
export async function updateCustomerLevels(): Promise<{ updated: number; examined: number }>{
  const [customers, sales] = await Promise.all([
    loadCustomers(),
    (window as any).electronAPI?.getSales?.() || Promise.resolve([])
  ]);
  let updated = 0;
  await Promise.all(customers.map(async (c: Customer) => {
    try {
      const mapped = await decideCustomerLevelForCustomer(c, sales as Sale[]);
      if (c.discountLevel !== mapped) {
        await updateCustomer(c.id, { discountLevel: mapped });
        updated += 1;
      }
    } catch {}
  }));
  return { updated, examined: customers.length };
}

// mapCustomerTypeToDiscount: obsoleto tras reglas configurables

// ===== Ventas históricas por rango =====
export async function getAllSales(): Promise<Sale[]> {
  const api = (window as any).electronAPI;
  if (!api?.getSales) return [];
  return (await api.getSales()) as Sale[];
}

export async function getSalesByDay(date: string): Promise<Sale[]> {
  const start = new Date(date);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return getSalesByRangeISO(start, end);
}

export async function getSalesByWeek(weekStart: string): Promise<Sale[]> {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return getSalesByRangeISO(start, end);
}

export async function getSalesByMonth(month: string): Promise<Sale[]> {
  // month format: YYYY-MM
  const [y, m] = month.split('-').map(n => parseInt(n, 10));
  const start = new Date(y, (m - 1), 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return getSalesByRangeISO(start, end);
}

async function getSalesByRangeISO(start: Date, end: Date): Promise<Sale[]> {
  const api = (window as any).electronAPI;
  if (api?.getSalesByRange) {
    return (await api.getSalesByRange(start.toISOString(), end.toISOString())) as Sale[];
  }
  // Fallback: local filter
  const all: Sale[] = (await api?.getSales?.()) || [];
  return all.filter(s => {
    const d = new Date(s.createdAt);
    return d >= start && d <= end;
  });
}

// ===== Reseteo del sistema =====
export async function deleteAllSales(): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.deleteAllSales) return false;
  return await api.deleteAllSales();
}

export async function deleteAllCustomers(): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.deleteAllCustomers) return false;
  return await api.deleteAllCustomers();
}

// ===== Reglas de nivelación de clientes =====
export type CustomerLevelRules = {
  criteria: 'amount' | 'purchases';
  thresholds: { Bronze: number; Silver: number; Gold: number; Platinum: number };
  periodMonths?: number; // aplica solo para purchases
};

const DEFAULT_RULES: CustomerLevelRules = {
  criteria: 'amount',
  thresholds: { Bronze: 0, Silver: 15000, Gold: 50000, Platinum: 100000 },
};

export async function getCustomerLevelRules(): Promise<CustomerLevelRules> {
  try {
    const rows: Setting[] = (await (window as any).electronAPI?.getSettings?.()) || [];
    const map = new Map(rows.map(r => [r.key, r.value] as const));
    const raw = map.get('customerLevelRules');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validación mínima
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
    }
  } catch {}
  return DEFAULT_RULES;
}

export async function setCustomerLevelRules(rules: CustomerLevelRules): Promise<void> {
  const api = (window as any).electronAPI;
  if (!api?.updateSetting) return;
  const clean: CustomerLevelRules = {
    criteria: rules.criteria === 'purchases' ? 'purchases' : 'amount',
    thresholds: {
      Bronze: Math.max(0, Number(rules.thresholds?.Bronze ?? 0)),
      Silver: Math.max(0, Number(rules.thresholds?.Silver ?? 15000)),
      Gold: Math.max(0, Number(rules.thresholds?.Gold ?? 50000)),
      Platinum: Math.max(0, Number(rules.thresholds?.Platinum ?? 100000)),
    },
    periodMonths: rules.criteria === 'purchases' ? Math.max(1, Number(rules.periodMonths ?? 6)) : undefined,
  };
  await api.updateSetting('customerLevelRules', JSON.stringify(clean));
}
