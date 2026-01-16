import React, { useState, useEffect } from 'react';
import './App.css';
import { DEFAULT_ADMIN_PASSWORD, MASTER_ADMIN_PASSWORD } from './shared/types';
import { VentasPage } from './presentation/modules/ventas';
import { ClientesPage } from './presentation/modules/clientes/ClientesPage';
import { InventarioPage } from './presentation/modules/inventario/InventarioPage';
import { ConfiguracionPage } from './presentation/modules/configuracion/ConfiguracionPage';
import { ProductosPage } from './presentation/modules/productos/ProductosPage';
import {
  getCustomerStats as getCustomerStatsSvc,
  filterCustomerStats as filterCustomerStatsSvc,
  getCustomerTypeColor as getCustomerTypeColorSvc,
  getStatsForCustomer as getStatsForCustomerSvc,
  decideCustomerLevelFromTotal,
  phoneDigits as phoneDigitsUtil,
} from './domain/clientes/clientesService';
import {
  getVentasTotales as getVentasTotalesRpt,
  getImpuestosTotales as getImpuestosTotalesRpt,
  getDescuentosTotales as getDescuentosTotalesRpt,
  getIngresosPorPeriodo as getIngresosPorPeriodoRpt,
  getTopProductos as getTopProductosRpt,
  getRangeForKind,
  filterSalesByRange as filterSalesByRangeRpt,
  buildKpis as buildKpisRpt,
  buildDailySeries as buildDailySeriesRpt,
  getTopCategorias as getTopCategoriasRpt,
  getLowStock as getLowStockRpt,
  getTopClientes as getTopClientesRpt,
  getNewVsReturning as getNewVsReturningRpt,
  getOpenSession as getOpenSessionRpt,
  getRecentSales as getRecentSalesRpt,
} from './domain/reportes/reportesService';

type CurrentView = 'dashboard' | 'sales' | 'products' | 'inventory' | 'customers' | 'cash-session' | 'reports' | 'settings';

const resolveDashboardPassword = () => {
  if (typeof localStorage === 'undefined') return DEFAULT_ADMIN_PASSWORD;
  try {
    const stored = (localStorage.getItem('dashboardPassword') || '').trim();
    if (stored) return stored;
  } catch {}
  return DEFAULT_ADMIN_PASSWORD;
};

