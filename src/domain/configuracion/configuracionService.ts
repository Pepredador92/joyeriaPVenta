import { Setting, Sale, CustomerLevel, DEFAULT_ADMIN_PASSWORD } from '../../shared/types';

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

// Catálogo de niveles de clientes (configurable)
export type CustomerLevelDraft = {
  name: string;
  discountPercent: number;
  logicOp: 'AND' | 'OR';
  minAmount?: number | null;
  minOrders?: number | null;
  withinDays?: number | null;
  priority: number;
  active: boolean;
};

function sanitizeLevelDraft(
  draft: Partial<CustomerLevelDraft> & { name?: string },
  fallbackName?: string
): CustomerLevelDraft {
  const resolvedNameSource =
    draft.name !== undefined && draft.name !== null ? draft.name : fallbackName || '';
  const name = resolvedNameSource.toString().trim();
  const logicOp: 'AND' | 'OR' = draft.logicOp === 'OR' ? 'OR' : 'AND';
  const withinDays = draft.withinDays === null || draft.withinDays === undefined
    ? null
    : Math.max(1, Math.floor(Number(draft.withinDays) || 0));
  const minAmount = draft.minAmount === null || draft.minAmount === undefined
    ? null
    : Math.max(0, Number(draft.minAmount) || 0);
  const minOrders = draft.minOrders === null || draft.minOrders === undefined
    ? null
    : Math.max(0, Math.floor(Number(draft.minOrders) || 0));
  return {
    name: name || fallbackName || 'Nivel sin nombre',
    discountPercent: Math.max(0, Math.min(100, Number(draft.discountPercent ?? 0))),
    logicOp,
    minAmount,
    minOrders,
    withinDays,
    priority: Math.floor(Number(draft.priority ?? 0)),
    active: draft.active === false ? false : true,
  };
}

export async function getCustomerLevels(): Promise<CustomerLevel[]> {
  const api = (window as any).electronAPI;
  if (!api?.getCustomerLevels) return [];
  return (await api.getCustomerLevels()) as CustomerLevel[];
}

export async function createCustomerLevel(draft: CustomerLevelDraft): Promise<CustomerLevel> {
  const api = (window as any).electronAPI;
  if (!api?.createCustomerLevel) throw new Error('API_NOT_AVAILABLE');
  const payload = sanitizeLevelDraft(draft);
  return (await api.createCustomerLevel(payload)) as CustomerLevel;
}

export async function updateCustomerLevel(id: number, draft: Partial<CustomerLevelDraft>): Promise<CustomerLevel | null> {
  const api = (window as any).electronAPI;
  if (!api?.updateCustomerLevel) throw new Error('API_NOT_AVAILABLE');
  let fallbackName: string | undefined;
  if (draft.name === undefined) {
    try {
      const currentLevels = await getCustomerLevels();
      fallbackName = currentLevels?.find((level) => level.id === id)?.name;
    } catch {
      fallbackName = undefined;
    }
  }
  const payload = sanitizeLevelDraft({ ...draft }, fallbackName);
  return (await api.updateCustomerLevel(id, payload)) as CustomerLevel | null;
}

export async function deleteCustomerLevel(id: number): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.deleteCustomerLevel) return false;
  return await api.deleteCustomerLevel(id);
}

export async function recalculateCustomerLevels(): Promise<{ updated: number; examined: number }> {
  const api = (window as any).electronAPI;
  if (!api?.recalculateCustomerLevels) return { updated: 0, examined: 0 };
  return (await api.recalculateCustomerLevels()) as { updated: number; examined: number };
}

export function formatLevelCriteria(level: CustomerLevel): string {
  const parts: string[] = [];
  if (level.minAmount !== null && level.minAmount !== undefined) {
    parts.push(`$≥${Number(level.minAmount).toLocaleString('es-MX')}`);
  }
  if (level.minOrders !== null && level.minOrders !== undefined) {
    parts.push(`compras≥${level.minOrders}`);
  }
  if (level.withinDays) {
    parts.push(`${level.withinDays} días`);
  } else {
    parts.push('histórico');
  }
  const criteria = parts.length ? parts.join(', ') : 'sin criterios';
  return `${level.logicOp}, ${criteria}`;
}

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
  return recalculateCustomerLevels();
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

