import React, { useEffect, useMemo, useState } from 'react';
import {
  loadSettings as loadSettingsSvc,
  updateSettings as updateSettingsSvc,
  validateSettings as validateSettingsSvc,
  Configuracion,
  getMonthlyGoal as getMonthlyGoalSvc,
  setMonthlyGoal as setMonthlyGoalSvc,
  getTodaySales as getTodaySalesSvc,
  updateSale as updateSaleSvc,
  deleteSale as deleteSaleSvc,
  getSalesByDay as getSalesByDaySvc,
  getSalesByWeek as getSalesByWeekSvc,
  getSalesByMonth as getSalesByMonthSvc,
  getAllSales as getAllSalesSvc,
  deleteAllSales as deleteAllSalesSvc,
  deleteAllCustomers as deleteAllCustomersSvc,
  getCustomerLevels as getCustomerLevelsSvc,
  createCustomerLevel as createCustomerLevelSvc,
  updateCustomerLevel as updateCustomerLevelSvc,
  deleteCustomerLevel as deleteCustomerLevelSvc,
  recalculateCustomerLevels as recalculateCustomerLevelsSvc,
  formatLevelCriteria,
  getDashboardPassword as getDashboardPasswordSvc,
  setDashboardPassword as setDashboardPasswordSvc,
  CustomerLevelDraft,
} from '../../../domain/configuracion/configuracionService';
import { Sale, CustomerLevel, DEFAULT_ADMIN_PASSWORD, MASTER_ADMIN_PASSWORD } from '../../../shared/types';

type ToastTone = 'info' | 'success' | 'error';

type ConfiguracionPageProps = {
  onNotify?: (message: string, tone?: ToastTone) => void;
  onConfirm?: (message: string, detail?: string) => Promise<boolean>;
};