// Reusable password gate for protected modules (uses the same dashboard password)
const AccessGate: React.FC<{ area: 'products' | 'reports' | 'settings'; children: React.ReactNode }> = ({ area, children }) => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(`gate:${area}`) === '1';
    } catch {}
    return false;
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [password, setPassword] = useState('');
  const [attempts, setAttempts] = useState(0);
  const ATTEMPT_LIMIT = 3;
  const COOLDOWN_MS = 30_000;
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!unlocked) setShowModal(true);
  }, []);

  const ADMIN_PASSWORD = resolveDashboardPassword();

  const secondsLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
  if (password === ADMIN_PASSWORD || password === MASTER_ADMIN_PASSWORD) {
      setUnlocked(true);
      try { sessionStorage.setItem(`gate:${area}`, '1'); } catch {}
      setShowModal(false);
      setPassword('');
      setAttempts(0);
      window.electronAPI?.logInfo?.(`desbloqueo_exitoso_${area}`);
    } else {
      const next = attempts + 1;
      setAttempts(next);
      window.electronAPI?.logWarn?.(`desbloqueo_fallido_${area}`);
      if (next >= ATTEMPT_LIMIT) {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        setShowModal(false);
        setTimeout(() => { setAttempts(0); setCooldownUntil(null); }, COOLDOWN_MS + 50);
      }
    }
  };

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  if (unlocked) return <>{children}</>;

  return (
    <div style={{ position:'relative', minHeight:'100%', padding: 20 }}>
      <div style={{
        position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(180deg, rgba(246,248,252,0.9), rgba(240,242,247,0.92))'
      }}>
        <div style={{ background:'#fff', border:'1px solid #e7ebf3', borderRadius:12, padding:20, width:360, boxShadow:'0 10px 30px rgba(16,24,40,0.12)' }}>
          <h3 style={{ marginTop:0, marginBottom:10 }}>🔒 Módulo protegido</h3>
          <div style={{ color:'#667085', fontSize:13, marginBottom:12 }}>Ingresa la contraseña para acceder a {area==='products'?'Productos':area==='reports'?'Reportes':'Configuración'}.</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { if (cooldownUntil && Date.now()<cooldownUntil) return; setPassword(''); setShowModal(true); window.electronAPI?.logInfo?.(`intento_desbloqueo_${area}`); }}
              style={{ flex:1, padding:'10px 12px', border:'1px solid #2f6fed', background:'#2f6fed', color:'#fff', borderRadius:8, cursor:'pointer', fontWeight:600 }}>Desbloquear</button>
          </div>
          {cooldownUntil && Date.now()<cooldownUntil && (
            <div style={{ marginTop:8, fontSize:12, color:'#d32f2f' }}>Demasiados intentos. Intenta nuevamente en {secondsLeft}s.</div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={handleSubmit} style={{ background:'#fff', padding:18, borderRadius:10, width:360, boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginTop:0, marginBottom:12 }}>🔒 Ingresar contraseña</h3>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" autoFocus disabled={!!(cooldownUntil && Date.now()<cooldownUntil)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:10 }} />
            {attempts>0 && attempts<ATTEMPT_LIMIT && !cooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Intento fallido. Te quedan {ATTEMPT_LIMIT - attempts} intentos.</div>
            )}
            {cooldownUntil && Date.now()<cooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Demasiados intentos. Intenta nuevamente en {secondsLeft}s.</div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={()=>setShowModal(false)} style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Cancelar</button>
              <button type="submit" disabled={!!(cooldownUntil && Date.now()<cooldownUntil)} style={{ background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Desbloquear</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    salesToday: 0,
    totalProducts: 0,
    totalCustomers: 0,
    salesCount: 0
  });

  // Privacy/masking state
  const ADMIN_DASHBOARD_PASSWORD = resolveDashboardPassword();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      const s = localStorage.getItem('securitySettings');
      if (s) {
        const parsed = JSON.parse(s);
        return !parsed.maskAmountsByDefault;
      }
    } catch {}
    return false;
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [attempts, setAttempts] = useState(0);
  const ATTEMPT_LIMIT = 3;
  const COOLDOWN_MS = 30_000; // 30s
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  // Data state
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);

  // Date range state
  type RangeKind = 'hoy' | '7d' | '30d' | 'mes' | 'custom';
  const [rangeKind, setRangeKind] = useState<RangeKind>('hoy');
  const todayStr = new Date().toISOString().split('T')[0];
  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);

  useEffect(() => {
    loadStats();
  }, []);

  // Log activation of masking once on mount
  useEffect(() => {
    window.electronAPI?.logInfo?.('dashboard_montos_ocultos_activado');
  }, []);

  const loadStats = async () => {
    try {
      if (window.electronAPI) {
        const [productsData, customersData, salesData, sessionsData, settingsData] = await Promise.all([
          window.electronAPI.getProducts(),
          window.electronAPI.getCustomers(),
          window.electronAPI.getSales(),
          window.electronAPI.getCashSessions?.() || Promise.resolve([]),
          window.electronAPI.getSettings?.() || Promise.resolve([])
        ] as any);
        setProducts(productsData);
        setCustomers(customersData);
        setSales(salesData);
        setCashSessions(sessionsData || []);
        setSettings(settingsData || []);
        const today = new Date().toDateString();
        const salesToday = salesData
          .filter((sale: any) => new Date(sale.createdAt).toDateString() === today)
          .reduce((sum: number, sale: any) => sum + sale.total, 0);
        setStats({
          salesToday,
            totalProducts: productsData.length,
            totalCustomers: customersData.length,
            salesCount: salesData.length
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleShowAmounts = () => {
    const now = Date.now();
    if (cooldownUntil && now < cooldownUntil) {
      // Still in cooldown; optional warn
      window.electronAPI?.logWarn?.(`desbloqueo_bloqueado_por_cooldown_dashboard:${Math.ceil((cooldownUntil - now)/1000)}s`);
      setShowPasswordModal(true);
      return;
    }
    setPasswordInput('');
    setShowPasswordModal(true);
    window.electronAPI?.logInfo?.('intento_desbloqueo_dashboard');
  };

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
  if (passwordInput === ADMIN_DASHBOARD_PASSWORD || passwordInput === MASTER_ADMIN_PASSWORD) {
      setIsUnlocked(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setAttempts(0);
      window.electronAPI?.logInfo?.('desbloqueo_exitoso_dashboard');
    } else {
      const next = attempts + 1;
      setAttempts(next);
      window.electronAPI?.logWarn?.('desbloqueo_fallido_dashboard');
      if (next >= ATTEMPT_LIMIT) {
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        setShowPasswordModal(false);
        // Auto clear attempts after cooldown
        setTimeout(() => { setAttempts(0); setCooldownUntil(null); }, COOLDOWN_MS + 50);
      }
    }
  };

  const handleHide = () => {
    setIsUnlocked(false);
    window.electronAPI?.logInfo?.('dashboard_montos_ocultos');
  };

  const secondsLeft = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)) : 0;

  // Close modal with Escape
  useEffect(() => {
    if (!showPasswordModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPasswordModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPasswordModal]);

  // Helpers for date range, money and aggregations
  const toCurrency = (n:number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const masked = () => '••••••';
  const money = (n:number) => (isUnlocked ? toCurrency(n) : masked());

  const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days*86400000);
  const { start, end } = getRangeForKind(rangeKind, customStart, customEnd);
  const filteredSales = filterSalesByRangeRpt(sales as any, start, end);

  const kpis = buildKpisRpt(filteredSales as any);

  // Trend (daily totals within range up to 30 pts)
  const series = buildDailySeriesRpt(sales as any, start, end, 30);
  const maxY = Math.max(1, ...series.map(p=>p.total));

  // Top categorías (por ingresos)
  const topCategorias = getTopCategoriasRpt(filteredSales as any, products as any, 5);

  // Low stock
  const lowStock = getLowStockRpt(products as any, 6);

  // Top clientes
  const topClientes = getTopClientesRpt(filteredSales as any, customers as any, 5);

  // New vs recurrentes en el rango
  const newVsReturning = getNewVsReturningRpt(sales as any, filteredSales as any, start);

  // Sesión de caja
  const openSession = getOpenSessionRpt(cashSessions || []);
  const recentSales = getRecentSalesRpt(sales as any, 10);

  return (
    <div className="lux-dashboard" style={{ padding: '36px min(4vw,64px) 60px', width:'100%', boxSizing:'border-box' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, margin:'0 0 18px' }}>
        <h1 className="gradient-title" style={{ textAlign:'left', fontSize:'46px', margin:'0', fontWeight:600 }}>📊 Visión General</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={rangeKind} onChange={e=>setRangeKind(e.target.value as any)} style={{ padding:'10px 12px', border:'1px solid #ddd', borderRadius:8 }}>
            <option value="hoy">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="mes">Mes en curso</option>
            <option value="custom">Personalizado</option>
          </select>
          {rangeKind==='custom' && (
            <div style={{ display:'flex', gap:8 }}>
              <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }} />
              <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }} />
            </div>
          )}
          {isUnlocked ? (
            <button onClick={handleHide} style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'10px 14px', cursor:'pointer' }}>Ocultar montos</button>
          ) : (
            <button onClick={handleShowAmounts} style={{ background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'10px 14px', cursor:'pointer' }}>Mostrar montos</button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="lux-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', width:'100%', marginBottom:18 }}>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Ingresos</h3>
          <div className="stat-value">{money(kpis.total)}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>{series.length} días en rango</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Transacciones</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{kpis.count}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Ventas en el rango</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Ticket Promedio</h3>
          <div className="stat-value">{money(kpis.avg)}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Promedio por venta</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Inventario</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{stats.totalProducts}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Productos registrados</small>
        </div>
      </div>

      {/* Trend and Goal */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:16, marginBottom:18 }}>
        <div className="stat-card" style={{ padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <strong>Ingresos diarios</strong>
            <span style={{ color:'#6a6a6a', fontSize:12 }}>{series.length} días</span>
          </div>
          <svg viewBox={`0 0 300 80`} width="100%" height="80">
            <polyline fill="none" stroke="#2f6fed" strokeWidth="2" points={series.map((p, i)=> {
              const x = (300 * i) / Math.max(1, series.length-1);
              const y = 80 - (p.total / maxY) * 70 - 5;
              return `${x},${y}`;
            }).join(' ')} />
          </svg>
        </div>
        <div className="stat-card" style={{ padding:16 }}>
          {(() => {
            const goalSetting = (settings||[]).find((s:any)=> s.key === 'monthly_goal');
            const monthlyGoal = goalSetting ? parseFloat(goalSetting.value) : 100000;
            const monthStart = startOfMonth(new Date());
            const monthEnd = addDays(floorDate(new Date()), 1);
            const monthSales = sales.filter((s:any)=> {
              const d = new Date(s.createdAt);
              return d>=monthStart && d<monthEnd;
            });
            const achieved = monthSales.reduce((sum:number, s:any)=> sum + (s.total||0), 0);
            const pct = Math.min(100, Math.round((achieved / (monthlyGoal||1)) * 100));
            return (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <strong>Meta mensual</strong>
                  <span style={{ color:'#6a6a6a' }}>{money(monthlyGoal)}</span>
                </div>
                <div style={{ height:12, background:'#eee', borderRadius:8, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:'#4caf50' }} />
                </div>
                <div style={{ marginTop:6, display:'flex', justifyContent:'space-between', fontSize:12, color:'#555' }}>
                  <span>Avance</span>
                  <span>{pct}% · {money(achieved)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Breakdown + Top categorías */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:18 }}>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Métodos de pago</strong>
          <div style={{ marginTop:10, display:'grid', gap:8 }}>
            {Object.entries(kpis.byMethod).length===0 ? (
              <div style={{ color:'#666', fontSize:13 }}>No hay ventas en el rango</div>
            ) : (
              Object.entries(kpis.byMethod).sort((a,b)=> b[1]-a[1]).map(([montoKey, val])=> {
                const pct = kpis.total ? Math.round((val/kpis.total)*100) : 0;
                return (
                  <div key={montoKey} style={{ display:'grid', gridTemplateColumns:'120px 1fr auto', gap:8, alignItems:'center' }}>
                    <span style={{ color:'#555' }}>{montoKey}</span>
                    <div style={{ height:8, background:'#eee', borderRadius:6, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:'#2f6fed' }} />
                    </div>
                    <span style={{ fontSize:12, color:'#555' }}>{pct}% {isUnlocked ? `· ${toCurrency(val)}` : ''}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Top categorías</strong>
          <div style={{ marginTop:10, display:'grid', gap:8 }}>
            {topCategorias.length===0 ? (
              <div style={{ color:'#666', fontSize:13 }}>Sin datos</div>
            ) : (
              topCategorias.map(([cat, val])=> (
                <div key={cat} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight:600 }}>{money(val)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Inventario + Clientes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:18 }}>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Stock bajo</strong>
          <div style={{ marginTop:10, display:'grid', gap:6, maxHeight:200, overflow:'auto' }}>
            {lowStock.length===0 ? (
              <div style={{ color:'#666', fontSize:13 }}>Todo bien por ahora</div>
            ) : lowStock.map(p=> (
              <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center' }}>
                <span style={{ color:'#333' }}>{p.name}</span>
                <span style={{ fontSize:12, color:'#555' }}>{p.category}</span>
                <span style={{ fontWeight:700, color: p.stock<5? '#d32f2f':'#f57c00' }}>{p.stock}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Clientes</strong>
          <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:8, padding:10 }}>
              <div style={{ color:'#666', fontSize:12 }}>Nuevos</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{newVsReturning.nuevos}</div>
            </div>
            <div style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:8, padding:10 }}>
              <div style={{ color:'#666', fontSize:12 }}>Recurrentes</div>
              <div style={{ fontSize:22, fontWeight:700 }}>{newVsReturning.recurrentes}</div>
            </div>
          </div>
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:600, marginBottom:6 }}>Top clientes</div>
            {topClientes.length===0 ? (
              <div style={{ color:'#666', fontSize:13 }}>Sin datos</div>
            ) : (
              <div style={{ display:'grid', gap:6 }}>
                {topClientes.map((t)=> (
                  <div key={t.customer.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                    <span>{t.customer.name}</span>
                    <span style={{ fontWeight:700 }}>{money(t.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ventas recientes + Caja */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Ventas recientes</strong>
          <div style={{ marginTop:10, maxHeight:220, overflow:'auto', display:'grid', gap:8 }}>
            {recentSales.map((s:any)=> (
              <div key={s.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'#666' }}>{new Date(s.createdAt).toLocaleString('es-MX')}</span>
                <span style={{ color:'#555' }}>{s.paymentMethod||'Otro'}</span>
                <span style={{ fontWeight:700 }}>{money(s.total||0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card" style={{ padding:16 }}>
          <strong>Caja</strong>
          {openSession ? (
            <div style={{ marginTop:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                <span>Sesión abierta desde</span>
                <span>{new Date(openSession.startTime).toLocaleString('es-MX')}</span>
              </div>
              <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                <span>Inicial</span>
                <span style={{ fontWeight:700 }}>{money(openSession.initialAmount||0)}</span>
              </div>
            </div>
          ) : (
            <div style={{ marginTop:8, color:'#666', fontSize:13 }}>No hay sesión de caja abierta</div>
          )}
        </div>
      </div>

  {showPasswordModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <form onSubmit={handleUnlock} style={{ background:'#fff', padding:24, borderRadius:12, width:'min(420px, 92vw)', border:'1px solid #e0e0e0', boxShadow:'0 10px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop:0, marginBottom:12 }}>🔒 Ingresar contraseña</h3>
            <div style={{ fontSize:13, color:'#666', marginBottom:12 }}>Los montos del dashboard están protegidos.</div>
            <input type="password" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} placeholder="Contraseña" autoFocus disabled={!!(cooldownUntil && Date.now()<cooldownUntil)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:10 }} />
            {attempts>0 && attempts<ATTEMPT_LIMIT && !cooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Intento fallido. Te quedan {ATTEMPT_LIMIT - attempts} intentos.</div>
            )}
            {cooldownUntil && Date.now()<cooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Demasiados intentos. Intenta nuevamente en {secondsLeft}s.</div>
            )}
    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
      <button type="button" onClick={()=>setShowPasswordModal(false)} style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Cancelar</button>
              <button type="submit" disabled={!!(cooldownUntil && Date.now()<cooldownUntil)} style={{ background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Desbloquear</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// Ventas UI fue extraída a src/presentation/modules/ventas/VentasPage


// Continúo implementando el resto de componentes...
// Componente de Corte de Caja
const CashSession = () => {
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [detailSession, setDetailSession] = useState<any>(null);
  const [sessionToDelete, setSessionToDelete] = useState<any>(null);
  const [movementType, setMovementType] = useState<'Entrada' | 'Salida'>('Entrada');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementNote, setMovementNote] = useState('');
  const [movementToast, setMovementToast] = useState<string | null>(null);
  const [newSession, setNewSession] = useState({
    initialAmount: 0, finalAmount: 0, notes: ''
  });

  useEffect(() => {
    loadCashSessions();
    loadSales();
  }, []);

  const loadCashSessions = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getCashSessions();
        setCashSessions(data);
      }
    } catch (error) {
      console.error('Error loading cash sessions:', error);
    }
  };

  const loadSales = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getSales();
        setSales(data);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  };

  // Filtrar ventas que caen dentro del rango de una sesión
  const getSessionSales = (session: any) => {
    const start = new Date(session.startTime);
    const end = session.endTime ? new Date(session.endTime) : new Date();
    return sales.filter((s: any) => {
      const d = new Date(s.createdAt);
      return d >= start && d <= end;
    });
  };

  // Calcular resumen de una sesión (por método de pago y totales)
  const summarizeSession = (session: any) => {
    const list = getSessionSales(session);
    const byMethod = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Otro: 0 } as Record<string, number>;
    let total = 0, count = 0, totalTax = 0, totalDiscount = 0;
    list.forEach((s: any) => {
      const m = s.paymentMethod || 'Otro';
      byMethod[m] = (byMethod[m] || 0) + (s.total || 0);
      total += s.total || 0;
      totalTax += s.tax || 0;
      totalDiscount += s.discount || 0;
      count += 1;
    });
    const avg = count ? total / count : 0;
    const movements = session.movements || [];
    const totalEntradas = movements.filter((m: any) => m.type === 'Entrada').reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
    const totalSalidas = movements.filter((m: any) => m.type === 'Salida').reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
    const expectedCash = (session.initialAmount || 0) + (byMethod['Efectivo'] || 0) + totalEntradas - totalSalidas;
    return { total, count, avg, totalTax, totalDiscount, byMethod, expectedCash, totalEntradas, totalSalidas };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.electronAPI) {
        if (editingSession) {
          const summary = summarizeSession(editingSession);
          await window.electronAPI.updateCashSession(editingSession.id, {
            ...newSession,
            endTime: new Date().toISOString(),
            status: 'Cerrada',
            expectedAmount: summary.expectedCash,
            difference: newSession.finalAmount - summary.expectedCash
          });
        } else {
          await window.electronAPI.createCashSession({
            ...newSession,
            startTime: new Date().toISOString(),
            status: 'Abierta'
          });
        }
        resetForm();
        loadCashSessions();
        loadSales();
      }
    } catch (error: any) {
      console.error('Error saving cash session:', error);
      if (error?.message === 'CASH_SESSION_ALREADY_OPEN') {
        alert('Ya hay una sesión abierta. Ciérrala antes de crear otra.');
        return;
      }
      if (error?.message === 'CASH_SESSION_ALREADY_CLOSED') {
        alert('Esta sesión ya está cerrada.');
        return;
      }
      if (error?.message === 'CASH_SESSION_NOT_FOUND') {
        alert('Sesión no encontrada. Refresca la lista.');
        return;
      }
      alert('Error al guardar la sesión de caja');
    }
  };

  const handleEdit = (session: any) => {
    setEditingSession(session);
    setNewSession({
      initialAmount: session.initialAmount,
      finalAmount: session.finalAmount || 0,
      notes: session.notes || ''
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setNewSession({ initialAmount: 0, finalAmount: 0, notes: '' });
    setEditingSession(null);
    setShowAddForm(false);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX');
  };

  const getStatusColor = (status: string) => {
    return status === 'Abierta' ? '#4caf50' : '#2196f3';
  };

  // Mejoras: utilidades y estados derivados
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [showCashCount, setShowCashCount] = useState(false);
  const [cashCount, setCashCount] = useState<Record<string, number>>({});
  const formatMoney = (n:number)=> '$' + (n||0).toFixed(2);
  const openSession = cashSessions.find((s:any)=> s.status === 'Abierta') || null;
  const filteredSessions = cashSessions.filter((s:any)=> {
    const d = new Date(s.startTime).toISOString().split('T')[0];
    return d >= dateFilter.startDate && d <= dateFilter.endDate;
  });
  const denominations = (() => {
    try {
      const d = localStorage.getItem('cashDenominations');
      if (d) return JSON.parse(d) as number[];
    } catch {}
    return [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  })();
  const countedCashTotal = denominations.reduce((sum, d)=> sum + d * (cashCount[String(d)]||0), 0);
  const setDenom = (den:number, val:number)=> {
    setCashCount(prev=> ({ ...prev, [String(den)]: Math.max(0, Math.floor(val)||0) }));
  };
  const useCountAsFinal = () => {
    const total = Number(countedCashTotal.toFixed(2));
    setNewSession(s=> ({ ...s, finalAmount: total }));
    if (!openSession || openSession.status !== 'Abierta') {
      alert('No hay sesión abierta.');
      return;
    }
    if (!window.electronAPI?.updateCashSession) {
      alert('IPC no disponible');
      return;
    }
    window.electronAPI.updateCashSession(openSession.id, { cashCount, cashCountTotal: total })
      .then(loadCashSessions)
      .catch((error: any) => {
        console.error('Error saving cash count:', error);
        alert('No se pudo guardar el arqueo');
      });
  };
  const resetMovementForm = () => {
    setMovementType('Entrada');
    setMovementAmount(0);
    setMovementNote('');
  };
  const showMovementToast = (msg: string) => {
    setMovementToast(msg);
    setTimeout(() => setMovementToast(null), 2000);
  };
  const addMovement = async () => {
    if (!openSession || openSession.status !== 'Abierta') {
      alert('No hay sesión abierta.');
      return;
    }
    if (!window.electronAPI?.updateCashSession) {
      alert('IPC no disponible');
      return;
    }
    if (!(movementAmount > 0)) {
      alert('El monto debe ser mayor a 0.');
      return;
    }
    const current = openSession.movements || [];
    const nextId = current.length ? Math.max(...current.map((m: any) => m.id || 0)) + 1 : 1;
    const movement = {
      id: nextId,
      type: movementType,
      amount: Number(movementAmount),
      note: movementNote ? movementNote.trim() : undefined,
      createdAt: new Date().toISOString()
    };
    try {
      await window.electronAPI.updateCashSession(openSession.id, { movements: [...current, movement] });
      resetMovementForm();
      await loadCashSessions();
      alert('Movimiento agregado');
    } catch (error) {
      console.error('Error adding movement:', error);
      alert('No se pudo agregar el movimiento');
    }
  };
  const removeMovement = async (movementId: number) => {
    if (!openSession || openSession.status !== 'Abierta') {
      alert('No hay sesión abierta.');
      return;
    }
    if (!window.electronAPI?.updateCashSession) {
      alert('IPC no disponible');
      return;
    }
    if (!confirm('¿Eliminar este movimiento?')) return;
    const current = openSession.movements || [];
    const nextMovements = current.filter((m: any) => m.id !== movementId);
    try {
      await window.electronAPI.updateCashSession(openSession.id, { movements: nextMovements });
      await loadCashSessions();
      showMovementToast('Movimiento eliminado');
    } catch (error) {
      console.error('Error removing movement:', error);
      alert('No se pudo eliminar el movimiento');
    }
  };
  const exportSessionCSV = (session:any)=> {
    const items = getSessionSales(session);
    const header = ['Fecha','ID Venta','ClienteID','Método','Subtotal','Descuento','Impuesto','Total'];
    const rows = items.map((s:any)=> [
      new Date(s.createdAt).toLocaleString('es-MX'),
      s.id,
      s.customerId || '',
      s.paymentMethod || 'Otro',
      (s.subtotal||0).toFixed(2),
      (s.discount||0).toFixed(2),
      (s.tax||0).toFixed(2),
      (s.total||0).toFixed(2)
    ]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corte_caja_${session.id||'sesion'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const printSession = (session:any)=> {
    const s = summarizeSession(session);
    const lines = getSessionSales(session).map((v:any)=> `• ${new Date(v.createdAt).toLocaleString('es-MX')} — ${v.paymentMethod||'Otro'} — ${formatMoney(v.total)}`).join('<br/>');
    const cashCountRows = Object.entries(session.cashCount || {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([den, qty]) => `${den}: ${qty}`)
      .join('<br/>');
    const cashCountSection = session.cashCountTotal !== undefined
      ? `<hr/><div><b>Arqueo</b></div><div>${cashCountRows || 'Sin denominaciones registradas'}</div><div><b>Total:</b> ${formatMoney(session.cashCountTotal || 0)}</div>`
      : '<hr/><div><b>Arqueo</b></div><div>Sin arqueo guardado</div>';
    const html = `
      <html><head><title>Corte de Caja</title>
      <style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding:16px} h2{margin:0 0 8px} .row{margin:4px 0}</style>
      </head><body>
      <h2>Reporte de Corte de Caja</h2>
      <div class="row"><b>Sesión:</b> ${session.id||'-'}</div>
      <div class="row"><b>Inicio:</b> ${new Date(session.startTime).toLocaleString('es-MX')}</div>
      <div class="row"><b>Fin:</b> ${session.endTime ? new Date(session.endTime).toLocaleString('es-MX') : '-'}</div>
      <hr/>
      <div class="row"><b>Total ventas:</b> ${formatMoney(s.total)} (${s.count} transacciones)</div>
      <div class="row"><b>Efectivo:</b> ${formatMoney(s.byMethod['Efectivo']||0)}</div>
      <div class="row"><b>Tarjeta:</b> ${formatMoney(s.byMethod['Tarjeta']||0)}</div>
      <div class="row"><b>Transferencia:</b> ${formatMoney(s.byMethod['Transferencia']||0)}</div>
      <div class="row"><b>Impuestos:</b> ${formatMoney(s.totalTax)}</div>
      <div class="row"><b>Descuentos:</b> ${formatMoney(s.totalDiscount)}</div>
      <div class="row"><b>Efectivo esperado:</b> ${formatMoney(s.expectedCash)}</div>
      ${session.finalAmount ? `<div class="row"><b>Efectivo reportado:</b> ${formatMoney(session.finalAmount)}</div>` : ''}
      ${session.finalAmount ? `<div class="row"><b>Diferencia:</b> ${formatMoney((session.finalAmount||0) - s.expectedCash)}</div>` : ''}
      ${cashCountSection}
      <hr/>
      <div><b>Ventas</b></div>
      <div>${lines || 'Sin ventas'}</div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  // Password gate for deleting sessions (uses dashboard password)
  const ADMIN_PASSWORD = resolveDashboardPassword();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePass, setDeletePass] = useState('');
  const [delAttempts, setDelAttempts] = useState(0);
  const DEL_ATTEMPT_LIMIT = 3;
  const DEL_COOLDOWN_MS = 30_000;
  const [delCooldownUntil, setDelCooldownUntil] = useState<number | null>(null);

  const askDelete = (session:any) => {
    setSessionToDelete(session);
    setDeletePass('');
    setShowDeleteModal(true);
    window.electronAPI?.logInfo?.('intento_eliminar_sesion_caja');
  };

  const confirmDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!sessionToDelete) return;
    if (delCooldownUntil && Date.now() < delCooldownUntil) return;
  if (deletePass === ADMIN_PASSWORD || deletePass === MASTER_ADMIN_PASSWORD) {
      try {
        const ok = await window.electronAPI.deleteCashSession(sessionToDelete.id);
        if (ok) {
          setShowDeleteModal(false);
          setSessionToDelete(null);
          setDeletePass('');
          setDelAttempts(0);
          await loadCashSessions();
          window.electronAPI?.logInfo?.('eliminar_sesion_caja_ok');
        } else {
          alert('No se pudo eliminar la sesión');
        }
      } catch (err) {
        console.error('Error deleting session:', err);
        alert('Error al eliminar la sesión');
      }
    } else {
      const next = delAttempts + 1;
      setDelAttempts(next);
      window.electronAPI?.logWarn?.('eliminar_sesion_caja_pwd_incorrecta');
      if (next >= DEL_ATTEMPT_LIMIT) {
        const until = Date.now() + DEL_COOLDOWN_MS;
        setDelCooldownUntil(until);
        setShowDeleteModal(false);
        setTimeout(() => { setDelAttempts(0); setDelCooldownUntil(null); }, DEL_COOLDOWN_MS + 50);
      }
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h1>💰 Corte de Caja</h1>
        <button 
          onClick={() => {
            if (openSession) {
              alert('Ya hay una sesión abierta. Ciérrala antes de crear otra.');
              return;
            }
            setShowAddForm(true);
            setEditingSession(null);
            setNewSession({ initialAmount: 0, finalAmount: 0, notes: '' });
            setShowCashCount(false);
            setCashCount({});
          }}
          style={{ 
            background: openSession ? '#9e9e9e' : '#4caf50', 
            color: '#fff', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
          disabled={!!openSession}
          title={openSession ? 'Ya hay una sesión abierta' : 'Abrir nueva sesión'}
        >
          + Nueva Sesión
        </button>
      </div>

      {openSession && (()=>{ const s = summarizeSession(openSession); return (
        <div style={{ marginBottom:16, padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fff', display:'grid', gridTemplateColumns:'1fr auto', gap:12 }}>
          <div>
            <div style={{ fontWeight:600 }}>Sesión abierta desde {new Date(openSession.startTime).toLocaleString('es-MX')}</div>
            <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
              <div>Inicial: <strong>{formatMoney(openSession.initialAmount)}</strong></div>
              <div>Efectivo: <strong>{formatMoney(s.byMethod['Efectivo']||0)}</strong></div>
              <div>Entradas: <strong>{formatMoney(s.totalEntradas)}</strong></div>
              <div>Salidas: <strong>{formatMoney(s.totalSalidas)}</strong></div>
              <div>Esperado: <strong>{formatMoney(s.expectedCash)}</strong></div>
              <div>Ventas: <strong>{s.count}</strong></div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=> setDetailSession(openSession)} style={{ padding:'8px 12px', border:'1px solid #2196f3', background:'#fff', color:'#2196f3', borderRadius:6, cursor:'pointer' }}>Ver detalle</button>
            <button onClick={()=> handleEdit(openSession)} style={{ padding:'8px 12px', border:'1px solid #d32f2f', background:'#fff', color:'#d32f2f', borderRadius:6, cursor:'pointer' }}>Cerrar ahora</button>
          </div>
        </div>
      ); })()}
      {openSession && openSession.status === 'Abierta' && (
        <div style={{ marginBottom:16, padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fff' }}>
          <h4 style={{ marginTop:0 }}>Movimientos</h4>
          <div style={{ display:'grid', gridTemplateColumns:'120px 140px 1fr auto auto', gap:8 }}>
            <select value={movementType} onChange={e => setMovementType(e.target.value as 'Entrada' | 'Salida')}>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
            <input type="number" min={0} step="0.01" value={movementAmount}
              onChange={e => setMovementAmount(Number(e.target.value) || 0)} placeholder="Monto" />
            <input type="text" value={movementNote} onChange={e => setMovementNote(e.target.value)} placeholder="Nota (opcional)" />
            <button type="button" onClick={addMovement}>Agregar movimiento</button>
            <button type="button" onClick={resetMovementForm}>Limpiar</button>
          </div>
          <div style={{ marginTop: 10 }}>
            {((openSession.movements || []).length === 0) ? (
              <div style={{ color: '#666' }}>Sin movimientos</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1.2fr 0.7fr 0.6fr 1fr auto', gap:8 }}>
                <div style={{ fontWeight:600 }}>Fecha/Hora</div>
                <div style={{ fontWeight:600 }}>Tipo</div>
                <div style={{ fontWeight:600 }}>Monto</div>
                <div style={{ fontWeight:600 }}>Nota</div>
                <div style={{ fontWeight:600 }}>Acción</div>
                {(openSession.movements || [])
                  .slice()
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((m: any) => (
                    <React.Fragment key={m.id}>
                      <div>{new Date(m.createdAt).toLocaleString('es-MX')}</div>
                      <div>{m.type}</div>
                      <div>{formatMoney(m.amount || 0)}</div>
                      <div>{m.note || '—'}</div>
                      <div>
                        <button type="button" onClick={() => removeMovement(m.id)}>Eliminar</button>
                      </div>
                    </React.Fragment>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtros por fecha */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14 }}>
        <label style={{ color:'#666' }}>Periodo:</label>
        <input type="date" value={dateFilter.startDate} onChange={e=> setDateFilter(p=> ({...p, startDate:e.target.value}))} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:6 }} />
        <span style={{ color:'#666' }}>a</span>
        <input type="date" value={dateFilter.endDate} onChange={e=> setDateFilter(p=> ({...p, endDate:e.target.value}))} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:6 }} />
      </div>

      {/* Formulario */}
      {showAddForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '520px', maxWidth:'90vw' }}>
            <h2>{editingSession ? 'Cerrar Sesión' : 'Nueva Sesión de Caja'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                  {editingSession ? 'Monto Inicial:' : 'Monto Inicial *:'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newSession.initialAmount}
                  onChange={(e) => setNewSession({...newSession, initialAmount: parseFloat(e.target.value) || 0})}
                  required
                  disabled={editingSession}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px',
                    background: editingSession ? '#f5f5f5' : 'white'
                  }}
                />
              </div>
              {editingSession && (
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Monto Final *:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSession.finalAmount}
                    onChange={(e) => setNewSession({...newSession, finalAmount: parseFloat(e.target.value) || 0})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              )}
              {editingSession && (
                <div style={{ marginBottom:12, border:'1px dashed #ddd', borderRadius:8 }}>
                  <button type="button" onClick={()=> setShowCashCount(v=>!v)} style={{ display:'block', width:'100%', textAlign:'left', background:'#fafafa', border:'none', borderBottom:'1px dashed #ddd', padding:'8px 10px', borderRadius:'8px 8px 0 0', cursor:'pointer' }}>
                    🧮 Arqueo de efectivo (opcional)
                  </button>
                  {showCashCount && (
                    <div style={{ padding:10 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
                        {denominations.map(den=> (
                          <div key={den} style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <label style={{ minWidth:58 }}>{den >= 1 ? `$${den}` : `${den}¢`}</label>
                            <input type="number" min={0} step={1} value={cashCount[String(den)]||0} onChange={e=> setDenom(den, Number(e.target.value)||0)} style={{ flex:1, padding:'6px 8px', border:'1px solid #ddd', borderRadius:6 }} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>Total contado: <strong>{formatMoney(countedCashTotal)}</strong></div>
                        <button type="button" onClick={useCountAsFinal} style={{ padding:'6px 10px', border:'1px solid #4caf50', background:'#fff', color:'#4caf50', borderRadius:6, cursor:'pointer' }}>Usar como monto final</button>
                      </div>
                      <div style={{ marginTop:8 }}>
                        {(denominations || []).filter(den => (cashCount[String(den)] || 0) > 0).length === 0 ? (
                          <div style={{ color:'#666' }}>Sin denominaciones registradas</div>
                        ) : (
                          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6 }}>
                            {(denominations || [])
                              .filter(den => (cashCount[String(den)] || 0) > 0)
                              .map(den => (
                                <React.Fragment key={den}>
                                  <div>{den >= 1 ? `$${den}` : `${den}¢`}</div>
                                  <div>{cashCount[String(den)]}</div>
                                </React.Fragment>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Notas:</label>
                <textarea
                  value={newSession.notes}
                  onChange={(e) => setNewSession({...newSession, notes: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
              {editingSession && (() => { const s = summarizeSession(editingSession); return (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '14px', 
                  background: '#fafafa', 
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0'
                }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                    <div><strong>Ventas Totales</strong><div>${s.total.toFixed(2)}</div></div>
                    <div><strong>Efectivo</strong><div>${(s.byMethod['Efectivo']||0).toFixed(2)}</div></div>
                    <div><strong>Tarjeta</strong><div>${(s.byMethod['Tarjeta']||0).toFixed(2)}</div></div>
                    <div><strong>Transferencia</strong><div>${(s.byMethod['Transferencia']||0).toFixed(2)}</div></div>
                    <div><strong>Entradas</strong><div>${s.totalEntradas.toFixed(2)}</div></div>
                    <div><strong>Salidas</strong><div>${s.totalSalidas.toFixed(2)}</div></div>
                  </div>
                  <div style={{ marginTop:'10px' }}>
                    <strong>Efectivo Esperado</strong>: ${s.expectedCash.toFixed(2)}
                    <span style={{ marginLeft:12, fontWeight:'bold', color:(newSession.finalAmount - s.expectedCash)===0? '#4caf50' : (newSession.finalAmount - s.expectedCash)>0 ? '#2e7d32' : '#d32f2f' }}>
                      Diferencia: ${(newSession.finalAmount - s.expectedCash).toFixed(2)}
                    </span>
                  </div>
                </div>
              ); })()}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ 
                    background: editingSession ? '#d32f2f' : '#4caf50', 
                    color: 'white', 
                    padding: '8px 16px', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  {editingSession ? 'Cerrar Sesión' : 'Abrir Sesión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de sesiones */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Fecha Inicio</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Fecha Fin</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Inicial</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Final</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Diferencia</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Estado</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((session) => (
              <tr key={session.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px' }}>{formatDateTime(session.startTime)}</td>
                <td style={{ padding: '12px' }}>
                  {session.endTime ? formatDateTime(session.endTime) : '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  ${session.initialAmount?.toFixed(2) || '0.00'}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>
                  ${session.finalAmount?.toFixed(2) || '-'}
                </td>
                <td style={{ 
                  padding: '12px', 
                  textAlign: 'right', 
                  fontWeight: 'bold',
                  color: session.difference > 0 ? '#4caf50' : session.difference < 0 ? '#d32f2f' : '#666'
                }}>
                  {session.difference !== undefined ? `$${session.difference.toFixed(2)}` : '-'}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: getStatusColor(session.status)
                  }}>
                    {session.status}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button 
                    onClick={() => setDetailSession(session)}
                    style={{ marginRight:'8px', padding: '4px 8px', border: '1px solid #2196f3', background: 'white', color: '#2196f3', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Ver detalle
                  </button>
                  {session.status === 'Abierta' && (
                    <button 
                      onClick={() => handleEdit(session)}
                      style={{ 
                        padding: '4px 8px', 
                        border: '1px solid #d32f2f', 
                        background: 'white', 
                        color: '#d32f2f', 
                        borderRadius: '4px', 
                        cursor: 'pointer' 
                      }}
                    >
                      Cerrar
                    </button>
                  )}
                  {session.status === 'Cerrada' && (
                    <button
                      onClick={() => askDelete(session)}
                      style={{ marginLeft:8, padding:'4px 8px', border:'1px solid #9e9e9e', background:'#fff', color:'#555', borderRadius:4, cursor:'pointer' }}
                      title="Eliminar sesión"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {movementToast && (
        <div style={{ position:'fixed', bottom:16, right:16, background:'#333', color:'#fff', padding:'8px 12px', borderRadius:8 }}>{movementToast}</div>
      )}

      {/* Modal de detalle */}
      {detailSession && (() => { const s = summarizeSession(detailSession); return (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001 }}>
          <div style={{ background:'#fff', borderRadius:8, padding:24, width:'min(860px, 94vw)', maxHeight:'90vh', overflow:'auto', border:'1px solid #e0e0e0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0 }}>📊 Detalle de Sesión</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=> exportSessionCSV(detailSession)} style={{ border:'1px solid #1976d2', color:'#1976d2', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Exportar CSV</button>
                <button onClick={()=> printSession(detailSession)} style={{ border:'1px solid #4caf50', color:'#4caf50', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Imprimir</button>
                {detailSession.status === 'Cerrada' && (
                  <button onClick={()=> askDelete(detailSession)} style={{ border:'1px solid #9e9e9e', color:'#555', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Eliminar</button>
                )}
                <button onClick={() => setDetailSession(null)} style={{ border:'none', background:'#eee', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Cerrar</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:16 }}>
              <div className="stat-card" style={{ padding:16 }}><div style={{color:'#6a6a6a'}}>Ventas Totales</div><div style={{fontWeight:700, fontSize:22}}>${s.total.toFixed(2)}</div></div>
              <div className="stat-card" style={{ padding:16 }}><div style={{color:'#6a6a6a'}}>Transacciones</div><div style={{fontWeight:700, fontSize:22}}>{s.count}</div></div>
              <div className="stat-card" style={{ padding:16 }}><div style={{color:'#6a6a6a'}}>Ticket Promedio</div><div style={{fontWeight:700, fontSize:22}}>${s.avg.toFixed(2)}</div></div>
              <div className="stat-card" style={{ padding:16 }}><div style={{color:'#6a6a6a'}}>Impuestos</div><div style={{fontWeight:700, fontSize:22}}>${s.totalTax.toFixed(2)}</div></div>
              <div className="stat-card" style={{ padding:16 }}><div style={{color:'#6a6a6a'}}>Descuentos</div><div style={{fontWeight:700, fontSize:22}}>${s.totalDiscount.toFixed(2)}</div></div>
            </div>
            <div style={{ margin:'12px 0 18px', padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fafafa' }}>
              <strong>Por método de pago</strong>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginTop:8 }}>
                <div>Efectivo: <strong>${(s.byMethod['Efectivo']||0).toFixed(2)}</strong></div>
                <div>Tarjeta: <strong>${(s.byMethod['Tarjeta']||0).toFixed(2)}</strong></div>
                <div>Transferencia: <strong>${(s.byMethod['Transferencia']||0).toFixed(2)}</strong></div>
                <div>Otro: <strong>${(s.byMethod['Otro']||0).toFixed(2)}</strong></div>
              </div>
            </div>
            <div style={{ padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fff', marginBottom:12 }}>
              <div><strong>Efectivo Esperado</strong>: ${s.expectedCash.toFixed(2)}</div>
              <div><strong>Efectivo Reportado</strong>: ${detailSession.finalAmount ? detailSession.finalAmount.toFixed(2) : 0}</div>
              <div style={{ marginTop:6, fontWeight:'bold', color:(detailSession.finalAmount - s.expectedCash)===0? '#4caf50' : (detailSession.finalAmount - s.expectedCash)>0 ? '#2e7d32' : '#d32f2f' }}>
                Diferencia: ${(detailSession.finalAmount - s.expectedCash).toFixed(2)}
              </div>
            </div>
            <div style={{ padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fff', marginBottom:12 }}>
              <div style={{ fontWeight:600, marginBottom:8 }}>🧮 Arqueo guardado</div>
              {detailSession.cashCountTotal !== undefined ? (
                <>
                  <div style={{ marginBottom:8 }}>Total: <strong>${formatMoney(detailSession.cashCountTotal || 0)}</strong></div>
                  {(Object.entries(detailSession.cashCount || {}).filter(([, qty]) => Number(qty) > 0).length === 0) ? (
                    <div style={{ color:'#666' }}>Sin denominaciones registradas</div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6 }}>
                      {Object.entries(detailSession.cashCount || {})
                        .filter(([, qty]) => Number(qty) > 0)
                        .map(([den, qty]) => (
                          <React.Fragment key={den}>
                            <div>{den}</div>
                            <div>{qty as any}</div>
                          </React.Fragment>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color:'#666' }}>Sin arqueo guardado</div>
              )}
            </div>
            <div style={{ padding:14, border:'1px solid #e0e0e0', borderRadius:8, background:'#fff' }}>
              <div style={{ fontWeight:600, marginBottom:8 }}>🧾 Ventas de la sesión</div>
              <div style={{ maxHeight:260, overflow:'auto' }}>
                {getSessionSales(detailSession).length === 0 ? (
                  <div style={{ color:'#666' }}>Sin ventas</div>
                ) : (
                  getSessionSales(detailSession).map((v:any)=> (
                    <div key={v.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, padding:'6px 0', borderBottom:'1px dashed #eee' }}>
                      <div style={{ fontSize:13 }}>{new Date(v.createdAt).toLocaleString('es-MX')}</div>
                      <div style={{ fontSize:13, color:'#555' }}>{v.paymentMethod||'Otro'}</div>
                      <div style={{ fontWeight:600 }}>${(v.total||0).toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ); })()}

      {/* Modal de contraseña para eliminar sesión */}
      {showDeleteModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1002 }}>
          <form onSubmit={confirmDelete} style={{ background:'#fff', padding:18, borderRadius:10, width:360, boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginTop:0, marginBottom:12 }}>🔒 Confirmar eliminación</h3>
            <div style={{ fontSize:13, color:'#666', marginBottom:8 }}>Ingresa la contraseña para eliminar esta sesión de caja.</div>
            <input type="password" value={deletePass} onChange={e=>setDeletePass(e.target.value)} placeholder="Contraseña" autoFocus disabled={!!(delCooldownUntil && Date.now()<delCooldownUntil)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:10 }} />
            {delAttempts>0 && delAttempts<DEL_ATTEMPT_LIMIT && !delCooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Intento fallido. Te quedan {DEL_ATTEMPT_LIMIT - delAttempts} intentos.</div>
            )}
            {delCooldownUntil && Date.now()<delCooldownUntil && (
              <div style={{ fontSize:12, color:'#d32f2f', marginBottom:10 }}>Demasiados intentos. Intenta nuevamente en {Math.max(0, Math.ceil((delCooldownUntil - Date.now())/1000))}s.</div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button type="button" onClick={()=> setShowDeleteModal(false)} style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Cancelar</button>
              <button type="submit" disabled={!!(delCooldownUntil && Date.now()<delCooldownUntil)} style={{ background:'#d32f2f', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Eliminar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// Componente de Reportes Avanzados
const Reports = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [selectedCashSessionId, setSelectedCashSessionId] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(()=> setToast(null), 2500); };
  // Estado para detalles de cliente
  const [detailsCustomer, setDetailsCustomer] = useState<any|null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [paymentFilter, setPaymentFilter] = useState<'Todos'|'Efectivo'|'Tarjeta'|'Transferencia'|'Otro'>('Todos');
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const isInvalidRange = dateRange.startDate > dateRange.endDate;
  const normalizeCashSessionId = (v: any): number | 'all' => {
    if (v === 'all' || v === null || v === undefined) return 'all';
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 'all';
  };

  useEffect(() => {
    loadData();
    loadReportPreferences();
  }, []);

  const loadReportPreferences = async () => {
    try {
      // Prefer backend settings
      if (window.electronAPI?.getSettings) {
        const rows = await window.electronAPI.getSettings();
        const map = Object.fromEntries(rows.map((r:any)=> [r.key, r.value]));
        const start = map['reports_date_start'];
        const end = map['reports_date_end'];
        const method = map['reports_payment_filter'] as any;
        const tab = map['reports_active_tab'];
        const pQuery = map['reports_product_query'];
        const cQuery = map['reports_customer_query'];
        const cashSessionRaw = map['reports_cash_session_id'];
        if (start && end) setDateRange({ startDate: start, endDate: end });
        if (method) setPaymentFilter(method);
        if (tab) setActiveTab(tab);
        if (typeof pQuery === 'string') setProductQuery(pQuery);
        if (typeof cQuery === 'string') setCustomerQuery(cQuery);
        if (cashSessionRaw !== undefined) {
          setSelectedCashSessionId(normalizeCashSessionId(cashSessionRaw));
        }
        // Mirror to localStorage
        try {
          const current = JSON.parse(localStorage.getItem('reportsSettings')||'{}');
          const normalizedCashSessionId = normalizeCashSessionId(cashSessionRaw ?? current.cashSessionId);
          localStorage.setItem('reportsSettings', JSON.stringify({
            ...current,
            startDate: start ?? current.startDate,
            endDate: end ?? current.endDate,
            paymentFilter: method ?? current.paymentFilter,
            activeTab: tab ?? current.activeTab,
            productQuery: typeof pQuery==='string'?pQuery:current.productQuery,
            customerQuery: typeof cQuery==='string'?cQuery:current.customerQuery,
            cashSessionId: normalizedCashSessionId
          }));
        } catch {}
        return;
      }
    } catch {}
    // Fallback: localStorage
    try {
      const rs = localStorage.getItem('reportsSettings');
      if (rs) {
        const v = JSON.parse(rs);
        if (v.startDate && v.endDate) setDateRange({ startDate: v.startDate, endDate: v.endDate });
        if (v.paymentFilter) setPaymentFilter(v.paymentFilter);
        if (v.activeTab) setActiveTab(v.activeTab);
        if (typeof v.productQuery==='string') setProductQuery(v.productQuery);
        if (typeof v.customerQuery==='string') setCustomerQuery(v.customerQuery);
        if (v.cashSessionId !== undefined) setSelectedCashSessionId(normalizeCashSessionId(v.cashSessionId));
      }
    } catch {}
  };

  const persistReportsLS = (patch: any) => {
    try {
      const cur = JSON.parse(localStorage.getItem('reportsSettings')||'{}');
      localStorage.setItem('reportsSettings', JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };

  const persistReportSetting = (key: string, value: string) => {
    try { window.electronAPI?.updateSetting?.(key, value); } catch {}
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        const [salesData, productsData, customersData] = await Promise.all([
          window.electronAPI.getSales(),
          window.electronAPI.getProducts(),
          window.electronAPI.getCustomers()
        ]);
        setSales(salesData);
        setProducts(productsData);
        setCustomers(customersData);
      }
      if (window.electronAPI?.getCashSessions) {
        try {
          const sessions = await window.electronAPI.getCashSessions();
          setCashSessions(sessions || []);
        } catch (error) {
          console.error('Error loading cash sessions:', error);
          setCashSessions([]);
        }
      } else {
        setCashSessions([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    const inRange = saleDate >= dateRange.startDate && saleDate <= dateRange.endDate;
    const method = sale.paymentMethod || 'Otro';
    const methodOk = paymentFilter === 'Todos' || method === paymentFilter;
    return inRange && methodOk;
  });
  
  // Serie diaria usando dominio de reportes
  const ingresosSeries = getIngresosPorPeriodoRpt(filteredSales as any, { startDate: dateRange.startDate, endDate: dateRange.endDate, granularity: 'day' });
  const series = ingresosSeries.map(p => ({ date: p.date, total: p.total }));
  const maxY = Math.max(1, ...series.map(p => p.total));

  const setQuickRange = (key: 'hoy'|'7d'|'30d'|'mes') => {
    const now = new Date();
    if (selectedCashSessionId !== 'all') {
      setSelectedCashSessionId('all');
      showToast('Sesión desactivada');
    }
    if (key === 'hoy') {
      const d = now.toISOString().split('T')[0];
      setDateRange({ startDate: d, endDate: d });
    } else if (key === '7d') {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = now.toISOString().split('T')[0];
      setDateRange({ startDate: start, endDate: end });
    } else if (key === '30d') {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = now.toISOString().split('T')[0];
      setDateRange({ startDate: start, endDate: end });
    } else if (key === 'mes') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m+1, 0).toISOString().split('T')[0];
      setDateRange({ startDate: start, endDate: end });
    }
  };

  const updateStartDate = (value: string) => {
    if (selectedCashSessionId !== 'all') {
      setSelectedCashSessionId('all');
      showToast('Sesión desactivada');
    }
    setDateRange(prev => {
      const startDate = value;
      const wasInvalid = startDate > prev.endDate;
      const endDate = wasInvalid ? startDate : prev.endDate;
      if (wasInvalid) showToast('Rango inválido: la fecha inicial no puede ser mayor que la final');
      return { startDate, endDate };
    });
  };

  const updateEndDate = (value: string) => {
    if (selectedCashSessionId !== 'all') {
      setSelectedCashSessionId('all');
      showToast('Sesión desactivada');
    }
    setDateRange(prev => {
      const endDate = value;
      const wasInvalid = endDate < prev.startDate;
      const startDate = wasInvalid ? endDate : prev.startDate;
      if (wasInvalid) showToast('Rango inválido: la fecha inicial no puede ser mayor que la final');
      return { startDate, endDate };
    });
  };

  const clearFilters = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateRange({ startDate: today, endDate: today });
    setQuickRange('hoy');
    setSelectedCashSessionId('all');
    setPaymentFilter('Todos');
    setActiveTab('general');
    setProductQuery('');
    setCustomerQuery('');
    showToast('Filtros limpiados');
  };

  // Persist on changes
  useEffect(()=>{
    if (!dateRange?.startDate || !dateRange?.endDate) return;
    persistReportsLS({ startDate: dateRange.startDate, endDate: dateRange.endDate });
    persistReportSetting('reports_date_start', dateRange.startDate);
    persistReportSetting('reports_date_end', dateRange.endDate);
  }, [dateRange]);

  useEffect(()=>{
    persistReportsLS({ paymentFilter });
    persistReportSetting('reports_payment_filter', String(paymentFilter));
  }, [paymentFilter]);

  useEffect(()=>{
    persistReportsLS({ activeTab });
    persistReportSetting('reports_active_tab', activeTab);
  }, [activeTab]);

  // Debounced persist for queries
  useEffect(()=>{
    persistReportsLS({ productQuery });
    const t = setTimeout(()=> persistReportSetting('reports_product_query', productQuery), 300);
    return ()=> clearTimeout(t);
  }, [productQuery]);
  useEffect(()=>{
    persistReportsLS({ customerQuery });
    const t = setTimeout(()=> persistReportSetting('reports_customer_query', customerQuery), 300);
    return ()=> clearTimeout(t);
  }, [customerQuery]);

  useEffect(()=>{
    const normalized = normalizeCashSessionId(selectedCashSessionId);
    persistReportsLS({ cashSessionId: normalized });
    persistReportSetting('reports_cash_session_id', String(normalized));
  }, [selectedCashSessionId]);

  useEffect(() => {
    if (selectedCashSessionId === 'all') return;
    const session = cashSessions.find(s => s.id === selectedCashSessionId);
    if (!session) {
      setSelectedCashSessionId('all');
      return;
    }
    const start = new Date(session.startTime).toISOString().slice(0, 10);
    const end = session.endTime ? new Date(session.endTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    setDateRange({ startDate: start, endDate: end });
  }, [selectedCashSessionId, cashSessions]);

  const exportSalesCSV = () => {
    if (isInvalidRange) {
      showToast('Rango inválido: la fecha inicial no puede ser mayor que la final');
      return;
    }
    const header = ['Fecha','ID Venta','ClienteID','Método','Subtotal','Descuento','Impuesto','Total'];
    const rows = filteredSales.map((s:any)=> [
      new Date(s.createdAt).toLocaleString('es-MX'),
      s.id,
      s.customerId || '',
      s.paymentMethod || 'Otro',
      (s.subtotal||0).toFixed(2),
      (s.discount||0).toFixed(2),
      (s.tax||0).toFixed(2),
      (s.total||0).toFixed(2)
    ]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sessionSuffix = selectedCashSessionId !== 'all' ? `_session_${selectedCashSessionId}` : '';
    a.download = `reporte_ventas_${dateRange.startDate}_a_${dateRange.endDate}${sessionSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV generado');
  };

  const exportProductsCSV = () => {
    const list = productSales;
    const header = ['Producto','Categoría','Cantidad','Ingresos'];
    const rows = list.map((p:any)=> [p.name, p.category, p.quantity, p.revenue.toFixed(2)]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'productos_top.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportCustomersCSV = () => {
    const list = getCustomerStatsSvc(filteredSales as any, customers);
    const header = ['Cliente','Compras','Total','Promedio','ÚltimaCompra'];
    const rows = list.map((c:any)=> [c.customer.name, c.purchases, c.total.toFixed(2), c.avgPurchase.toFixed(2), new Date(c.lastPurchase).toLocaleString('es-MX')]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes_top.csv'; a.click(); URL.revokeObjectURL(url);
  };

  // exportCategoriesCSV removido (no usado)

  const printReport = () => {
    if (isInvalidRange) {
      showToast('Rango inválido: la fecha inicial no puede ser mayor que la final');
      return;
    }
    const s = stats;
    const byMethod = filteredSales.reduce((acc:any, v:any)=> { const m = v.paymentMethod||'Otro'; acc[m]=(acc[m]||0)+(v.total||0); return acc; }, {});
    const sessionLine = selectedCashSessionId !== 'all' ? `<div class="row"><b>Sesión de caja:</b> #${selectedCashSessionId}</div>` : '';
    const html = `
      <html><head><title>Reporte</title>
      <style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding:16px} h2{margin:0 0 8px} .row{margin:4px 0}</style>
      </head><body>
      <h2>Reporte de Ventas</h2>
      ${sessionLine}
      <div class="row"><b>Periodo:</b> ${dateRange.startDate} a ${dateRange.endDate}</div>
      <div class="row"><b>Ventas Totales:</b> $${s.totalSales.toFixed(2)} (${s.totalTransactions} transacciones)</div>
      <div class="row"><b>Promedio:</b> $${s.avgSale.toFixed(2)} | <b>Descuentos:</b> $${s.totalDiscount.toFixed(2)} | <b>Impuestos:</b> $${s.totalTax.toFixed(2)}</div>
      <div class="row"><b>Por método:</b> Efectivo $${(byMethod['Efectivo']||0).toFixed(2)} · Tarjeta $${(byMethod['Tarjeta']||0).toFixed(2)} · Transferencia $${(byMethod['Transferencia']||0).toFixed(2)} · Otro $${(byMethod['Otro']||0).toFixed(2)}</div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      showToast('Error al imprimir');
      return;
    }
    showToast('Abriendo impresión…');
    w.document.write(html); w.document.close(); w.focus(); w.print(); w.close();
  };

  // Métricas mediante servicio de reportes
  const totalSales = getVentasTotalesRpt(filteredSales as any);
  const totalTax = getImpuestosTotalesRpt(filteredSales as any);
  const totalDiscount = getDescuentosTotalesRpt(filteredSales as any);
  const avgSale = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
  const productSales = getTopProductosRpt(filteredSales as any, products as any, 1000);

  // Stats de clientes desde servicio
  const getCustomerStats = () => getCustomerStatsSvc(filteredSales as any, customers);

  // const getCustomerDemographics = () => { /* no usado por ahora */ };

  // calculateAge, getAgeRange y extractCity removidos (no usados)

  // const getCategoryStats = () => { /* no usado por ahora */ };

  const stats = { totalSales, totalDiscount, totalTax, avgSale, totalTransactions: filteredSales.length };
  const customerStats = getCustomerStats();
  // demographics y categoryStats no se usan por ahora

  const tabStyle = (tabName: string) => ({
    padding: '12px 24px',
    background: activeTab === tabName ? 'linear-gradient(135deg, #2196f3, #1976d2)' : '#f5f5f5',
    color: activeTab === tabName ? 'white' : '#666',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    marginRight: '5px',
    transition: 'all 0.3s ease'
  });

  // Helpers específicos de Clientes
  const getCustomerTypeColor = (type: string) => getCustomerTypeColorSvc(type);

  const getStatsForCustomer = (id: number) => getStatsForCustomerSvc(id, sales as any, customers, products);
  const getWhatsAppLink = (phone?: string) => {
    const digits = phoneDigitsUtil(phone);
    if (!digits) return '';
    return `https://wa.me/${digits.startsWith('52') ? digits : `52${digits}`}`;
  };

  const recalcLevelFor = async (customer: any) => {
    try {
      const st = getStatsForCustomer(customer.id);
      const level = decideCustomerLevelFromTotal(st.total, customer.customerType);
      await window.electronAPI?.updateCustomer?.(customer.id, { customerType: level });
      showToast('Nivel actualizado');
      loadData();
    } catch {
      showToast('No se pudo actualizar');
    }
  };

  const handleEdit = (customer: any) => {
    console.log('Editar cliente', customer);
    showToast('Edición de cliente próximamente');
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI?.deleteCustomer?.(id);
      showToast('Cliente eliminado');
      loadData();
    } catch {
      showToast('No se pudo eliminar');
    }
  };

  const renderGeneralTab = () => (
    <div>
      {/* Resumen general */}
      <div className="lux-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', marginBottom:'30px' }}>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Ventas Totales</h3>
          <div className="stat-value" style={{ fontSize:'28px', fontWeight:600 }}>${stats.totalSales.toLocaleString()}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Periodo seleccionado</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Transacciones</h3>
          <div className="stat-value" style={{fontSize:'28px', fontWeight:600 }}>{stats.totalTransactions}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Comprobantes</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Venta Promedio</h3>
          <div className="stat-value" style={{ fontSize:'28px', fontWeight:600 }}>${stats.avgSale.toLocaleString()}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Ticket medio</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Descuentos</h3>
          <div className="stat-value" style={{ fontSize:'28px', fontWeight:600 }}>${stats.totalDiscount.toLocaleString()}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Aplicados</small>
        </div>
      </div>

      {/* Trend and Goal - Ingresos diarios */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16, marginBottom:18 }}>
        <div className="stat-card" style={{ padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <strong>Ingresos diarios</strong>
            <span style={{ color:'#6a6a6a', fontSize:12 }}>{series.length} días</span>
          </div>
          <svg viewBox={`0 0 300 80`} width="100%" height="80">
            <polyline fill="none" stroke="#2f6fed" strokeWidth="2" points={series.map((p, i)=> {
              const x = (300 * i) / Math.max(1, series.length-1);
              const y = 80 - (p.total / maxY) * 70 - 5;
              return `${x},${y}`;
            }).join(' ')} />
          </svg>
        </div>
      </div>

      {/* Productos más vendidos */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#2196f3', marginBottom: '15px' }}>🏆 Productos Más Vendidos</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <input placeholder="Buscar producto o categoría" value={productQuery} onChange={e=> setProductQuery(e.target.value)} style={{ flex:1, padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }} />
          <button onClick={exportProductsCSV} style={{ padding:'8px 12px', border:'1px solid #1976d2', background:'#fff', color:'#1976d2', borderRadius:8, cursor:'pointer' }}>Exportar CSV</button>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)' }}>
              <tr>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Producto</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Categoría</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Cantidad</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {productSales.filter((p:any)=> (
                  !productQuery || p.name.toLowerCase().includes(productQuery.toLowerCase()) || (p.category||'').toLowerCase().includes(productQuery.toLowerCase())
                )).slice(0, 10).map((product, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold' }}>{product.name}</td>
                  <td style={{ padding: '12px 15px' }}>{product.category}</td>
                  <td style={{ padding: '12px 15px', textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>{product.quantity}</td>
                  <td style={{ padding: '12px 15px', textAlign: 'right', fontWeight: 'bold', color: '#2196f3' }}>${product.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomersTab = () => (
    <div>
      {/* Top clientes */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#4caf50', marginBottom: '15px' }}>👥 Mejores Clientes</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          <input placeholder="Buscar cliente (nombre, email, tel)" value={customerQuery} onChange={e=> setCustomerQuery(e.target.value)} style={{ flex:1, padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }} />
          <button onClick={exportCustomersCSV} style={{ padding:'8px 12px', border:'1px solid #2e7d32', background:'#fff', color:'#2e7d32', borderRadius:8, cursor:'pointer' }}>Exportar CSV</button>
        </div>
        <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)' }}>
              <tr>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Cliente</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Contacto</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Perfil</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Compras</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Total Gastado</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Promedio</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Última Compra</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filterCustomerStatsSvc(customerStats as any, customerQuery).slice(0, 10).map((stat, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '15px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{stat.customer.name}</div>
                      {stat.customer.occupation && (
                        <div style={{ fontSize: '12px', color: '#666' }}>{stat.customer.occupation}</div>
                      )}
                      {stat.customer.email && (
                        <div style={{ fontSize: '11px', color: '#999' }}>{stat.customer.email}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ fontSize: '14px' }}>
                      {stat.customer.email && <div>📧 {stat.customer.email}</div>}
                      {stat.customer.phone && <div>📞 {stat.customer.phone}</div>}
                      {stat.customer.preferredContact && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          Prefiere: {stat.customer.preferredContact}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'white',
                        background: getCustomerTypeColor(stat.customer.customerType || 'Particular'),
                        marginRight: '5px'
                      }}>
                        {stat.customer.customerType || 'Particular'}
                      </span>
                      {stat.customer.budgetRange && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          Presupuesto: {stat.customer.budgetRange}
                        </div>
                      )}
                      {stat.customer.gender && (
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          {stat.customer.gender}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>{stat.purchases}</td>
                  <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#2196f3' }}>${stat.total.toLocaleString()}</td>
                  <td style={{ padding: '15px', textAlign: 'right', color: '#666' }}>${stat.avgPurchase.toLocaleString()}</td>
                  <td style={{ padding: '15px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                    {new Date(stat.lastPurchase).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'center' }}>
                    {getWhatsAppLink(stat.customer.phone) && (
                      <a
                        href={getWhatsAppLink(stat.customer.phone)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          marginRight: '8px',
                          padding: '6px 12px',
                          border: '1px solid #25D366',
                          background: 'white',
                          color: '#25D366',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          textDecoration: 'none',
                          display: 'inline-block',
                        }}
                      >
                        WhatsApp
                      </a>
                    )}
                    <button 
                      onClick={() => setDetailsCustomer(stat.customer)}
                      style={{ 
                        marginRight: '8px', 
                        padding: '6px 12px', 
                        border: '1px solid #4caf50', 
                        background: 'white', 
                        color: '#4caf50', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      📄 Detalles
                    </button>
                    <button 
                      onClick={() => handleEdit(stat.customer)}
                      style={{ 
                        marginRight: '8px', 
                        padding: '6px 12px', 
                        border: '1px solid #2196f3', 
                        background: 'white', 
                        color: '#2196f3', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => recalcLevelFor(stat.customer)}
                      style={{ 
                        marginRight: '8px', 
                        padding: '6px 12px', 
                        border: '1px solid #9c27b0', 
                        background: 'white', 
                        color: '#9c27b0', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                      title="Recalcular nivel automáticamente basado en historial de compras"
                    >
                      🔄 Auto
                    </button>
                    <button 
                      onClick={() => handleDelete(stat.customer.id)}
                      style={{ 
                        padding: '6px 12px', 
                        border: '1px solid #d32f2f', 
                        background: 'white', 
                        color: '#d32f2f', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      {/* Fin Top clientes */}
      {detailsCustomer && (
        <CustomerDetailsModal
          customer={detailsCustomer}
          stats={getStatsForCustomer(detailsCustomer.id)}
          onClose={() => setDetailsCustomer(null)}
        />
      )}
    </div>
  );

  // UI principal de Reportes con tabs
  const canUseCashSessions = !!window.electronAPI?.getCashSessions;
  const formatSessionLabel = (session: any) => {
    const start = new Date(session.startTime).toLocaleString('es-MX');
    const end = session.endTime ? new Date(session.endTime).toLocaleString('es-MX') : 'Abierta';
    return `#${session.id} · ${start} → ${end}`;
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📈 Reportes</h1>
      {/* Filtros rápidos */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <input type="date" value={dateRange.startDate} onChange={e=> updateStartDate(e.target.value)} />
        <span>→</span>
        <input type="date" value={dateRange.endDate} onChange={e=> updateEndDate(e.target.value)} />
        <select value={paymentFilter} onChange={e=> setPaymentFilter(e.target.value as any)}>
          <option>Todos</option>
          <option>Efectivo</option>
          <option>Tarjeta</option>
          <option>Transferencia</option>
          <option>Otro</option>
        </select>
        <button onClick={()=> setQuickRange('hoy')}>Hoy</button>
        <button onClick={()=> setQuickRange('7d')}>7 días</button>
        <button onClick={()=> setQuickRange('30d')}>30 días</button>
        <button onClick={()=> setQuickRange('mes')}>Este mes</button>
        <label style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span>Sesión de caja</span>
          <select
            value={String(selectedCashSessionId)}
            onChange={(e) => {
              if (!canUseCashSessions) {
                showToast('IPC no disponible');
                return;
              }
              const next = e.target.value === 'all' ? 'all' : Number(e.target.value);
              setSelectedCashSessionId(Number.isFinite(next as number) ? (next as number) : 'all');
            }}
            disabled={!canUseCashSessions}
          >
            <option value="all">Todas</option>
            {cashSessions.map((session:any) => (
              <option key={session.id} value={session.id}>{formatSessionLabel(session)}</option>
            ))}
          </select>
        </label>
        <button onClick={clearFilters}>Limpiar filtros</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={exportSalesCSV} disabled={isLoading || isInvalidRange}>Exportar ventas</button>
          <button onClick={printReport} disabled={isLoading || isInvalidRange}>Imprimir</button>
        </div>
      </div>
      {selectedCashSessionId !== 'all' && (
        <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
          Filtrando por sesión #{selectedCashSessionId}
        </div>
      )}
      {isLoading && <div style={{ marginBottom: 12, color: '#666' }}>Cargando…</div>}
      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:0 }}>
        <button style={tabStyle('general')} onClick={()=> setActiveTab('general')}>General</button>
        <button style={tabStyle('clientes')} onClick={()=> setActiveTab('clientes')}>Clientes</button>
      </div>
      <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderTop:'none', borderRadius:'0 8px 8px 8px', padding:16 }}>
        {activeTab==='general' ? renderGeneralTab() : renderCustomersTab()}
      </div>
      {toast && (
        <div style={{ position:'fixed', bottom:16, right:16, background:'#333', color:'#fff', padding:'8px 12px', borderRadius:8 }}>{toast}</div>
      )}
    </div>
  );
};

// Modal de detalles de cliente
type CustomerDetailsModalProps = { customer: any; onClose: () => void; stats: any };
const CustomerDetailsModal = ({ customer, onClose, stats }: CustomerDetailsModalProps) => {
  const phoneDigits = phoneDigitsUtil(customer.phone);
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits.startsWith('52') ? phoneDigits : `52${phoneDigits}`}`
    : '';
  const telLink = customer.phone ? `tel:${customer.phone}` : '';
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:24, width:'min(900px, 92vw)', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 style={{ margin:0 }}>🧑‍💼 {customer.name}</h2>
          <button onClick={onClose} style={{ border:'1px solid #ddd', background:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>Cerrar</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:16 }}>
          <div className="stat-card"><div className="stat-value">{stats.purchases}</div><small>Compras</small></div>
          <div className="stat-card"><div className="stat-value">{'$' + stats.total.toLocaleString()}</div><small>Total gastado</small></div>
          <div className="stat-card"><div className="stat-value">{'$' + stats.avg.toLocaleString()}</div><small>Ticket promedio</small></div>
          <div className="stat-card"><div className="stat-value">{stats.lastPurchase ? new Date(stats.lastPurchase).toLocaleDateString('es-MX') : '-'}</div><small>Última compra</small></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <h3 style={{ marginTop:0 }}>📞 Contacto</h3>
            <div style={{ fontSize:14 }}>
              {customer.email && <div>📧 {customer.email}</div>}
              {customer.phone && <div>📞 {customer.phone}</div>}
              {customer.alternatePhone && <div>📱 {customer.alternatePhone}</div>}
              {customer.address && <div style={{ marginTop:6 }}>📍 {customer.address}</div>}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              {waLink && <a href={waLink} target="_blank" rel="noreferrer" style={{ padding:'8px 10px', border:'1px solid #25D366', color:'#25D366', borderRadius:6, textDecoration:'none' }}>WhatsApp</a>}
              {telLink && <a href={telLink} style={{ padding:'8px 10px', border:'1px solid #2196f3', color:'#2196f3', borderRadius:6, textDecoration:'none' }}>Llamar</a>}
              {customer.email && <a href={`mailto:${customer.email}`} style={{ padding:'8px 10px', border:'1px solid #6c63ff', color:'#6c63ff', borderRadius:6, textDecoration:'none' }}>Email</a>}
            </div>
          </div>
          <div style={{ background:'#fafafa', border:'1px solid #eee', borderRadius:10, padding:12 }}>
            <h3 style={{ marginTop:0 }}>🏷️ Top categorías</h3>
            {stats.topCategories.length===0 ? <div style={{ color:'#666' }}>Sin datos</div> : (
              <ul style={{ margin:0, paddingLeft:18 }}>
                {stats.topCategories.map(([cat, cnt]:any)=> (
                  <li key={cat}>{cat} · {cnt}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div style={{ marginTop:16, background:'#fff', border:'1px solid #eee', borderRadius:10, padding:12 }}>
          <h3 style={{ marginTop:0 }}>🧾 Ventas recientes</h3>
          {stats.recent.length===0 ? <div style={{ color:'#666' }}>Sin ventas</div> : (
            <div style={{ maxHeight:230, overflow:'auto' }}>
              {stats.recent.map((s:any)=> (
                <div key={s.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', padding:'6px 0', borderBottom:'1px dashed #eee' }}>
                  <div style={{ fontSize:13 }}>{new Date(s.createdAt).toLocaleString('es-MX')}</div>
                  <div style={{ fontWeight:600 }}>{'$' + s.total.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Página Clientes migrada a presentación
const Customers = () => <ClientesPage />;

// Página Configuración migrada a presentación
const Settings = () => <ConfiguracionPage />;

function App() {
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');
  const [nightMode, setNightMode] = useState<boolean>(() => {
    try { const s = localStorage.getItem('systemSettings'); if (s) return !!JSON.parse(s).nightMode; } catch {}
    return false;
  });

  // Sync with changes done in Settings via storage events
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'systemSettings' && e.newValue) {
        try { const v = JSON.parse(e.newValue); setNightMode(!!v.nightMode); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [currentView]);

  console.log('🚀 Vangelico - App component rendering...', { currentView, nightMode });

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'sales':
        return <VentasPage />;
      case 'products':
        return (
          <AccessGate area="products">
            <ProductosPage />
          </AccessGate>
        );
      case 'inventory':
        return <InventarioPage />;
      case 'customers':
        return <Customers />;
      case 'cash-session':
        return <CashSession />;
      case 'reports':
        return (
          <AccessGate area="reports">
            <Reports />
          </AccessGate>
        );
      
      case 'settings':
        return (
          <AccessGate area="settings">
            <Settings />
          </AccessGate>
        );
      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    { id: 'dashboard' as CurrentView, label: 'Dashboard', icon: '📊' },
    { id: 'sales' as CurrentView, label: 'Ventas', icon: '🛒' },
    { id: 'products' as CurrentView, label: 'Productos', icon: '📦' },
  { id: 'inventory' as CurrentView, label: 'Inventario', icon: '🏷️' },
    { id: 'customers' as CurrentView, label: 'Clientes', icon: '👥' },
    { id: 'cash-session' as CurrentView, label: 'Corte de Caja', icon: '💰' },
  
    { id: 'reports' as CurrentView, label: 'Reportes', icon: '📈' },
    { id: 'settings' as CurrentView, label: 'Configuración', icon: '⚙️' }
  ];

  return (
    <div className={`app-shell jewelry-theme ${nightMode ? 'night' : ''}`} style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden' }}>
      <div className="luxury-sidebar" style={{ width:'clamp(240px,18vw,300px)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'32px 30px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="sidebar-brand" style={{ margin:0, fontSize:'28px', fontWeight:600 }}>Vangelico</h2>
          <div style={{ marginTop:'10px', fontSize:'13px', letterSpacing:'.5px', color:'#c5ced8' }}>Sistema POS Profesional</div>
        </div>
        <nav style={{ flex:1, padding:'22px 0 28px' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={()=>setCurrentView(item.id)}
              className={`nav-button ${currentView===item.id ? 'active' : ''}`}
              style={{
                width:'100%', border:'none', background:'transparent', color:'#d7dde4',
                display:'flex', alignItems:'center', gap:'16px', padding:'14px 30px 14px 34px',
                fontSize:'15px', cursor:'pointer', transition:'var(--transition)',
                fontFamily:'var(--font-sans)', position:'relative'
              }}>
              <span style={{ fontSize:'22px', filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>{item.icon}</span>
              <span style={{ fontWeight: currentView===item.id ? 600:500 }}>{item.label}</span>
              {currentView===item.id && <span style={{ marginLeft:'auto', fontSize:'11px', letterSpacing:'2px', color:'var(--gold)' }}>ACTIVO</span>}
            </button>
          ))}
        </nav>
        <div style={{ padding:'22px 32px 30px', fontSize:'12px', letterSpacing:'.5px', color:'#9aa4b1', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          <div>Versión 1.0.0</div>
          <div style={{ marginTop:'4px' }}>© 2025 Vangelico</div>
        </div>
      </div>
      <div className="main-content luxury-main" style={{ flex:1, overflow:'auto', minWidth:0, display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', width:'100%', maxWidth:'1920px', margin:'0 auto', alignSelf:'stretch' }}>
        {renderCurrentView()}
        </div>
      </div>
    </div>
  );
}

export default App;
