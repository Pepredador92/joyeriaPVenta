import React, { useEffect, useMemo, useState } from 'react';
import {
  // Generales
  loadSettings as loadSettingsSvc,
  updateSettings as updateSettingsSvc,
  validateSettings as validateSettingsSvc,
  Configuracion,
  // Dashboard
  getMonthlyGoal as getMonthlyGoalSvc,
  setMonthlyGoal as setMonthlyGoalSvc,
  // Descuentos por nivel
  getDiscountLevels as getDiscountLevelsSvc,
  setDiscountLevels as setDiscountLevelsSvc,
  // Ventas del día
  getTodaySales as getTodaySalesSvc,
  updateSale as updateSaleSvc,
  deleteSale as deleteSaleSvc,
  // Ventas históricas
  getSalesByDay as getSalesByDaySvc,
  getSalesByWeek as getSalesByWeekSvc,
  getSalesByMonth as getSalesByMonthSvc,
  getAllSales as getAllSalesSvc,
  // Administración avanzada
  deleteAllSales as deleteAllSalesSvc,
  deleteAllCustomers as deleteAllCustomersSvc,
  // Clientes
  updateCustomerLevels as updateCustomerLevelsSvc,
  getCustomerLevelRules as getCustomerLevelRulesSvc,
  setCustomerLevelRules as setCustomerLevelRulesSvc
} from '../../../domain/configuracion/configuracionService';
import { Sale } from '../../../shared/types';

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
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [historicSales, setHistoricSales] = useState<Sale[]>([]);
  const [loadingHistoric, setLoadingHistoric] = useState(false);

  // Estado: Clientes (acciones masivas)
  const [updatingLevels, setUpdatingLevels] = useState(false);
  const [levelsResult, setLevelsResult] = useState<{ updated: number; examined: number } | null>(null);
  const [rules, setRules] = useState<{ criteria: 'amount' | 'purchases'; thresholds: { Bronze: number; Silver: number; Gold: number; Platinum: number }; periodMonths?: number }>({ criteria: 'amount', thresholds: { Bronze: 0, Silver: 15000, Gold: 50000, Platinum: 100000 } });
  const [savingRules, setSavingRules] = useState(false);

  // Toast general
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, goal, dlevels, rl] = await Promise.all([
        loadSettingsSvc(),
        getMonthlyGoalSvc(),
        getDiscountLevelsSvc(),
        getCustomerLevelRulesSvc()
      ]);
      setForm(s);
      setMonthlyGoal(goal || 0);
      setDisc(dlevels);
      setRules(rl);
    } finally {
      setLoading(false);
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
    try { setTodaySales(await getTodaySalesSvc()); } finally { setLoadingSales(false); }
  };

  const onSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGoal(true);
    try { await setMonthlyGoalSvc(monthlyGoal); setToast('Meta mensual guardada'); setTimeout(() => setToast(null), 1200); }
    finally { setSavingGoal(false); }
  };

  const onSaveDiscounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDisc(true);
    try { await setDiscountLevelsSvc(disc); setToast('Descuentos guardados'); setTimeout(() => setToast(null), 1200); }
    finally { setSavingDisc(false); }
  };

  const onUpdateCustomerLevels = async () => {
    setUpdatingLevels(true); setLevelsResult(null);
    try {
      const res = await updateCustomerLevelsSvc();
      setLevelsResult(res);
      setToast(`Niveles actualizados: ${res.updated}/${res.examined}`);
      setTimeout(() => setToast(null), 1500);
    } finally { setUpdatingLevels(false); }
  };

  const onEditSaleStatus = async (s: Sale, nextStatus: Sale['status']) => {
    const res = await updateSaleSvc(s.id, { status: nextStatus });
    if (res) {
      setToast('Venta actualizada'); setTimeout(() => setToast(null), 1000);
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
    if (!confirm(`¿Eliminar venta #${s.id}?`)) return;
    const ok = await deleteSaleSvc(s.id);
    if (ok) { setToast('Venta eliminada'); setTimeout(() => setToast(null), 1000); reloadTodaySales(); }
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
                <button type="button" onClick={async ()=> { setSavingRules(true); try { await setCustomerLevelRulesSvc(rules); setToast('Reglas guardadas'); setTimeout(()=> setToast(null), 1200); } finally { setSavingRules(false); } }} disabled={savingRules}>
                  {savingRules ? 'Guardando…' : 'Guardar reglas de nivelación'}
                </button>
                <button type="button" onClick={async ()=> setRules(await getCustomerLevelRulesSvc())}>Restaurar</button>
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
                <button type="button" onClick={async () => setDisc(await getDiscountLevelsSvc())} style={{ marginLeft: 8 }}>Restaurar</button>
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
              <p style={{ color:'#a94442' }}>Estas acciones son irreversibles. Confirma antes de proceder.</p>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button type="button" style={{ background:'#d32f2f', color:'#fff', border:'none', padding:'8px 12px', borderRadius:6 }}
                  onClick={async ()=>{
                    if (!confirm('¿Eliminar TODAS las ventas? Esta acción no se puede deshacer.')) return;
                    const ok = await deleteAllSalesSvc();
                    if (ok) { setToast('Todas las ventas eliminadas'); setTimeout(()=> setToast(null), 1200); }
                  }}>Eliminar todas las ventas</button>
                <button type="button" style={{ background:'#f57c00', color:'#fff', border:'none', padding:'8px 12px', borderRadius:6 }}
                  onClick={async ()=>{
                    if (!confirm('¿Eliminar TODOS los clientes? Esta acción no se puede deshacer.')) return;
                    const ok = await deleteAllCustomersSvc();
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