export const ConfiguracionPage: React.FC<ConfiguracionPageProps> = ({ onNotify, onConfirm }) => {
  // Navegación por secciones
  const [tab, setTab] = useState<'generales' | 'dashboard' | 'niveles' | 'ventas' | 'historicas' | 'admin'>('generales');

  // Estado: Generales
  const [form, setForm] = useState<Configuracion>({ iva: 16, moneda: 'MXN', nivelesDescuento: { VIP: 12, Mayorista: 8, Particular: 0 }, tema: 'claro' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado: Dashboard
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [savingGoal, setSavingGoal] = useState(false);

  // Estado: Niveles de clientes
  const [customerLevels, setCustomerLevels] = useState<CustomerLevel[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [levelSaving, setLevelSaving] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<number | null>(null);
  const [levelErrors, setLevelErrors] = useState<Record<string, string>>({});
  const [recalculatingLevels, setRecalculatingLevels] = useState(false);
  const emptyLevelDraft: CustomerLevelDraft = {
    name: '',
    discountPercent: 0,
    logicOp: 'AND',
    minAmount: null,
    minOrders: null,
    withinDays: null,
    priority: 0,
    active: true,
  };
  const [levelDraft, setLevelDraft] = useState<CustomerLevelDraft>(emptyLevelDraft);

  const sortLevels = (levels: CustomerLevel[]) =>
    [...levels].sort((a, b) => {
      if ((b.priority ?? 0) !== (a.priority ?? 0)) return (b.priority ?? 0) - (a.priority ?? 0);
      if ((b.discountPercent ?? 0) !== (a.discountPercent ?? 0)) return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      return a.name.localeCompare(b.name, 'es');
    });

  const resetLevelForm = () => {
    setLevelDraft(emptyLevelDraft);
    setEditingLevelId(null);
    setLevelErrors({});
  };

  const loadLevels = async () => {
    setLevelsLoading(true);
    try {
      const list = await getCustomerLevelsSvc();
      setCustomerLevels(sortLevels(list));
    } finally {
      setLevelsLoading(false);
    }
  };

  // Estado: Ventas del día
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // Estado: Ventas históricas
  const [histMode, setHistMode] = useState<'dia' | 'semana' | 'mes' | 'todas'>('todas');
  const [histDay, setHistDay] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [histWeekStart, setHistWeekStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [histMonth, setHistMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [historicSales, setHistoricSales] = useState<Sale[]>([]);
  const [loadingHistoric, setLoadingHistoric] = useState(false);

  // Toast general
  const [resolvedAdminPassword, setResolvedAdminPassword] = useState<string>(DEFAULT_ADMIN_PASSWORD);
  const [hasCustomAdminPassword, setHasCustomAdminPassword] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLevelsLoading(true);
    try {
      const [s, goal, levels, adminPwd] = await Promise.all([
        loadSettingsSvc(),
        getMonthlyGoalSvc(),
        getCustomerLevelsSvc(),
        getDashboardPasswordSvc(),
      ]);
      setForm(s);
      setMonthlyGoal(goal || 0);
      setCustomerLevels(sortLevels(levels));
      setResolvedAdminPassword(adminPwd);
      setHasCustomAdminPassword((adminPwd || '').trim() !== DEFAULT_ADMIN_PASSWORD);
    } finally {
      setLoading(false);
      setLevelsLoading(false);
    }
  };

  const validateLevelDraftForm = (draft: CustomerLevelDraft) => {
    const result: Record<string, string> = {};
    if (!(draft.name || '').trim()) result.name = 'Nombre obligatorio';
    const percent = Number(draft.discountPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      result.discountPercent = 'Descuento entre 0 y 100';
    }
    const hasAmount = draft.minAmount !== null && draft.minAmount !== undefined;
    const hasOrders = draft.minOrders !== null && draft.minOrders !== undefined;
    if (!hasAmount && !hasOrders) {
      result.criteria = 'Define al menos un criterio (monto o compras)';
    }
    if (draft.withinDays !== null && draft.withinDays !== undefined && draft.withinDays <= 0) {
      result.withinDays = 'Debe ser mayor a 0';
    }
    return result;
  };

  const prepareLevelPayload = (draft: CustomerLevelDraft): CustomerLevelDraft => ({
    name: draft.name.trim(),
    discountPercent: Math.max(0, Math.min(100, Number(draft.discountPercent) || 0)),
    logicOp: draft.logicOp === 'OR' ? 'OR' : 'AND',
    minAmount: draft.minAmount === null || draft.minAmount === undefined ? null : Math.max(0, Number(draft.minAmount) || 0),
    minOrders: draft.minOrders === null || draft.minOrders === undefined ? null : Math.max(0, Math.floor(Number(draft.minOrders) || 0)),
    withinDays: draft.withinDays === null || draft.withinDays === undefined ? null : Math.max(1, Math.floor(Number(draft.withinDays) || 0)),
    priority: Math.floor(Number(draft.priority ?? 0) || 0),
    active: draft.active !== false,
  });

  const handleLevelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLevelDraftForm(levelDraft);
    setLevelErrors(validation);
    if (Object.keys(validation).length) return;
    setLevelSaving(true);
    try {
      const payload = prepareLevelPayload(levelDraft);
      if (editingLevelId) {
        await updateCustomerLevelSvc(editingLevelId, payload);
        onNotify?.('Nivel actualizado', 'success');
      } else {
        await createCustomerLevelSvc(payload);
        onNotify?.('Nivel creado', 'success');
      }
      await loadLevels();
      resetLevelForm();
    } catch (err: any) {
      const code = err?.code || err?.message;
      if (code === 'LEVEL_DUPLICATE') {
        setLevelErrors({ name: 'Ya existe un nivel con ese nombre' });
      } else if (code === 'LEVEL_NAME_REQUIRED') {
        setLevelErrors({ name: 'Nombre obligatorio' });
      } else if (code === 'LEVEL_DISCOUNT_INVALID') {
        setLevelErrors({ discountPercent: 'Descuento entre 0 y 100' });
      } else if (code === 'LEVEL_CRITERIA_REQUIRED') {
        setLevelErrors({ criteria: 'Define al menos un criterio (monto o compras)' });
      } else {
        console.error('Error al guardar nivel', err);
        onNotify?.('No se pudo guardar el nivel', 'error');
      }
    } finally {
      setLevelSaving(false);
    }
  };

  const handleEditLevel = (level: CustomerLevel) => {
    setEditingLevelId(level.id);
    setLevelDraft({
      name: level.name,
      discountPercent: level.discountPercent,
      logicOp: level.logicOp,
      minAmount: level.minAmount ?? null,
      minOrders: level.minOrders ?? null,
      withinDays: level.withinDays ?? null,
      priority: level.priority ?? 0,
      active: level.active !== false,
    });
    setLevelErrors({});
  };

  const handleDeleteLevel = async (level: CustomerLevel) => {
    const approved = onConfirm ? await onConfirm(`¿Eliminar nivel "${level.name}"?`) : true;
    if (!approved) return;
    try {
      await deleteCustomerLevelSvc(level.id);
      onNotify?.('Nivel eliminado', 'success');
      if (editingLevelId === level.id) resetLevelForm();
      await loadLevels();
    } catch (err) {
      console.error('Error eliminando nivel', err);
      onNotify?.('No se pudo eliminar el nivel', 'error');
    }
  };

  const handleRecalculateLevels = async () => {
    const approved = onConfirm ? await onConfirm('¿Recalcular niveles ahora?', 'Se evaluarán todos los clientes registrados.') : true;
    if (!approved) return;
    setRecalculatingLevels(true);
    try {
      const res = await recalculateCustomerLevelsSvc();
      onNotify?.(`Niveles recalculados (${res.updated}/${res.examined})`, 'success');
      await loadLevels();
    } catch (err) {
      console.error('Error recalculando niveles', err);
      onNotify?.('No se pudo recalcular los niveles', 'error');
    } finally {
      setRecalculatingLevels(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateSettingsSvc(form);
    setErrors(v.errors);
    if (!v.ok) return;
    setSaving(true);
    try {
      await updateSettingsSvc(form);
      onNotify?.('Cambios guardados', 'success');
      // sincroniza modo nocturno en localStorage para UI si aplica
      try {
        const sysStr = localStorage.getItem('systemSettings');
        const sys = sysStr ? JSON.parse(sysStr) : {};
        sys.nightMode = form.tema === 'oscuro';
        localStorage.setItem('systemSettings', JSON.stringify(sys));
      } catch {}
    } catch (err: any) {
      if (err?.message === 'VALIDATION_ERROR') setErrors(err.fields || {});
      else onNotify?.('No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currency = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);

  const reloadTodaySales = async () => {
    setLoadingSales(true);
    try { setTodaySales(await getTodaySalesSvc()); } finally { setLoadingSales(false); }
  };

  const onSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);
    try { await setMonthlyGoalSvc(monthlyGoal); onNotify?.('Meta mensual guardada', 'success'); }
    finally { setSavingGoal(false); }
  };

  const onEditSaleStatus = async (s: Sale, nextStatus: Sale['status']) => {
    const res = await updateSaleSvc(s.id, { status: nextStatus });
    if (res) {
      onNotify?.('Venta actualizada', 'success');
      reloadTodaySales();
    }
  };

  const reloadHistoric = async () => {
    setLoadingHistoric(true);
    try {
      let data: Sale[] = [];
      if (histMode === 'todas') data = await getAllSalesSvc();
      else if (histMode === 'dia') data = await getSalesByDaySvc(histDay);
      else if (histMode === 'semana') data = await getSalesByWeekSvc(histWeekStart);
      else if (histMode === 'mes') data = await getSalesByMonthSvc(histMonth);
      setHistoricSales(data);
    } finally { setLoadingHistoric(false); }
  };

  useEffect(() => { if (tab === 'historicas') reloadHistoric(); }, [tab]);
  useEffect(() => { if (tab === 'historicas') reloadHistoric(); }, [histMode, histDay, histWeekStart, histMonth]);

  const onDeleteSale = async (s: Sale) => {
    const approved = onConfirm ? await onConfirm(`¿Eliminar venta #${s.id}?`) : true;
    if (!approved) return;
    const removed = await deleteSaleSvc(s.id);
    if (removed) {
      onNotify?.('Venta eliminada', 'success');
      reloadTodaySales();
    }
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
      await setDashboardPasswordSvc(next);
      setResolvedAdminPassword(next);
      setHasCustomAdminPassword(next !== DEFAULT_ADMIN_PASSWORD);
      setPwdCurrent('');
      setPwdNext('');
      setPwdConfirm('');
      onNotify?.('Contraseña actualizada', 'success');
    } catch (err: any) {
      if (err?.message === 'PASSWORD_EMPTY') setPasswordFormError('La nueva contraseña no puede estar vacía.');
      else setPasswordFormError('No se pudo actualizar la contraseña.');
    } finally {
      setSavingAdminPassword(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>⚙️ Configuración</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'generales', label: 'Generales' },
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'niveles', label: 'Niveles de clientes' },
          { key: 'ventas', label: 'Ventas del día' },
          { key: 'historicas', label: 'Ventas históricas' },
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

          {tab === 'niveles' && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h3 style={{ margin: 0 }}>Niveles de clientes</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleRecalculateLevels} disabled={recalculatingLevels}>
                    {recalculatingLevels ? 'Recalculando…' : 'Recalcular niveles ahora'}
                  </button>
                  <button type="button" onClick={resetLevelForm} disabled={levelSaving}>
                    {editingLevelId ? 'Nuevo nivel' : 'Limpiar formulario'}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                {levelsLoading ? (
                  <div>Cargando niveles…</div>
                ) : customerLevels.length === 0 ? (
                  <div style={{ color: '#666' }}>Aún no hay niveles configurados.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 8 }}>Nombre</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>% Descuento</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Criterio</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Prioridad</th>
                          <th style={{ textAlign: 'left', padding: 8 }}>Estado</th>
                          <th style={{ textAlign: 'center', padding: 8 }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerLevels.map((level) => (
                          <tr key={level.id} style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: 8 }}>{level.name}</td>
                            <td style={{ padding: 8 }}>{level.discountPercent}%</td>
                            <td style={{ padding: 8 }}>{formatLevelCriteria(level)}</td>
                            <td style={{ padding: 8 }}>{level.priority ?? 0}</td>
                            <td style={{ padding: 8 }}>{level.active === false ? 'Inactivo' : 'Activo'}</td>
                            <td style={{ padding: 8, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 8 }}>
                              <button type="button" onClick={() => handleEditLevel(level)}>Editar</button>
                              <button type="button" onClick={() => handleDeleteLevel(level)}>Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <form onSubmit={handleLevelSubmit} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <h4 style={{ margin: 0 }}>{editingLevelId ? `Editar nivel #${editingLevelId}` : 'Nuevo nivel'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div>
                    <label>Nombre</label>
                    <input value={levelDraft.name} onChange={(e) => setLevelDraft({ ...levelDraft, name: e.target.value })} />
                    {levelErrors.name && <div style={{ color: '#d32f2f', fontSize: 12 }}>{levelErrors.name}</div>}
                  </div>
                  <div>
                    <label>Descuento (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={levelDraft.discountPercent}
                      onChange={(e) => setLevelDraft({ ...levelDraft, discountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    />
                    {levelErrors.discountPercent && <div style={{ color: '#d32f2f', fontSize: 12 }}>{levelErrors.discountPercent}</div>}
                  </div>
                  <div>
                    <label>Lógica</label>
                    <select value={levelDraft.logicOp} onChange={(e) => setLevelDraft({ ...levelDraft, logicOp: e.target.value === 'OR' ? 'OR' : 'AND' })}>
                      <option value="AND">AND (cumplir todos)</option>
                      <option value="OR">OR (cumplir alguno)</option>
                    </select>
                  </div>
                  <div>
                    <label>Monto mínimo</label>
                    <input
                      type="number"
                      min={0}
                      value={levelDraft.minAmount ?? ''}
                      placeholder="Sin monto"
                      onChange={(e) => {
                        const value = e.target.value;
                        setLevelDraft({ ...levelDraft, minAmount: value === '' ? null : Math.max(0, Number(value) || 0) });
                      }}
                    />
                  </div>
                  <div>
                    <label>Compras mínimas</label>
                    <input
                      type="number"
                      min={0}
                      value={levelDraft.minOrders ?? ''}
                      placeholder="Sin mínimo"
                      onChange={(e) => {
                        const value = e.target.value;
                        setLevelDraft({ ...levelDraft, minOrders: value === '' ? null : Math.max(0, Math.floor(Number(value) || 0)) });
                      }}
                    />
                  </div>
                  <div>
                    <label>Ventana (días)</label>
                    <input
                      type="number"
                      min={1}
                      value={levelDraft.withinDays ?? ''}
                      placeholder="Histórico completo"
                      onChange={(e) => {
                        const value = e.target.value;
                        setLevelDraft({ ...levelDraft, withinDays: value === '' ? null : Math.max(1, Math.floor(Number(value) || 0)) });
                      }}
                    />
                    {levelErrors.withinDays && <div style={{ color: '#d32f2f', fontSize: 12 }}>{levelErrors.withinDays}</div>}
                  </div>
                  <div>
                    <label>Prioridad</label>
                    <input
                      type="number"
                      value={levelDraft.priority}
                      onChange={(e) => setLevelDraft({ ...levelDraft, priority: Math.floor(Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      id="nivel-activo"
                      type="checkbox"
                      checked={levelDraft.active}
                      onChange={(e) => setLevelDraft({ ...levelDraft, active: e.target.checked })}
                    />
                    <label htmlFor="nivel-activo">Activo</label>
                  </div>
                </div>
                {levelErrors.criteria && <div style={{ color: '#d32f2f', fontSize: 12 }}>{levelErrors.criteria}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={levelSaving}>{levelSaving ? 'Guardando…' : editingLevelId ? 'Guardar nivel' : 'Crear nivel'}</button>
                  {editingLevelId && (
                    <button type="button" onClick={resetLevelForm} disabled={levelSaving}>Cancelar</button>
                  )}
                </div>
              </form>
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

          {/* La pestaña de descuentos fue sustituida por la gestión de niveles dinámicos */}

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
                    const confirmDelete = onConfirm ? await onConfirm('¿Eliminar TODAS las ventas?', 'Esta acción no se puede deshacer.') : true;
                    if (!confirmDelete) return;
                    const ok = await deleteAllSalesSvc();
                    if (ok) { onNotify?.('Todas las ventas eliminadas', 'success'); }
                  }}>Eliminar todas las ventas</button>
                <button type="button" style={{ background:'#f57c00', color:'#fff', border:'none', padding:'8px 12px', borderRadius:6 }}
                  onClick={async ()=>{
                    const confirmDelete = onConfirm ? await onConfirm('¿Eliminar TODOS los clientes?', 'Esta acción no se puede deshacer.') : true;
                    if (!confirmDelete) return;
                    const ok = await deleteAllCustomersSvc();
                    if (ok) { onNotify?.('Todos los clientes eliminados', 'success'); }
                  }}>Eliminar todos los clientes</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

