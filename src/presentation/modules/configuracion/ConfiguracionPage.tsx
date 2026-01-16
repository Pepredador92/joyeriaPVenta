import React, { useEffect, useMemo, useState } from 'react';
import {
  Configuracion,
  validateSettings as validateSettingsSvc,
  getDefaultSettings,
  parseSettingsRows,
  parseMonthlyGoal,
  DiscountLevels,
  CustomerLevelRules,
  getDefaultDiscountLevels,
  parseDiscountLevels,
  normalizeDiscountLevels,
  parseDashboardPassword,
  getDefaultCustomerLevelRules,
  parseCustomerLevelRules,
  normalizeCustomerLevelRules,
  computeCustomerDiscountLevel,
  getSalesRangeForDay,
  getSalesRangeForWeek,
  getSalesRangeForMonth,
  filterSalesByRange,
} from '../../../domain/configuracion/configuracionService';
import { Sale, DEFAULT_ADMIN_PASSWORD, MASTER_ADMIN_PASSWORD } from '../../../shared/types';

export const ConfiguracionPage: React.FC = () => {
  // Navegación por secciones
  const [tab, setTab] = useState<'generales' | 'dashboard' | 'clientes' | 'ventas' | 'descuentos' | 'historicas' | 'admin'>('generales');

  // Estado: Generales
  const [form, setForm] = useState<Configuracion>({ iva: 16, moneda: 'MXN', nivelesDescuento: { VIP: 12, Mayorista: 8, Particular: 0 }, tema: 'claro' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado: Dashboard
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [savingGoal, setSavingGoal] = useState(false);

  // Estado: Descuentos por nivel
  const [disc, setDisc] = useState<{ Bronze: number; Silver: number; Gold: number; Platinum: number }>({ Bronze: 0, Silver: 5, Gold: 8, Platinum: 12 });
  const [savingDisc, setSavingDisc] = useState(false);

  // Estado: Ventas del día
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Estado: Ventas históricas
  const [histMode, setHistMode] = useState<'dia' | 'semana' | 'mes' | 'todas'>('todas');
  const [histDay, setHistDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [histWeekStart, setHistWeekStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [histMonth, setHistMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historicSales, setHistoricSales] = useState<Sale[]>([]);
  const [loadingHistoric, setLoadingHistoric] = useState(false);

  // Estado: Clientes (acciones masivas)
  const [updatingLevels, setUpdatingLevels] = useState(false);
  const [levelsResult, setLevelsResult] = useState<{ updated: number; examined: number } | null>(null);
  const [rules, setRules] = useState<{ criteria: 'amount' | 'purchases'; thresholds: { Bronze: number; Silver: number; Gold: number; Platinum: number }; periodMonths?: number }>({ criteria: 'amount', thresholds: { Bronze: 0, Silver: 15000, Gold: 50000, Platinum: 100000 } });
  const [savingRules, setSavingRules] = useState(false);
  const [levelWizardStep, setLevelWizardStep] = useState<1 | 2 | 3>(1);
  const [levelDraft, setLevelDraft] = useState({
    name: '',
    discount: 10,
    ruleType: 'amount' as 'amount' | 'purchases',
    minSpend: 0,
    minPurchases: 0,
    periodDays: 180,
  });
  const [levelTouched, setLevelTouched] = useState({
    name: false,
    discount: false,
    minSpend: false,
    minPurchases: false,
    periodDays: false,
  });

  // Toast general
  const [toast, setToast] = useState<string | null>(null);
  const [resolvedAdminPassword, setResolvedAdminPassword] = useState<string>(DEFAULT_ADMIN_PASSWORD);
  const [hasCustomAdminPassword, setHasCustomAdminPassword] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const api = (window as any).electronAPI;
      const rows = api?.getSettings ? await api.getSettings() : [];
      const settings = rows?.length ? parseSettingsRows(rows) : getDefaultSettings();
      setForm(settings);
      const map = new Map((rows || []).map((r: any) => [r.key, r.value] as const));
      setMonthlyGoal(parseMonthlyGoal(map.get('monthly_goal')));
      const rawDiscounts = map.get('discountLevels') || map.get('discount_levels');
      setDisc(parseDiscountLevels(rawDiscounts) || getDefaultDiscountLevels());
      setRules(parseCustomerLevelRules(map.get('customerLevelRules')));
      const fromSettings = parseDashboardPassword(map.get('dashboardPassword'));
      let fromLocal: string | null = null;
      try { fromLocal = parseDashboardPassword(localStorage.getItem('dashboardPassword')); } catch {}
      const adminPwd = fromSettings || fromLocal || DEFAULT_ADMIN_PASSWORD;
      setResolvedAdminPassword(adminPwd);
      setHasCustomAdminPassword((adminPwd || '').trim() !== DEFAULT_ADMIN_PASSWORD);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const loadDiscountLevelsFromSettings = async (): Promise<DiscountLevels> => {
    const api = (window as any).electronAPI;
    if (!api?.getSettings) return getDefaultDiscountLevels();
    const rows = await api.getSettings();
    const map = new Map((rows || []).map((r: any) => [r.key, r.value] as const));
    const raw = map.get('discountLevels') || map.get('discount_levels');
    return parseDiscountLevels(raw) || getDefaultDiscountLevels();
  };

  const loadCustomerLevelRulesFromSettings = async (): Promise<CustomerLevelRules> => {
    const api = (window as any).electronAPI;
    if (!api?.getSettings) return getDefaultCustomerLevelRules();
    const rows = await api.getSettings();
    const map = new Map((rows || []).map((r: any) => [r.key, r.value] as const));
    return parseCustomerLevelRules(map.get('customerLevelRules'));
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateSettingsSvc(form);
    setErrors(v.errors);
    if (!v.ok) return;
    setSaving(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.updateSetting) {
        alert('IPC no disponible');
        return;
      }
      await api.updateSetting('tax_rate', String(form.iva / 100));
      await api.updateSetting('currency', form.moneda);
      await api.updateSetting('theme', form.tema);
      await api.updateSetting('discount_levels', JSON.stringify(form.nivelesDescuento || {}));
      setToast('Cambios guardados');
      setTimeout(() => setToast(null), 1500);
      // sincroniza modo nocturno en localStorage para UI si aplica
      try {
        const sysStr = localStorage.getItem('systemSettings');
        const sys = sysStr ? JSON.parse(sysStr) : {};
        sys.nightMode = form.tema === 'oscuro';
        localStorage.setItem('systemSettings', JSON.stringify(sys));
      } catch {}
    } catch (err: any) {
      if (err?.message === 'VALIDATION_ERROR') setErrors(err.fields || {});
      else alert('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const currency = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);

  const reloadTodaySales = async () => {
    setLoadingSales(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.getSales) {
        setTodaySales([]);
        return;
      }
      const all: Sale[] = (await api.getSales()) || [];
      const today = new Date().toDateString();
      setTodaySales(all.filter(s => new Date(s.createdAt).toDateString() === today));
    } finally { setLoadingSales(false); }
  };

  const onSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.updateSetting) {
        alert('IPC no disponible');
        return;
      }
      const v = Math.max(0, Number(monthlyGoal) || 0);
      await api.updateSetting('monthly_goal', String(v));
      setToast('Meta mensual guardada');
      setTimeout(() => setToast(null), 1200);
    }
    finally { setSavingGoal(false); }
  };

  const onSaveDiscounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDisc(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.updateSetting) {
        alert('IPC no disponible');
        return;
      }
      const clean = normalizeDiscountLevels(disc);
      await api.updateSetting('discountLevels', JSON.stringify(clean));
      await api.updateSetting('discount_levels', JSON.stringify(clean));
      try { localStorage.setItem('discountLevels', JSON.stringify(clean)); } catch {}
      setDisc(clean);
      setToast('Descuentos guardados');
      setTimeout(() => setToast(null), 1200);
    }
    finally { setSavingDisc(false); }
  };

  const onUpdateCustomerLevels = async () => {
    setUpdatingLevels(true); setLevelsResult(null);
    try {
      const api = (window as any).electronAPI;
      if (!api?.getCustomers || !api?.getSales || !api?.updateCustomer) {
        alert('IPC no disponible');
        return;
      }
      const [customers, sales] = await Promise.all([
        api.getCustomers(),
        api.getSales()
      ]);
      let updated = 0;
      const now = new Date();
      await Promise.all((customers || []).map(async (c: any) => {
        try {
          const mapped = computeCustomerDiscountLevel(c, sales || [], rules, now);
          if (c.discountLevel !== mapped) {
            await api.updateCustomer(c.id, { discountLevel: mapped });
            updated += 1;
          }
        } catch {}
      }));
      const examined = (customers || []).length;
      const res = { updated, examined };
      setLevelsResult(res);
      setToast(`Niveles actualizados: ${res.updated}/${res.examined}`);
      setTimeout(() => setToast(null), 1500);
    } finally { setUpdatingLevels(false); }
  };

  const onEditSaleStatus = async (s: Sale, nextStatus: Sale['status']) => {
    const api = (window as any).electronAPI;
    if (!api?.updateSale) {
      alert('IPC no disponible');
      return;
    }
    const res = await api.updateSale(s.id, { status: nextStatus });
    if (res) {
      setToast('Venta actualizada'); setTimeout(() => setToast(null), 1000);
      reloadTodaySales();
    }
  };

  const reloadHistoric = async () => {
    setLoadingHistoric(true);
    try {
      let data: Sale[] = [];
      const api = (window as any).electronAPI;
      if (!api?.getSales) {
        setHistoricSales([]);
        return;
      }
      if (histMode === 'todas') {
        data = await api.getSales();
      } else {
        let range;
        if (histMode === 'dia') range = getSalesRangeForDay(histDay);
        else if (histMode === 'semana') range = getSalesRangeForWeek(histWeekStart);
        else range = getSalesRangeForMonth(histMonth);
        if (api.getSalesByRange) {
          data = await api.getSalesByRange(range.start.toISOString(), range.end.toISOString());
        } else {
          const all = await api.getSales();
          data = filterSalesByRange(all || [], range.start, range.end);
        }
      }
      setHistoricSales(data);
    } finally { setLoadingHistoric(false); }
  };

  useEffect(() => { if (tab === 'historicas') reloadHistoric(); }, [tab]);
  useEffect(() => { if (tab === 'historicas') reloadHistoric(); }, [histMode, histDay, histWeekStart, histMonth]);

  const onDeleteSale = async (s: Sale) => {
    if (!confirm(`¿Eliminar venta #${s.id}?`)) return;
    const api = (window as any).electronAPI;
    if (!api?.deleteSale) {
      alert('IPC no disponible');
      return;
    }
    const ok = await api.deleteSale(s.id);
    if (ok) { setToast('Venta eliminada'); setTimeout(() => setToast(null), 1000); reloadTodaySales(); }
  };

  const onChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFormError(null);
    const current = pwdCurrent.trim();
    const next = pwdNext.trim();
    const confirmValue = pwdConfirm.trim();
    if (!current) {
      setPasswordFormError('Ingresa la contraseña actual o la maestra.');
      return;
    }
    if (!(current === resolvedAdminPassword || current === MASTER_ADMIN_PASSWORD)) {
      setPasswordFormError('La contraseña actual no es válida.');
      return;
    }
    if (!next) {
      setPasswordFormError('La nueva contraseña no puede estar vacía.');
      return;
    }
    if (next.length < 4) {
      setPasswordFormError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (next !== confirmValue) {
      setPasswordFormError('La confirmación no coincide.');
      return;
    }
    if (next === resolvedAdminPassword) {
      setPasswordFormError('La nueva contraseña es igual a la actual.');
      return;
    }
    setSavingAdminPassword(true);
    try {
      const api = (window as any).electronAPI;
      if (!api?.updateSetting) {
        alert('IPC no disponible');
        return;
      }
      const clean = next.trim();
      await api.updateSetting('dashboardPassword', clean);
      try { localStorage.setItem('dashboardPassword', clean); } catch {}
      setResolvedAdminPassword(next);
      setHasCustomAdminPassword(next !== DEFAULT_ADMIN_PASSWORD);
      setPwdCurrent('');
      setPwdNext('');
      setPwdConfirm('');
      setToast('Contraseña actualizada');
      setTimeout(() => setToast(null), 1500);
    } catch (err: any) {
      if (err?.message === 'PASSWORD_EMPTY') setPasswordFormError('La nueva contraseña no puede estar vacía.');
      else setPasswordFormError('No se pudo actualizar la contraseña.');
    } finally {
      setSavingAdminPassword(false);
    }
  };

  const levelKeyFromName = (rawName: string) => {
    const key = rawName.trim().toLowerCase();
    const map: Record<string, 'Bronze' | 'Silver' | 'Gold' | 'Platinum'> = {
      bronce: 'Bronze',
      bronze: 'Bronze',
      plata: 'Silver',
      silver: 'Silver',
      oro: 'Gold',
      gold: 'Gold',
      platino: 'Platinum',
      platinum: 'Platinum',
      vip: 'Platinum',
    };
    return map[key] || null;
  };
  const levelErrors = {
    name: !levelDraft.name.trim()
      ? 'Escribe un nombre para identificar el nivel.'
      : levelKeyFromName(levelDraft.name)
        ? ''
        : 'Usa Bronce, Plata, Oro o VIP para mantener compatibilidad.',
    discount: Number.isFinite(levelDraft.discount) && levelDraft.discount >= 0 && levelDraft.discount <= 100
      ? ''
      : 'El descuento debe estar entre 0 y 100.',
    minSpend: levelDraft.minSpend >= 0 ? '' : 'El gasto mínimo no puede ser negativo.',
    minPurchases: levelDraft.minPurchases >= 0 ? '' : 'El número de compras no puede ser negativo.',
    periodDays: levelDraft.periodDays >= 1 ? '' : 'El periodo debe ser de al menos 1 día.',
  };
  const step1Valid = !levelErrors.name && !levelErrors.discount;
  const step2Valid = levelDraft.ruleType === 'amount'
    ? !levelErrors.minSpend && !levelErrors.periodDays
    : !levelErrors.minPurchases && !levelErrors.periodDays;
  const canGoNext = (levelWizardStep === 1 && step1Valid) || (levelWizardStep === 2 && step2Valid);
  const canSaveLevel = step1Valid && step2Valid;
  const summaryCondition = levelDraft.ruleType === 'amount'
    ? `gasta al menos ${currency.format(levelDraft.minSpend)}`
    : `compra al menos ${levelDraft.minPurchases} veces`;
  const resetLevelWizard = () => {
    setLevelWizardStep(1);
    setLevelDraft({
      name: '',
      discount: 10,
      ruleType: 'amount',
      minSpend: 0,
      minPurchases: 0,
      periodDays: 180,
    });
    setLevelTouched({
      name: false,
      discount: false,
      minSpend: false,
      minPurchases: false,
      periodDays: false,
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>⚙️ Configuración</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'generales', label: 'Generales' },
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'clientes', label: 'Clientes' },
          { key: 'ventas', label: 'Ventas del día' },
          { key: 'historicas', label: 'Ventas históricas' },
          { key: 'descuentos', label: 'Descuentos por nivel' },
          { key: 'admin', label: '⚠️ Administración avanzada' },
        ].map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key as any)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ccc', background: tab === t.key ? '#111' : '#fff', color: tab === t.key ? '#fff' : '#111' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>Cargando…</div>
      ) : (
        <>
          {tab === 'generales' && (
            <form onSubmit={onSave} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, maxWidth: 720 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label>IVA (%)</label>
              <input
                type="number"
                min={0}
                value={form.iva}
                onChange={(e) => setForm({ ...form, iva: Math.max(0, Number(e.target.value) || 0) })}
                style={{ width: '100%' }}
              />
              {errors.iva && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.iva}</div>}
            </div>

            <div>
              <label>Moneda</label>
              <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} style={{ width: '100%' }}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
              {errors.moneda && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.moneda}</div>}
            </div>

            {/* Los descuentos por nivel ahora viven en su propia pestaña */}

            <div>
              <label>Tema</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name="tema" checked={form.tema === 'claro'} onChange={() => setForm({ ...form, tema: 'claro' })} /> Claro
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="radio" name="tema" checked={form.tema === 'oscuro'} onChange={() => setForm({ ...form, tema: 'oscuro' })} /> Oscuro
                </label>
              </div>
              {errors.tema && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.tema}</div>}
            </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                <button type="button" onClick={load} disabled={saving}>Restaurar</button>
              </div>
            </form>
          )}

          {tab === 'dashboard' && (
            <form onSubmit={onSaveGoal} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, maxWidth: 520 }}>
              <h3>Meta mensual</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="number" min={0} value={monthlyGoal}
                  onChange={(e) => setMonthlyGoal(Math.max(0, Number(e.target.value) || 0))} />
                <button type="submit" disabled={savingGoal}>{savingGoal ? 'Guardando…' : 'Guardar'}</button>
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>Actual: {currency.format(monthlyGoal)}</div>
            </form>
          )}

          {tab === 'clientes' && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, maxWidth: 720 }}>
              <h3 style={{ marginTop: 0 }}>Crear nuevo nivel</h3>
              <p style={{ marginTop: 6, color: '#666' }}>Configura un nivel paso a paso. Usa frases simples y ejemplos para evitar confusiones.</p>
              <details style={{ marginTop: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '10px 12px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Cómo funciona?</summary>
                <ul style={{ margin: '8px 0 0 18px', color: '#555' }}>
                  <li>El sistema revisa el historial del cliente.</li>
                  <li>Se toma en cuenta el periodo de evaluación.</li>
                  <li>Si cumple la regla, se asigna el nivel.</li>
                  <li>Si cumple varios niveles, se usa la prioridad.</li>
                </ul>
              </details>

              <div style={{ marginTop: 16, padding: 14, border: '1px solid #e6e9ef', borderRadius: 10, background: '#fbfcff' }}>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  Paso {levelWizardStep}/3 · {levelWizardStep === 1 ? 'Nombre y descuento' : levelWizardStep === 2 ? 'Cuándo aplica el nivel' : 'Prioridad y resumen'}
                </div>

                {levelWizardStep === 1 && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <label>Nombre del nivel</label>
                      <input
                        type="text"
                        placeholder="Ej: Bronce, Plata, Oro o VIP"
                        value={levelDraft.name}
                        onChange={(e) => {
                          setLevelDraft({ ...levelDraft, name: e.target.value });
                          setLevelTouched((prev) => ({ ...prev, name: true }));
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#667085' }}>Usa Bronce, Plata, Oro o VIP para mantener compatibilidad.</div>
                      {levelTouched.name && levelErrors.name && <div style={{ fontSize: 12, color: '#d32f2f' }}>{levelErrors.name}</div>}
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <label>Descuento (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={levelDraft.discount}
                        onChange={(e) => {
                          setLevelDraft({ ...levelDraft, discount: Number(e.target.value) });
                          setLevelTouched((prev) => ({ ...prev, discount: true }));
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#667085' }}>Ejemplo: 10% significa que pagará 10% menos.</div>
                      {levelTouched.discount && levelErrors.discount && <div style={{ fontSize: 12, color: '#d32f2f' }}>{levelErrors.discount}</div>}
                    </div>
                  </div>
                )}

                {levelWizardStep === 2 && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <label>Regla principal</label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="radio"
                            name="ruleType"
                            checked={levelDraft.ruleType === 'amount'}
                            onChange={() => setLevelDraft({ ...levelDraft, ruleType: 'amount' })}
                          />
                          Por gasto
                        </label>
                        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="radio"
                            name="ruleType"
                            checked={levelDraft.ruleType === 'purchases'}
                            onChange={() => setLevelDraft({ ...levelDraft, ruleType: 'purchases' })}
                          />
                          Por número de compras
                        </label>
                      </div>
                    </div>

                    {levelDraft.ruleType === 'amount' ? (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <label>Gasto mínimo</label>
                        <input
                          type="number"
                          min={0}
                          value={levelDraft.minSpend}
                          onChange={(e) => {
                            setLevelDraft({ ...levelDraft, minSpend: Number(e.target.value) });
                            setLevelTouched((prev) => ({ ...prev, minSpend: true }));
                          }}
                        />
                        <div style={{ fontSize: 12, color: '#667085' }}>Si el cliente gasta al menos $X (en el periodo), entra a este nivel.</div>
                        {levelTouched.minSpend && levelErrors.minSpend && <div style={{ fontSize: 12, color: '#d32f2f' }}>{levelErrors.minSpend}</div>}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <label>Número mínimo de compras</label>
                        <input
                          type="number"
                          min={0}
                          value={levelDraft.minPurchases}
                          onChange={(e) => {
                            setLevelDraft({ ...levelDraft, minPurchases: Number(e.target.value) });
                            setLevelTouched((prev) => ({ ...prev, minPurchases: true }));
                          }}
                        />
                        <div style={{ fontSize: 12, color: '#667085' }}>Si compra al menos N veces (en el periodo), entra a este nivel.</div>
                        {levelTouched.minPurchases && levelErrors.minPurchases && <div style={{ fontSize: 12, color: '#d32f2f' }}>{levelErrors.minPurchases}</div>}
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 6 }}>
                      <label>Periodo de evaluación (días)</label>
                      <input
                        type="number"
                        min={1}
                        value={levelDraft.periodDays}
                        onChange={(e) => {
                          setLevelDraft({ ...levelDraft, periodDays: Number(e.target.value) });
                          setLevelTouched((prev) => ({ ...prev, periodDays: true }));
                        }}
                      />
                      <div style={{ fontSize: 12, color: '#667085' }}>Contamos compras/gasto solo dentro de los últimos X días.</div>
                      {levelTouched.periodDays && levelErrors.periodDays && <div style={{ fontSize: 12, color: '#d32f2f' }}>{levelErrors.periodDays}</div>}
                    </div>
                  </div>
                )}

                {levelWizardStep === 3 && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 8, border: '1px solid #e6e9ef', background: '#f9fafb' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Prioridad</div>
                      <div style={{ color: '#555', fontSize: 13 }}>
                        Si un cliente cumple varios niveles, se asigna el más alto. (Este comportamiento es automático y no se cambia aquí.)
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, border: '1px solid #e6e9ef', background: '#fff' }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Resumen</div>
                      <div style={{ color: '#444' }}>
                        El nivel <strong>{levelDraft.name || '—'}</strong> da <strong>{levelDraft.discount || 0}%</strong> y aplica cuando {summaryCondition}
                        {' '}en los últimos <strong>{Math.max(1, levelDraft.periodDays)} días</strong>.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setLevelWizardStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : prev))}
                    disabled={levelWizardStep === 1}
                  >
                    Atrás
                  </button>
                  {levelWizardStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (levelWizardStep === 1) {
                          setLevelTouched((prev) => ({ ...prev, name: true, discount: true }));
                        }
                        if (levelWizardStep === 2) {
                          setLevelTouched((prev) => ({ ...prev, minSpend: true, minPurchases: true, periodDays: true }));
                        }
                        if (canGoNext) {
                          setLevelWizardStep((prev) => ((prev + 1) as 1 | 2 | 3));
                        }
                      }}
                      disabled={!canGoNext}
                    >
                      Siguiente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLevelTouched((prev) => ({ ...prev, name: true, discount: true, minSpend: true, minPurchases: true, periodDays: true }));
                        if (!canSaveLevel) return;
                        const levelKey = levelKeyFromName(levelDraft.name);
                        if (!levelKey) {
                          setToast('Usa Bronce, Plata, Oro o VIP para guardar este nivel.');
                          setTimeout(() => setToast(null), 1400);
                          return;
                        }
                        const persistLevel = async () => {
                          const api = (window as any).electronAPI;
                          if (!api?.updateSetting) {
                            setToast('IPC no disponible');
                            setTimeout(() => setToast(null), 1400);
                            return;
                          }
                          let currentLevels: Record<string, number> = {};
                          if (api?.getSettings) {
                            try {
                              const rows = await api.getSettings();
                              const map = new Map((rows || []).map((r: any) => [r.key, r.value] as const));
                              const raw = map.get('discountLevels') || map.get('discount_levels');
                              if (raw) currentLevels = JSON.parse(raw);
                            } catch {}
                          }
                          if (!Object.keys(currentLevels || {}).length) {
                            currentLevels = { ...disc };
                          }
                          const cleanedDiscount = clamp(Number(levelDraft.discount));
                          const nextLevels = { ...currentLevels, [levelKey]: cleanedDiscount };
                          await api.updateSetting('discountLevels', JSON.stringify(nextLevels));
                          await api.updateSetting('discount_levels', JSON.stringify(nextLevels));
                          try { localStorage.setItem('discountLevels', JSON.stringify(nextLevels)); } catch {}
                          setDisc((prev) => ({ ...prev, [levelKey]: cleanedDiscount }));

                          const nextRules = normalizeCustomerLevelRules({
                            criteria: levelDraft.ruleType,
                            thresholds: {
                              ...rules.thresholds,
                              [levelKey]: levelDraft.ruleType === 'amount' ? Math.max(0, levelDraft.minSpend) : Math.max(0, levelDraft.minPurchases),
                            },
                            periodMonths: levelDraft.ruleType === 'purchases'
                              ? Math.max(1, Math.round(levelDraft.periodDays / 30))
                              : undefined,
                          });
                          await api.updateSetting('customerLevelRules', JSON.stringify(nextRules));
                          setRules(nextRules);
                          setToast('Nivel guardado');
                          setTimeout(() => setToast(null), 1200);
                          resetLevelWizard();
                        };
                        persistLevel().catch(() => {
                          setToast('No se pudo guardar el nivel.');
                          setTimeout(() => setToast(null), 1400);
                        });
                      }}
                      disabled={!canSaveLevel}
                    >
                      Guardar nivel
                    </button>
                  )}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={resetLevelWizard} style={{ background: '#fff', border: '1px solid #ddd' }}>
                    Cancelar
                  </button>
                </div>
              </div>

              <hr style={{ margin: '20px 0' }} />
              <h3>Actualizar niveles de clientes</h3>
              <p>Calcula el nivel por gasto histórico y ajusta el descuento (Bronze/Silver/Gold/Platinum).</p>
              <button onClick={onUpdateCustomerLevels} disabled={updatingLevels}>{updatingLevels ? 'Procesando…' : 'Actualizar niveles'}</button>
              {levelsResult && (
                <div style={{ marginTop: 8, color: '#333' }}>Actualizados: {levelsResult.updated} de {levelsResult.examined}</div>
              )}

              <hr style={{ margin: '16px 0' }} />
              <h4>Reglas de nivelación</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Criterio</label>
                  <select value={rules.criteria} onChange={(e)=> setRules({ ...rules, criteria: e.target.value as any })}>
                    <option value="amount">Por monto gastado</option>
                    <option value="purchases">Por número de compras</option>
                  </select>
                </div>
                {rules.criteria === 'purchases' && (
                  <div>
                    <label>Periodo (meses)</label>
                    <input type="number" min={1} value={rules.periodMonths ?? 6} onChange={(e)=> setRules({ ...rules, periodMonths: Math.max(1, Number(e.target.value)||6) })} />
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 10 }}>
                <div>
                  <label>Bronze</label>
                  <input type="number" min={0} value={rules.thresholds.Bronze} onChange={(e)=> setRules({ ...rules, thresholds: { ...rules.thresholds, Bronze: Math.max(0, Number(e.target.value)||0) } })} />
                </div>
                <div>
                  <label>Silver</label>
                  <input type="number" min={0} value={rules.thresholds.Silver} onChange={(e)=> setRules({ ...rules, thresholds: { ...rules.thresholds, Silver: Math.max(0, Number(e.target.value)||0) } })} />
                </div>
                <div>
                  <label>Gold</label>
                  <input type="number" min={0} value={rules.thresholds.Gold} onChange={(e)=> setRules({ ...rules, thresholds: { ...rules.thresholds, Gold: Math.max(0, Number(e.target.value)||0) } })} />
                </div>
                <div>
                  <label>Platinum</label>
                  <input type="number" min={0} value={rules.thresholds.Platinum} onChange={(e)=> setRules({ ...rules, thresholds: { ...rules.thresholds, Platinum: Math.max(0, Number(e.target.value)||0) } })} />
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={async () => {
                    setSavingRules(true);
                    try {
                      const api = (window as any).electronAPI;
                      if (!api?.updateSetting) {
                        alert('IPC no disponible');
                        return;
                      }
                      const clean = normalizeCustomerLevelRules(rules);
                      await api.updateSetting('customerLevelRules', JSON.stringify(clean));
                      setRules(clean);
                      setToast('Reglas guardadas');
                      setTimeout(() => setToast(null), 1200);
                    } finally {
                      setSavingRules(false);
                    }
                  }}
                  disabled={savingRules}
                >
                  {savingRules ? 'Guardando…' : 'Guardar reglas de nivelación'}
                </button>
                <button type="button" onClick={async ()=> setRules(await loadCustomerLevelRulesFromSettings())}>Restaurar</button>
              </div>
            </div>
          )}

          {tab === 'ventas' && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Ventas de hoy</h3>
                <button onClick={reloadTodaySales} disabled={loadingSales}>{loadingSales ? 'Actualizando…' : 'Refrescar'}</button>
              </div>
              <div style={{ marginTop: 6, color: '#666' }}>Total: {currency.format(todaySales.reduce((s, v) => s + (v.total || 0), 0))} · {todaySales.length} ventas</div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>ID</div>
                <div style={{ fontWeight: 600 }}>Cliente</div>
                <div style={{ fontWeight: 600 }}>Monto</div>
                <div style={{ fontWeight: 600 }}>Estado</div>
                <div style={{ fontWeight: 600 }}>Acciones</div>
                {todaySales.map(s => (
                  <React.Fragment key={s.id}>
                    <div>#{s.id}</div>
                    <div>{s.customerId ?? '—'}</div>
                    <div>{currency.format(s.total || 0)}</div>
                    <div>
                      <select value={s.status} onChange={(e) => onEditSaleStatus(s, e.target.value as Sale['status'])}>
                        <option value="Completada">Completada</option>
                        <option value="Cancelada">Cancelada</option>
                        <option value="Pendiente">Pendiente</option>
                      </select>
                    </div>
                    <div>
                      <button onClick={() => onDeleteSale(s)}>Eliminar</button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {tab === 'descuentos' && (
            <form onSubmit={onSaveDiscounts} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, maxWidth: 640 }}>
              <h3>Descuentos por nivel</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label>Bronze (%)</label>
                  <input type="number" min={0} max={100} value={disc.Bronze} onChange={e => setDisc({ ...disc, Bronze: clamp(Number(e.target.value)) })} />
                </div>
                <div>
                  <label>Silver (%)</label>
                  <input type="number" min={0} max={100} value={disc.Silver} onChange={e => setDisc({ ...disc, Silver: clamp(Number(e.target.value)) })} />
                </div>
                <div>
                  <label>Gold (%)</label>
                  <input type="number" min={0} max={100} value={disc.Gold} onChange={e => setDisc({ ...disc, Gold: clamp(Number(e.target.value)) })} />
                </div>
                <div>
                  <label>Platinum (%)</label>
                  <input type="number" min={0} max={100} value={disc.Platinum} onChange={e => setDisc({ ...disc, Platinum: clamp(Number(e.target.value)) })} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="submit" disabled={savingDisc}>{savingDisc ? 'Guardando…' : 'Guardar cambios'}</button>
                <button type="button" onClick={async () => setDisc(await loadDiscountLevelsFromSettings())} style={{ marginLeft: 8 }}>Restaurar</button>
              </div>
            </form>
          )}

          {tab === 'historicas' && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
              <h3>Ventas históricas</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={histMode} onChange={(e)=> setHistMode(e.target.value as any)}>
                  <option value="todas">Todas</option>
                  <option value="dia">Día</option>
                  <option value="semana">Semana</option>
                  <option value="mes">Mes</option>
                </select>
                {histMode === 'dia' && (
                  <input type="date" value={histDay} onChange={e=> setHistDay(e.target.value)} />
                )}
                {histMode === 'semana' && (
                  <>
                    <label>Inicio de semana</label>
                    <input type="date" value={histWeekStart} onChange={e=> setHistWeekStart(e.target.value)} />
                  </>
                )}
                {histMode === 'mes' && (
                  <input type="month" value={histMonth} onChange={e=> setHistMonth(e.target.value)} />
                )}
                <button type="button" onClick={reloadHistoric} disabled={loadingHistoric}>{loadingHistoric? 'Buscando…':'Buscar'}</button>
              </div>
              <div style={{ marginTop: 8, color: '#666' }}>Total: {currency.format(historicSales.reduce((s,v)=> s+(v.total||0), 0))} · {historicSales.length} ventas</div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>ID</div>
                <div style={{ fontWeight: 600 }}>Fecha</div>
                <div style={{ fontWeight: 600 }}>Cliente</div>
                <div style={{ fontWeight: 600 }}>Total</div>
                {historicSales.map(s => (
                  <React.Fragment key={s.id}>
                    <div>#{s.id}</div>
                    <div>{new Date(s.createdAt).toLocaleString('es-MX')}</div>
                    <div>{s.customerId ?? '—'}</div>
                    <div>{currency.format(s.total || 0)}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {tab === 'admin' && (
            <div style={{ background: '#fff', border: '1px solid #f5c6cb', borderRadius: 8, padding: 16 }}>
              <h3>⚠️ Administración avanzada</h3>
              <div style={{ marginBottom: 18, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Contraseña del panel</h4>
                <p style={{ margin: 0, color: '#555' }}>Actualiza la contraseña utilizada en los módulos protegidos. La contraseña maestra <strong>000000</strong> siempre permite el acceso.</p>
                <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>Estado actual: {hasCustomAdminPassword ? 'Personalizada' : `Predeterminada (${DEFAULT_ADMIN_PASSWORD})`}</div>
                {passwordFormError && <div style={{ marginTop: 8, color: '#d32f2f', fontSize: 13 }}>{passwordFormError}</div>}
                <form onSubmit={onChangeAdminPassword} style={{ marginTop: 12, display: 'grid', gap: 10, maxWidth: 420 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label>Contraseña actual o maestra</label>
                    <input type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} disabled={savingAdminPassword} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label>Nueva contraseña</label>
                    <input type="password" value={pwdNext} onChange={(e) => setPwdNext(e.target.value)} disabled={savingAdminPassword} />
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <label>Confirmar nueva contraseña</label>
                    <input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} disabled={savingAdminPassword} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={savingAdminPassword}>{savingAdminPassword ? 'Actualizando…' : 'Actualizar contraseña'}</button>
                    <button type="button" onClick={() => { setPwdCurrent(''); setPwdNext(''); setPwdConfirm(''); setPasswordFormError(null); }} disabled={savingAdminPassword}>Limpiar</button>
                  </div>
                </form>
              </div>
              <p style={{ color:'#a94442' }}>Estas acciones son irreversibles. Confirma antes de proceder.</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button type="button" style={{ background:'#d32f2f', color:'#fff', border:'none', padding:'8px 12px', borderRadius:6 }}
                  onClick={async ()=>{
                    if (!confirm('¿Eliminar TODAS las ventas? Esta acción no se puede deshacer.')) return;
                    const api = (window as any).electronAPI;
                    if (!api?.deleteAllSales) {
                      alert('IPC no disponible');
                      return;
                    }
                    const ok = await api.deleteAllSales();
                    if (ok) { setToast('Todas las ventas eliminadas'); setTimeout(()=> setToast(null), 1200); }
                  }}>Eliminar todas las ventas</button>
                <button type="button" style={{ background:'#f57c00', color:'#fff', border:'none', padding:'8px 12px', borderRadius:6 }}
                  onClick={async ()=>{
                    if (!confirm('¿Eliminar TODOS los clientes? Esta acción no se puede deshacer.')) return;
                    const api = (window as any).electronAPI;
                    if (!api?.deleteAllCustomers) {
                      alert('IPC no disponible');
                      return;
                    }
                    const ok = await api.deleteAllCustomers();
                    if (ok) { setToast('Todos los clientes eliminados'); setTimeout(()=> setToast(null), 1200); }
                  }}>Eliminar todos los clientes</button>
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#333', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>{toast}</div>
      )}
    </div>
  );
};

function clamp(n: number) { return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0)); }
