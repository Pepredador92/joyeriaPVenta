import React, { useState, useEffect } from 'react';
import './App.css';

// Declarar tipos para la API de Electron
declare global {
  interface Window {
    electronAPI: {
      getProducts: () => Promise<any[]>;
      createProduct: (productData: any) => Promise<any>;
      updateProduct: (id: number, productData: any) => Promise<any>;
      deleteProduct: (id: number) => Promise<boolean>;
      getCustomers: () => Promise<any[]>;
      createCustomer: (customerData: any) => Promise<any>;
      updateCustomer: (id: number, customerData: any) => Promise<any>;
      deleteCustomer: (id: number) => Promise<boolean>;
      getSales: () => Promise<any[]>;
      createSale: (saleData: any) => Promise<any>;
      getCashSessions: () => Promise<any[]>;
      createCashSession: (sessionData: any) => Promise<any>;
      updateCashSession: (id: number, sessionData: any) => Promise<any>;
      getSettings: () => Promise<any[]>;
      updateSetting: (key: string, value: string) => Promise<any>;
  // Logging helpers (optional)
  logInfo?: (msg: string) => Promise<void>;
  logWarn?: (msg: string) => Promise<void>;
    };
  }
}

type CurrentView = 'dashboard' | 'sales' | 'products' | 'customers' | 'cash-session' | 'reports' | 'settings';

const Dashboard = () => {
  const [stats, setStats] = useState({
    salesToday: 0,
    totalProducts: 0,
    totalCustomers: 0,
    salesCount: 0
  });

  // Privacy/masking state
  const ADMIN_DASHBOARD_PASSWORD = (typeof localStorage !== 'undefined' && localStorage.getItem('dashboardPassword')) || '080808';
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
    if (passwordInput === ADMIN_DASHBOARD_PASSWORD) {
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
  const floorDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const getRange = (): { start: Date; end: Date } => {
    const today = floorDate(new Date());
    switch (rangeKind) {
      case 'hoy': return { start: today, end: addDays(today, 1) };
      case '7d': return { start: addDays(today, -6), end: addDays(today, 1) };
      case '30d': return { start: addDays(today, -29), end: addDays(today, 1) };
      case 'mes': return { start: startOfMonth(today), end: addDays(today, 1) };
      case 'custom': {
        const s = new Date(customStart + 'T00:00:00');
        const e = addDays(new Date(customEnd + 'T00:00:00'), 1);
        return { start: s, end: e };
      }
      default: return { start: today, end: addDays(today, 1) };
    }
  };

  const { start, end } = getRange();
  const filteredSales = sales.filter((s:any)=> {
    const d = new Date(s.createdAt);
    return d >= start && d < end;
  });

  const kpis = (() => {
    const total = filteredSales.reduce((sum:number, s:any)=> sum + (s.total||0), 0);
    const count = filteredSales.length;
    const avg = count ? total / count : 0;
    const byMethod: Record<string, number> = {};
    filteredSales.forEach((s:any)=> {
      const m = s.paymentMethod || 'Otro';
      byMethod[m] = (byMethod[m]||0) + (s.total||0);
    });
    return { total, count, avg, byMethod };
  })();

  // Trend (daily totals within range up to 30 pts)
  const buildDailySeries = () => {
    const days = Math.min(30, Math.ceil((end.getTime()-start.getTime())/86400000));
    const series: { date: Date; total: number }[] = [];
    for (let i=0; i<days; i++) {
      const d0 = addDays(start, i);
      const d1 = addDays(start, i+1);
      const t = sales.reduce((sum:number, s:any)=> {
        const d = new Date(s.createdAt);
        return (d>=d0 && d<d1) ? sum + (s.total||0) : sum;
      }, 0);
      series.push({ date: d0, total: t });
    }
    return series;
  };
  const series = buildDailySeries();
  const maxY = Math.max(1, ...series.map(p=>p.total));

  // Top categorías (por ingresos)
  const topCategorias = (() => {
    const map = new Map<string, number>();
    filteredSales.forEach((s:any)=> {
      (s.items||[]).forEach((it:any)=> {
        let cat = 'Otros';
        if (it.productId && it.productId !== 0) {
          const p = products.find(pr=> pr.id === it.productId);
          cat = p?.category || 'Otros';
        } else if (s.notes && typeof s.notes === 'string') {
          const m = s.notes.match(/Categoría:\s*([^|]+)/i);
          if (m) cat = m[1].trim();
        }
        map.set(cat, (map.get(cat)||0) + (it.subtotal || 0));
      });
    });
    return Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,5);
  })();

  // Low stock
  const lowStock = products.filter(p=> (p.stock??0) > 0 && (p.stock??0) < 10).sort((a,b)=> a.stock-b.stock).slice(0,6);

  // Top clientes
  const topClientes = (()=> {
    const byCustomer = new Map<number, { customer:any, total:number }>();
    filteredSales.forEach((s:any)=> {
      if (!s.customerId) return;
      const c = customers.find(cc=> cc.id === s.customerId);
      if (!c) return;
      const cur = byCustomer.get(s.customerId) || { customer: c, total: 0 };
      cur.total += (s.total||0);
      byCustomer.set(s.customerId, cur);
    });
    return Array.from(byCustomer.values()).sort((a,b)=> b.total-a.total).slice(0,5);
  })();

  // New vs recurrentes en el rango
  const newVsReturning = (()=>{
    let nuevos = 0, recurrentes = 0;
    const startTs = start.getTime();
    const salesByCustomer = new Map<number, number[]>();
    sales.forEach((s:any)=> { if (s.customerId) {
      const arr = salesByCustomer.get(s.customerId) || [];
      arr.push(new Date(s.createdAt).getTime());
      salesByCustomer.set(s.customerId, arr);
    }});
    const idsInRange = new Set<number>();
    filteredSales.forEach((s:any)=> { if (s.customerId) idsInRange.add(s.customerId); });
    idsInRange.forEach(id=> {
      const arr = (salesByCustomer.get(id)||[]).filter(ts=> ts < startTs);
      if (arr.length === 0) nuevos++; else recurrentes++;
    });
    return { nuevos, recurrentes };
  })();

  // Sesión de caja
  const openSession = (cashSessions||[]).find((s:any)=> s.status === 'Abierta') || null;

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
            {[...sales].sort((a:any,b:any)=> new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,10).map((s:any)=> (
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
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button type="button" onClick={()=>setShowPasswordModal(false)} style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Cancelar</button>
              <button type="submit" disabled={!!(cooldownUntil && Date.now()<cooldownUntil)} style={{ background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', cursor:'pointer' }}>Desbloquear</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const Sales = () => {
  type OrderItem = {
    id: number;
    type: 'product' | 'manual';
    productId?: number;
    name: string;
    category?: string;
    unitPrice: number;
    quantity: number;
    notes?: string;
  };

  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerQuery, setCustomerQuery] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo'|'Tarjeta'|'Transferencia'>(() => {
    try {
      const sys = localStorage.getItem('systemSettings');
      if (sys) {
        const parsed = JSON.parse(sys);
        if (parsed.defaultPaymentMethod) return parsed.defaultPaymentMethod;
      }
    } catch {}
    return 'Efectivo';
  });

  const [quickSale, setQuickSale] = useState({
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'Anillos',
    cantidad: 1,
    precioUnitario: 0,
    notas: ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Configuración de descuentos/IVA (sin dependencias nuevas)
  const [discountMap, setDiscountMap] = useState<{[k:string]: number}>({ Bronze: 0, Silver: 0.05, Gold: 0.08, Platinum: 0.12 });
  const [taxRate, setTaxRate] = useState(0.16);

  useEffect(() => {
    loadData();
    try {
      const dl = localStorage.getItem('discountLevels');
      if (dl) {
        const parsed = JSON.parse(dl);
        setDiscountMap({
          Bronze: (parsed.Bronze ?? 0) / 100,
          Silver: (parsed.Silver ?? 5) / 100,
          Gold: (parsed.Gold ?? 8) / 100,
          Platinum: (parsed.Platinum ?? 12) / 100
        });
      }
    } catch {}
    try {
      const bs = localStorage.getItem('businessSettings');
      if (bs) {
        const parsed = JSON.parse(bs);
        if (typeof parsed.taxRate === 'number') setTaxRate((parsed.taxRate || 16) / 100);
      }
    } catch {}
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then((rows:any[]) => {
        const tax = rows?.find(r => r.key === 'tax_rate');
        if (tax && !Number.isNaN(parseFloat(tax.value))) {
          setTaxRate(parseFloat(tax.value)); // ya como 0.16
        }
      }).catch(()=>{});
    }
  }, []);

  const loadData = async () => {
    try {
      if (!window.electronAPI) return;
      const [productsData, customersData, salesData] = await Promise.all([
        window.electronAPI.getProducts(),
        window.electronAPI.getCustomers(),
        window.electronAPI.getSales()
      ]);
      setProducts(productsData);
      setCustomers(customersData);
      setRecentSales([...salesData].sort((a:any,b:any)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,10));
    } catch (e) {
      console.error('Error loading sales data:', e);
    }
  };

  // Productos → agregar al pedido
  const addProductToOrder = (product:any) => {
    if (product.stock <= 0) return;
    setOrderItems(prev => {
      const found = prev.find(i => i.type==='product' && i.productId===product.id);
      if (found) return prev.map(i => i===found ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, {
        id: Date.now()+Math.floor(Math.random()*1000),
        type: 'product',
        productId: product.id,
        name: product.name,
        category: product.category,
        unitPrice: product.price,
        quantity: 1
      }];
    });
  };

  // Venta rápida → agrega línea manual
  const submitQuickSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSale.cantidad < 1 || quickSale.precioUnitario <= 0) {
      alert('Cantidad y precio deben ser mayores a 0');
      return;
    }
    setOrderItems(prev => ([
      ...prev,
      {
        id: Date.now(),
        type: 'manual',
        name: `Venta rápida · ${quickSale.categoria}`,
        category: quickSale.categoria,
        unitPrice: Number(quickSale.precioUnitario) || 0,
        quantity: Math.floor(quickSale.cantidad) || 1,
        notes: quickSale.notas?.trim() || ''
      }
    ]));
    setQuickSale({ fecha: new Date().toISOString().split('T')[0], categoria: quickSale.categoria, cantidad: 1, precioUnitario: 0, notas: '' });
  };

  // Edición de líneas
  const removeItem = (id:number) => setOrderItems(prev => prev.filter(i => i.id !== id));
  const updateQty = (id:number, qty:number) => setOrderItems(prev => prev.map(i => i.id===id ? { ...i, quantity: Math.max(1, Math.floor(qty)||1) } : i));
  const updatePriceManual = (id:number, price:number) => setOrderItems(prev => prev.map(i => i.id===id ? { ...i, unitPrice: Math.max(0, Number(price)||0) } : i));

  // Cliente filtrado
  const filteredCustomers = customers.filter((c:any) => {
    const raw = customerQuery.trim();
    if (!raw) return true;
    const q = raw.toLowerCase();
    const qDigits = raw.replace(/\D+/g,'');
    const idMatch = String(c.id).includes(raw);
    const nameMatch = (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q);
    const phones = [c.phone, c.alternatePhone].filter(Boolean) as string[];
    const phoneMatch = qDigits.length>0 && phones.some(p => p.replace(/\D+/g,'').includes(qDigits));
    return idMatch || nameMatch || phoneMatch;
  }).slice(0, 50);

  // Totales
  const subtotal = orderItems.reduce((s,i)=> s + i.unitPrice * i.quantity, 0);
  const discountRate = selectedCustomer ? (discountMap[selectedCustomer.discountLevel] || 0) : 0;
  const discount = +(subtotal * discountRate).toFixed(2);
  const tax = +(((subtotal - discount) * taxRate)).toFixed(2);
  const total = +(subtotal - discount + tax).toFixed(2);

  const confirmOrder = async () => {
    if (orderItems.length === 0) return;
    // Validación: requerir cliente si está activo en configuración
    try {
      const sys = localStorage.getItem('systemSettings');
      if (sys) {
        const parsed = JSON.parse(sys);
        if (parsed.requireCustomerForSale && !selectedCustomer) {
          alert('Debes seleccionar un cliente para confirmar la venta');
          return;
        }
      }
    } catch {}
    try {
      const items = orderItems.map(i => ({
        productId: i.type==='product' ? (i.productId||0) : 0,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: +(i.unitPrice * i.quantity).toFixed(2)
      }));
      const manualNotes = orderItems.filter(i=> i.type==='manual').map(i=> `Categoría: ${i.category}${i.notes ? ' | '+i.notes : ''}`);
      const saleData = {
        customerId: selectedCustomer?.id || undefined,
        paymentMethod,
        subtotal,
        discount,
        tax,
        total,
        items,
        notes: manualNotes.join(' || ') || undefined,
        createdAt: new Date().toISOString()
      } as any;
      await window.electronAPI.createSale(saleData);
      setOrderItems([]);
      setSelectedCustomer(null);
      setCustomerQuery('');
      loadData();
      alert('Compra confirmada y guardada');
    } catch (e) {
      console.error('Error al confirmar compra:', e);
      alert('Error al confirmar la compra');
    }
  };
  const cancelOrder = () => setOrderItems([]);

  const filteredProducts = products.filter((p:any) =>
    (p.name||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding:'30px', display:'grid', gridTemplateColumns:'1fr 420px', gap:'30px', minHeight:'100vh' }}>
      {/* Izquierda: catálogo + venta rápida */}
      <div style={{ background:'#fff', borderRadius:15, padding:25, boxShadow:'0 8px 30px rgba(0,0,0,0.08)' }}>
        <h1 style={{ color:'#1a202c', fontSize:'2.0rem', fontWeight:700, margin:'0 0 18px', textAlign:'center', borderBottom:'3px solid #4299e1', paddingBottom:12 }}>
          🛒 Ventas
        </h1>
        <div style={{ marginBottom:18 }}>
          <input type="text" placeholder="🔍 Buscar productos por nombre o SKU…" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
            style={{ width:'100%', padding:'14px 16px', border:'2px solid #e2e8f0', borderRadius:12, background:'#f7fafc' }} />
        </div>
        {/* Venta rápida */}
        <div style={{ marginBottom: 18, padding: 14, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fafafa' }}>
          <h3 style={{ margin: 0 }}>Nueva Venta</h3>
          <form onSubmit={submitQuickSale} style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginTop:10 }}>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Fecha</label>
              <input type="date" value={quickSale.fecha} onChange={e=>setQuickSale({...quickSale, fecha:e.target.value})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Categoría</label>
              <select value={quickSale.categoria} onChange={e=>setQuickSale({...quickSale, categoria:e.target.value})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}>
                <option>Anillos</option><option>Collares</option><option>Aretes</option>
                <option>Pulseras</option><option>Relojes</option><option>Otros</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Cantidad</label>
              <input type="number" min={1} value={quickSale.cantidad}
                onChange={e=>setQuickSale({...quickSale, cantidad: Math.max(1, parseInt(e.target.value)||1)})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Precio Unitario</label>
              <input type="number" min={0} step="0.01" value={quickSale.precioUnitario}
                onChange={e=>setQuickSale({...quickSale, precioUnitario: Math.max(0, parseFloat(e.target.value)||0)})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Notas</label>
              <input type="text" value={quickSale.notas} onChange={e=>setQuickSale({...quickSale, notas:e.target.value})}
                placeholder="Opcional" style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <button type="submit" style={{ background:'#2196f3', color:'#fff', border:'none', borderRadius:6, padding:'10px 14px', cursor:'pointer' }}>Agregar al pedido</button>
              <button type="button" onClick={()=>setQuickSale({ fecha: new Date().toISOString().split('T')[0], categoria: 'Anillos', cantidad: 1, precioUnitario: 0, notas: '' })}
                style={{ background:'#fff', color:'#333', border:'1px solid #ddd', borderRadius:6, padding:'10px 14px', cursor:'pointer' }}>Limpiar</button>
            </div>
          </form>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'20px' }}>
          {filteredProducts.map((product:any) => (
            <div key={product.id} style={{ border:'2px solid #e2e8f0', borderRadius:15, padding:20, background: product.stock>0? '#fff':'#f7fafc', cursor: product.stock>0 ? 'pointer':'not-allowed', transition:'all .3s', boxShadow:'0 4px 15px rgba(0,0,0,0.05)'}}
              onClick={() => addProductToOrder(product)}
              onMouseOver={(e) => { if (product.stock>0) { e.currentTarget.style.transform='translateY(-5px)'; e.currentTarget.style.boxShadow='0 8px 25px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor='#4299e1'; } }}
              onMouseOut={(e) => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 15px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor='#e2e8f0'; }}>
              <h4 style={{ margin:'0 0 12px', color: product.stock>0? '#1a202c':'#a0aec0', fontSize:'1.1rem', fontWeight:600 }}>{product.name}</h4>
              <p style={{ margin:'8px 0', color:'#718096', fontSize:14, fontFamily:'monospace', background:'#f7fafc', padding:'4px 8px', borderRadius:6, display:'inline-block' }}>SKU: {product.sku}</p>
              <p style={{ margin:'12px 0', fontSize:24, fontWeight:'bold', color:'#2b6cb0' }}>${product.price.toFixed(2)}</p>
              <p style={{ margin:'8px 0', fontSize:14, color: product.stock<10? '#e53e3e':'#4a5568', fontWeight: product.stock<10? 'bold':'normal' }}>
                Stock: {product.stock}{product.stock < 10 && product.stock > 0 && ' ⚠️ (Bajo)'}{product.stock === 0 && ' ❌ (Agotado)'}
              </p>
              <div style={{ marginTop:15, fontSize:12, color:'#fff', background:'linear-gradient(135deg, #4299e1, #3182ce)', padding:'6px 12px', borderRadius:20, textAlign:'center', fontWeight:500 }}>
                {product.category}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Derecha: pedido y acciones */}
      <div style={{ background:'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', padding:25, borderRadius:15, height:'fit-content', boxShadow:'0 8px 30px rgba(0,0,0,0.1)', border:'1px solid #e2e8f0' }}>
        <h2 style={{ marginTop:0, color:'#1a202c', fontSize:'1.8rem', textAlign:'center', borderBottom:'2px solid #4299e1', paddingBottom:15, marginBottom:20 }}>🧾 Pedido</h2>

        {/* Cliente */}
        <div style={{ marginBottom:16, padding:14, background:'#f8f9fc', borderRadius:12, border:'2px solid #e2e8f0' }}>
          <label style={{ display:'block', marginBottom:8, fontWeight:600, color:'#2d3748' }}>👤 Cliente</label>
          <input type="text" value={customerQuery} onChange={e=>setCustomerQuery(e.target.value)} placeholder="Buscar por nombre, ID o teléfono"
            style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:6 }} />
          <select value={selectedCustomer?.id || ''} onChange={e=> setSelectedCustomer(customers.find(c=> c.id === Number(e.target.value)) || null)}
            style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8 }}>
            <option value="">Cliente general</option>
            {filteredCustomers.map((c:any)=> (
              <option key={c.id} value={c.id}>{c.id} - {c.name} ({c.discountLevel})</option>
            ))}
          </select>
          {selectedCustomer && (
            <div style={{ marginTop:8, padding:'10px 12px', background:'linear-gradient(135deg, #4299e1, #3182ce)', borderRadius:8, color:'#fff', fontSize:13, textAlign:'center' }}>
              <strong>Nivel: {selectedCustomer.discountLevel}</strong> · Descuento: {Math.round((discountMap[selectedCustomer.discountLevel]||0)*100)}%
            </div>
          )}
        </div>

        {/* Items del pedido */}
        <div style={{ marginBottom:16, maxHeight:260, overflowY:'auto' }}>
          {orderItems.length === 0 ? (
            <div style={{ textAlign:'center', color:'#666', padding:20 }}>No hay productos en el pedido</div>
          ) : (
            orderItems.map(it => (
              <div key={it.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, padding:10, marginBottom:8, background:'#fff', border:'1px solid #eee', borderRadius:8 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{it.name}</div>
                  <div style={{ fontSize:12, color:'#666' }}>{it.category || 'Sin categoría'} {it.type==='manual' && '· Manual'}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                    <button onClick={()=>updateQty(it.id, it.quantity-1)} style={{ width:24, height:24, border:'1px solid #ddd', background:'#fff', cursor:'pointer' }}>-</button>
                    <span style={{ minWidth:20, textAlign:'center' }}>{it.quantity}</span>
                    <button onClick={()=>updateQty(it.id, it.quantity+1)} style={{ width:24, height:24, border:'1px solid #ddd', background:'#fff', cursor:'pointer' }}>+</button>
                    {it.type==='manual' ? (
                      <input type="number" min={0} step="0.01" value={it.unitPrice} onChange={e=>updatePriceManual(it.id, parseFloat(e.target.value)||0)}
                        style={{ marginLeft:8, width:100, padding:'4px 6px', border:'1px solid #ddd', borderRadius:6 }} />
                    ) : (
                      <span style={{ marginLeft:8, fontSize:12, color:'#666' }}>${it.unitPrice.toFixed(2)} c/u</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700 }}>${(it.unitPrice*it.quantity).toFixed(2)}</div>
                  <button onClick={()=>removeItem(it.id)} style={{ marginTop:6, background:'#fff', color:'#d32f2f', border:'1px solid #d32f2f', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen y pago */}
        <div style={{ borderTop:'1px solid #ddd', paddingTop:12, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {discount>0 && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, color:'#d32f2f' }}><span>Descuento</span><span>- ${discount.toFixed(2)}</span></div>}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span>IVA ({Math.round(taxRate*100)}%)</span><span>${tax.toFixed(2)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700, borderTop:'1px solid #ddd', paddingTop:8 }}><span>Total</span><span>${total.toFixed(2)}</span></div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:12, color:'#666', marginBottom:6 }}>Método de pago</label>
          <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as any)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8 }}>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={confirmOrder} disabled={orderItems.length===0} style={{ flex:1, background:'#4caf50', color:'#fff', border:'none', borderRadius:6, padding:'10px 12px', cursor:'pointer', fontWeight:700 }}>Confirmar compra</button>
          <button onClick={cancelOrder} disabled={orderItems.length===0} style={{ flex:1, background:'#fff', color:'#333', border:'1px solid #ddd', borderRadius:6, padding:'10px 12px', cursor:'pointer' }}>Cancelar</button>
        </div>

        {/* Ventas recientes */}
        <div style={{ marginTop:16, padding: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ventas recientes</div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            {recentSales.length === 0 ? (
              <div style={{ color: '#666', fontSize: 13 }}>Sin ventas aún</div>
            ) : (
              recentSales.map((s:any)=> (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
                  <div style={{ fontSize: 13, color: '#333' }}>{new Date(s.createdAt).toLocaleString('es-MX')}</div>
                  <div style={{ fontWeight: 600 }}>${s.total.toFixed(2)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


const Products = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', price: 0, stock: 0, category: '', description: ''
  });

  // Función para generar un SKU único tipo JOY-YYYYMMDD-XXXX
  const generateSKU = () => {
    const date = new Date();
    const yyyymmdd = date.getFullYear().toString() + String(date.getMonth()+1).padStart(2,'0') + String(date.getDate()).padStart(2,'0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `JOY-${yyyymmdd}-${random}`;
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getProducts();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.electronAPI) {
        if (editingProduct) {
          await window.electronAPI.updateProduct(editingProduct.id, newProduct);
        } else {
          await window.electronAPI.createProduct(newProduct);
        }
        resetForm();
        loadProducts();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      try {
        if (window.electronAPI) {
          await window.electronAPI.deleteProduct(id);
          loadProducts();
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar el producto');
      }
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description || ''
    });
    setShowAddForm(true);
  };

  // Cuando se abre el formulario de nuevo producto, autogenerar SKU
  const handleShowAddForm = () => {
    setEditingProduct(null);
    let newSku = '';
    let exists = true;
    // Intentar hasta que no exista
    while (exists) {
      newSku = generateSKU();
      exists = products.some(p => p.sku === newSku);
    }
    setNewProduct({ sku: newSku, name: '', price: 0, stock: 0, category: '', description: '' });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setNewProduct({ sku: '', name: '', price: 0, stock: 0, category: '', description: '' });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📦 Gestión de Productos</h1>
        <button 
          onClick={handleShowAddForm}
          style={{ 
            background: '#2196f3', 
            color: 'white', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          + Nuevo Producto
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            maxWidth: '400px',
            padding: '12px', 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            fontSize: '16px' 
          }}
        />
      </div>

      {/* Formulario */}
      {showAddForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '500px' }}>
            <h2>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>SKU:</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    readOnly={!editingProduct}
                    onChange={editingProduct ? (e) => setNewProduct({...newProduct, sku: e.target.value}) : undefined}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', background: editingProduct ? 'white' : '#f5f5f5', color: editingProduct ? 'black' : '#888' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Categoría:</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Anillos">Anillos</option>
                    <option value="Collares">Collares</option>
                    <option value="Aretes">Aretes</option>
                    <option value="Pulseras">Pulseras</option>
                    <option value="Relojes">Relojes</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nombre:</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Precio:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Stock:</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Descripción:</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
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
                  style={{ background: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {editingProduct ? 'Actualizar' : 'Crear'} Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>SKU</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Producto</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Categoría</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Precio</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Stock</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{product.sku}</td>
                <td style={{ padding: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                    {product.description && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{product.description}</div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: '#e3f2fd',
                    color: '#1565c0'
                  }}>
                    {product.category}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>${product.price.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <span style={{
                    color: product.stock < 10 ? '#d32f2f' : product.stock < 20 ? '#f57c00' : '#388e3c',
                    fontWeight: product.stock < 10 ? 'bold' : 'normal'
                  }}>
                    {product.stock}
                    {product.stock < 10 && ' ⚠️'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button 
                    onClick={() => handleEdit(product)}
                    style={{ marginRight: '8px', padding: '4px 8px', border: '1px solid #2196f3', background: 'white', color: '#2196f3', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    style={{ padding: '4px 8px', border: '1px solid #d32f2f', background: 'white', color: '#d32f2f', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Continúo implementando el resto de componentes...
// Componente de Corte de Caja
const CashSession = () => {
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [detailSession, setDetailSession] = useState<any>(null);
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
    const expectedCash = (session.initialAmount || 0) + (byMethod['Efectivo'] || 0);
    return { total, count, avg, totalTax, totalDiscount, byMethod, expectedCash };
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
    } catch (error) {
      console.error('Error saving cash session:', error);
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
  const useCountAsFinal = ()=> {
    setNewSession(s=> ({ ...s, finalAmount: Number(countedCashTotal.toFixed(2)) }));
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

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h1>💰 Corte de Caja</h1>
        <button 
          onClick={() => { if (openSession) return; setShowAddForm(true); setEditingSession(null); setNewSession({ initialAmount: 0, finalAmount: 0, notes: '' }); setShowCashCount(false); setCashCount({}); }}
          style={{ 
            background: openSession ? '#9e9e9e' : '#4caf50', 
            color: '#fff', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontSize: '16px'
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
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
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
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px' }}>
                    <div><strong>Ventas Totales</strong><div>${s.total.toFixed(2)}</div></div>
                    <div><strong>Efectivo</strong><div>${(s.byMethod['Efectivo']||0).toFixed(2)}</div></div>
                    <div><strong>Tarjeta</strong><div>${(s.byMethod['Tarjeta']||0).toFixed(2)}</div></div>
                    <div><strong>Transferencia</strong><div>${(s.byMethod['Transferencia']||0).toFixed(2)}</div></div>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de detalle */}
      {detailSession && (() => { const s = summarizeSession(detailSession); return (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001 }}>
          <div style={{ background:'#fff', borderRadius:8, padding:24, width:'min(860px, 94vw)', maxHeight:'90vh', overflow:'auto', border:'1px solid #e0e0e0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ margin:0 }}>📊 Detalle de Sesión</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=> exportSessionCSV(detailSession)} style={{ border:'1px solid #1976d2', color:'#1976d2', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Exportar CSV</button>
                <button onClick={()=> printSession(detailSession)} style={{ border:'1px solid #4caf50', color:'#4caf50', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Imprimir</button>
                <button onClick={() => setDetailSession(null)} style={{ border:'none', background:'#eee', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Cerrar</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16, marginBottom:16 }}>
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
    </div>
  );
};

// Componente de Reportes Avanzados
const Reports = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('general');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [paymentFilter, setPaymentFilter] = useState<'Todos'|'Efectivo'|'Tarjeta'|'Transferencia'|'Otro'>('Todos');
  const [productQuery, setProductQuery] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    const inRange = saleDate >= dateRange.startDate && saleDate <= dateRange.endDate;
    const method = sale.paymentMethod || 'Otro';
    const methodOk = paymentFilter === 'Todos' || method === paymentFilter;
    return inRange && methodOk;
  });

  const setQuickRange = (key: 'hoy'|'7d'|'30d'|'mes') => {
    const now = new Date();
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

  const exportSalesCSV = () => {
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
    a.download = `reporte_ventas_${dateRange.startDate}_a_${dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportProductsCSV = () => {
    const list = getProductSales();
    const header = ['Producto','Categoría','Cantidad','Ingresos'];
    const rows = list.map((p:any)=> [p.name, p.category, p.quantity, p.revenue.toFixed(2)]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'productos_top.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportCustomersCSV = () => {
    const list = getCustomerStats();
    const header = ['Cliente','Compras','Total','Promedio','ÚltimaCompra'];
    const rows = list.map((c:any)=> [c.customer.name, c.purchases, c.total.toFixed(2), c.avgPurchase.toFixed(2), new Date(c.lastPurchase).toLocaleString('es-MX')]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes_top.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const exportCategoriesCSV = () => {
    const list = getCategoryStats();
    const header = ['Categoría','Productos','Cantidad','Ingresos','PromedioPorProducto'];
    const rows = list.map((c:any)=> [c.category, c.products, c.quantity, c.revenue.toFixed(2), (c.products>0?(c.revenue/c.products):0).toFixed(2)]);
    const csv = [header, ...rows].map(r=> r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'categorias.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const s = calculateStats();
    const byMethod = filteredSales.reduce((acc:any, v:any)=> { const m = v.paymentMethod||'Otro'; acc[m]=(acc[m]||0)+(v.total||0); return acc; }, {});
    const html = `
      <html><head><title>Reporte</title>
      <style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding:16px} h2{margin:0 0 8px} .row{margin:4px 0}</style>
      </head><body>
      <h2>Reporte de Ventas</h2>
      <div class="row"><b>Periodo:</b> ${dateRange.startDate} a ${dateRange.endDate}</div>
      <div class="row"><b>Ventas Totales:</b> $${s.totalSales.toFixed(2)} (${s.totalTransactions} transacciones)</div>
      <div class="row"><b>Promedio:</b> $${s.avgSale.toFixed(2)} | <b>Descuentos:</b> $${s.totalDiscount.toFixed(2)} | <b>Impuestos:</b> $${s.totalTax.toFixed(2)}</div>
      <div class="row"><b>Por método:</b> Efectivo $${(byMethod['Efectivo']||0).toFixed(2)} · Tarjeta $${(byMethod['Tarjeta']||0).toFixed(2)} · Transferencia $${(byMethod['Transferencia']||0).toFixed(2)} · Otro $${(byMethod['Otro']||0).toFixed(2)}</div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus(); w.print(); w.close();
  };

  const calculateStats = () => {
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalDiscount = filteredSales.reduce((sum, sale) => sum + sale.discount, 0);
    const totalTax = filteredSales.reduce((sum, sale) => sum + sale.tax, 0);
    const avgSale = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
    
    return { totalSales, totalDiscount, totalTax, avgSale, totalTransactions: filteredSales.length };
  };

  const getProductSales = () => {
    const productSales: { [key: number]: { name: string, category: string, quantity: number, revenue: number } } = {};
    
    filteredSales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { 
              name: product.name, 
              category: product.category || 'Sin categoría',
              quantity: 0, 
              revenue: 0 
            };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.subtotal;
        }
      });
    });

    return Object.values(productSales).sort((a, b) => b.revenue - a.revenue);
  };

  const getCustomerStats = () => {
    const customerStats: { [key: number]: { 
      customer: any, 
      purchases: number, 
      total: number, 
      avgPurchase: number,
      lastPurchase: string 
    } } = {};
    
    filteredSales.forEach(sale => {
      if (sale.customerId) {
        const customer = customers.find(c => c.id === sale.customerId);
        if (customer) {
          if (!customerStats[sale.customerId]) {
            customerStats[sale.customerId] = { 
              customer, 
              purchases: 0, 
              total: 0, 
              avgPurchase: 0,
              lastPurchase: sale.createdAt
            };
          }
          customerStats[sale.customerId].purchases++;
          customerStats[sale.customerId].total += sale.total;
          if (new Date(sale.createdAt) > new Date(customerStats[sale.customerId].lastPurchase)) {
            customerStats[sale.customerId].lastPurchase = sale.createdAt;
          }
        }
      }
    });

    // Calcular promedio de compra
    Object.values(customerStats).forEach(stat => {
      stat.avgPurchase = stat.total / stat.purchases;
    });

    return Object.values(customerStats).sort((a, b) => b.total - a.total);
  };

  const getCustomerDemographics = () => {
    const demographics = {
      byGender: {} as { [key: string]: number },
      byAge: {} as { [key: string]: number },
      byOccupation: {} as { [key: string]: number },
      byCustomerType: {} as { [key: string]: number },
      byDiscountLevel: {} as { [key: string]: number },
      byBudgetRange: {} as { [key: string]: number },
      byCities: {} as { [key: string]: number }
    };

    customers.forEach(customer => {
      // Por género
      if (customer.gender) {
        demographics.byGender[customer.gender] = (demographics.byGender[customer.gender] || 0) + 1;
      }

      // Por edad (rangos)
      if (customer.birthDate) {
        const age = calculateAge(customer.birthDate);
        if (age) {
          const ageRange = getAgeRange(age);
          demographics.byAge[ageRange] = (demographics.byAge[ageRange] || 0) + 1;
        }
      }

      // Por ocupación
      if (customer.occupation) {
        demographics.byOccupation[customer.occupation] = (demographics.byOccupation[customer.occupation] || 0) + 1;
      }

      // Por tipo de cliente
      const customerType = customer.customerType || 'Particular';
      demographics.byCustomerType[customerType] = (demographics.byCustomerType[customerType] || 0) + 1;

      // Por nivel de descuento
      demographics.byDiscountLevel[customer.discountLevel] = (demographics.byDiscountLevel[customer.discountLevel] || 0) + 1;

      // Por rango de presupuesto
      if (customer.budgetRange) {
        demographics.byBudgetRange[customer.budgetRange] = (demographics.byBudgetRange[customer.budgetRange] || 0) + 1;
      }

      // Por ciudad (extraer de dirección)
      if (customer.address) {
        const city = extractCity(customer.address);
        if (city) {
          demographics.byCities[city] = (demographics.byCities[city] || 0) + 1;
        }
      }
    });

    return demographics;
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getAgeRange = (age: number) => {
    if (age < 25) return '18-24 años';
    if (age < 35) return '25-34 años';
    if (age < 45) return '35-44 años';
    if (age < 55) return '45-54 años';
    if (age < 65) return '55-64 años';
    return '65+ años';
  };

  const extractCity = (address: string) => {
    // Busca patrones como ", Ciudad," o ", Ciudad de México,"
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]/);
    return cityMatch ? cityMatch[1].trim() : null;
  };

  const getCategoryStats = () => {
    const categoryStats: { [key: string]: { revenue: number, quantity: number, products: number } } = {};
    
    products.forEach(product => {
      const category = product.category || 'Sin categoría';
      if (!categoryStats[category]) {
        categoryStats[category] = { revenue: 0, quantity: 0, products: 0 };
      }
      categoryStats[category].products++;
    });

    filteredSales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const category = product.category || 'Sin categoría';
          categoryStats[category].quantity += item.quantity;
          categoryStats[category].revenue += item.subtotal;
        }
      });
    });

    return Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      ...stats
    })).sort((a, b) => b.revenue - a.revenue);
  };

  const stats = calculateStats();
  const productSales = getProductSales();
  const customerStats = getCustomerStats();
  const demographics = getCustomerDemographics();
  const categoryStats = getCategoryStats();

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

  const renderGeneralTab = () => (
    <div>
      {/* Resumen general */}
      <div className="lux-grid" style={{ gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', marginBottom:'30px' }}>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Ventas Totales</h3>
          <div className="stat-value">${stats.totalSales.toLocaleString()}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Periodo seleccionado</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Transacciones</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{stats.totalTransactions}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Comprobantes</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Venta Promedio</h3>
          <div className="stat-value">${stats.avgSale.toLocaleString()}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Ticket medio</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 12px', fontSize:'15px', textTransform:'uppercase', letterSpacing:'1.5px', color:'#c7d0db'}}>Descuentos</h3>
          <div className="stat-value">${stats.totalDiscount.toLocaleString()}</div>
          <small style={{ fontSize:'13px', color:'#9aa4b1' }}>Aplicados</small>
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
                  <td style={{ padding: '12px 15px' }}>
                    <span style={{
                      padding: '4px 8px',
                      background: '#f5f7fb',
                      color: '#46505a',
                      border: '1px solid #e5e9f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      {product.category}
                    </span>
                  </td>
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
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Perfil</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Compras</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Total Gastado</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Promedio</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Última Compra</th>
              </tr>
            </thead>
            <tbody>
              {customerStats.filter((stat:any)=> {
                const q = customerQuery.toLowerCase();
                const c = stat.customer;
                return !customerQuery || (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q);
              }).slice(0, 10).map((stat, index) => (
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
                    <div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#46505a',
                        background: '#f5f7fb',
                        border: '1px solid #e5e9f0',
                        marginRight: '5px'
                      }}>
                        {stat.customer.customerType || 'Particular'}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#46505a',
                        background: '#f5f7fb',
                        border: '1px solid #e5e9f0'
                      }}>
                        {stat.customer.discountLevel}
                      </span>
                      {stat.customer.budgetRange && (
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                          Presupuesto: {stat.customer.budgetRange}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDemographicsTab = () => (
    <div>
      {/* Análisis demográfico */}
      <h2 style={{ color: '#9c27b0', marginBottom: '20px' }}>📈 Análisis Demográfico de Clientes</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', marginBottom: '30px' }}>
        {/* Por Género */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#e91e63', marginBottom: '15px', borderBottom: '2px solid #fce4ec', paddingBottom: '8px' }}>👤 Por Género</h3>
          {Object.entries(demographics.byGender).map(([gender, count]) => (
            <div key={gender} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{gender}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Por Edad */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#ff5722', marginBottom: '15px', borderBottom: '2px solid #fbe9e7', paddingBottom: '8px' }}>🎂 Por Edad</h3>
          {Object.entries(demographics.byAge).map(([ageRange, count]) => (
            <div key={ageRange} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{ageRange}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Por Tipo de Cliente */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#4caf50', marginBottom: '15px', borderBottom: '2px solid #e8f5e8', paddingBottom: '8px' }}>💼 Por Tipo</h3>
          {Object.entries(demographics.byCustomerType).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{type}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Por Ciudad */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#2196f3', marginBottom: '15px', borderBottom: '2px solid #e3f2fd', paddingBottom: '8px' }}>🏙️ Por Ciudad</h3>
          {Object.entries(demographics.byCities).slice(0, 8).map(([city, count]) => (
            <div key={city} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{city}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Por Presupuesto */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#ff9800', marginBottom: '15px', borderBottom: '2px solid #fff3e0', paddingBottom: '8px' }}>💰 Por Presupuesto</h3>
          {Object.entries(demographics.byBudgetRange).map(([budget, count]) => (
            <div key={budget} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{budget}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>

        {/* Por Ocupación */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <h3 style={{ color: '#795548', marginBottom: '15px', borderBottom: '2px solid #efebe9', paddingBottom: '8px' }}>👨‍💼 Ocupaciones</h3>
          {Object.entries(demographics.byOccupation).slice(0, 8).map(([occupation, count]) => (
            <div key={occupation} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>{occupation}</span>
              <span style={{ 
                background: '#f5f7fb', 
                color: '#46505a', 
                padding: '4px 12px', 
                borderRadius: '15px', 
                border: '1px solid #e5e9f0',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {count} ({((count / customers.length) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCategoriesTab = () => (
    <div>
      {/* Análisis por categorías */}
      <h2 style={{ color: '#ff9800', marginBottom: '20px' }}>🏷️ Análisis por Categorías</h2>
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
        <button onClick={exportCategoriesCSV} style={{ padding:'8px 12px', border:'1px solid #ff9800', background:'#fff', color:'#ff9800', borderRadius:8, cursor:'pointer' }}>Exportar CSV</button>
      </div>
      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Categoría</th>
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Productos</th>
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Cantidad Vendida</th>
              <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Ingresos</th>
              <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Promedio por Producto</th>
            </tr>
          </thead>
          <tbody>
            {categoryStats.map((category, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '15px', fontWeight: 'bold', color: '#ff9800' }}>{category.category}</td>
                <td style={{ padding: '15px', textAlign: 'center' }}>{category.products}</td>
                <td style={{ padding: '15px', textAlign: 'center', fontWeight: 'bold', color: '#4caf50' }}>{category.quantity}</td>
                <td style={{ padding: '15px', textAlign: 'right', fontWeight: 'bold', color: '#2196f3' }}>${category.revenue.toLocaleString()}</td>
                <td style={{ padding: '15px', textAlign: 'right', color: '#666' }}>
                  ${category.products > 0 ? (category.revenue / category.products).toLocaleString() : '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px' }}>
      <h1 className="gradient-title" style={{ marginBottom: '20px' }}>
        📊 Reportes y Análisis Avanzados
      </h1>
      
      {/* Filtros de fecha */}
  <div style={{ 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'center', 
        marginBottom: '25px', 
        padding: '20px', 
        background: 'white', 
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <label style={{ fontWeight: 'bold', color: '#666' }}>📅 Período:</label>
        <input
          type="date"
          value={dateRange.startDate}
          onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
        />
        <span style={{ color: '#666' }}>hasta</span>
        <input
          type="date"
          value={dateRange.endDate}
          onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
          style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
        />
        <div style={{ marginLeft:'auto', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={()=> setQuickRange('hoy')} style={{ padding:'8px 10px', border:'1px solid #ddd', background:'#fff', borderRadius:8, cursor:'pointer' }}>Hoy</button>
          <button onClick={()=> setQuickRange('7d')} style={{ padding:'8px 10px', border:'1px solid #ddd', background:'#fff', borderRadius:8, cursor:'pointer' }}>Últimos 7 días</button>
          <button onClick={()=> setQuickRange('30d')} style={{ padding:'8px 10px', border:'1px solid #ddd', background:'#fff', borderRadius:8, cursor:'pointer' }}>Últimos 30 días</button>
          <button onClick={()=> setQuickRange('mes')} style={{ padding:'8px 10px', border:'1px solid #ddd', background:'#fff', borderRadius:8, cursor:'pointer' }}>Mes actual</button>
          <select value={paymentFilter} onChange={e=> setPaymentFilter(e.target.value as any)} style={{ padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }}>
            <option value="Todos">Todos</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Otro">Otro</option>
          </select>
          <button onClick={exportSalesCSV} style={{ padding:'8px 12px', border:'1px solid #1976d2', background:'#fff', color:'#1976d2', borderRadius:8, cursor:'pointer' }}>Exportar Ventas</button>
          <button onClick={printReport} style={{ padding:'8px 12px', border:'1px solid #4caf50', background:'#fff', color:'#4caf50', borderRadius:8, cursor:'pointer' }}>Imprimir</button>
        </div>
      </div>

      {/* Pestañas de navegación */}
      <div style={{ marginBottom: '20px' }}>
        <button style={tabStyle('general')} onClick={() => setActiveTab('general')}>
          📈 General
        </button>
        <button style={tabStyle('customers')} onClick={() => setActiveTab('customers')}>
          👥 Clientes
        </button>
        <button style={tabStyle('demographics')} onClick={() => setActiveTab('demographics')}>
          📊 Demografía
        </button>
        <button style={tabStyle('categories')} onClick={() => setActiveTab('categories')}>
          🏷️ Categorías
        </button>
      </div>

  {/* Contenido de las pestañas */}
      <div style={{ background: 'white', borderRadius: '0 12px 12px 12px', padding: '30px', border: '1px solid #e0e0e0', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'customers' && renderCustomersTab()}
        {activeTab === 'demographics' && renderDemographicsTab()}
        {activeTab === 'categories' && renderCategoriesTab()}
      </div>
    </div>
  );
};

// Componente de Configuración
const Settings = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [editingSetting, setEditingSetting] = useState<any>(null);
  const [newValue, setNewValue] = useState('');
  // Seguridad y preferencias avanzadas
  const [security, setSecurity] = useState({
    dashboardPassword: '080808',
    maskAmountsByDefault: true
  });
  const [cashDenominations, setCashDenominations] = useState<number[]>([1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5]);
  const [discountLevels, setDiscountLevels] = useState({
    Bronze: 0,
    Silver: 5,
    Gold: 8,
    Platinum: 12
  });
  const [businessSettings, setBusinessSettings] = useState({
    businessName: 'Joyería Elegante',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'MXN',
    taxRate: 16,
    receiptFooter: 'Gracias por su compra'
  });
  const [systemSettings, setSystemSettings] = useState({
    autoBackup: true,
    backupInterval: 24, // horas
    lowStockAlert: 10,
    allowNegativeStock: false,
    requireCustomerForSale: false,
    printReceiptAutomatically: true,
    defaultPaymentMethod: 'Efectivo'
  });

  // Nueva configuración para clasificación automática de clientes
  const [clientClassificationSettings, setClientClassificationSettings] = useState({
    classificationMethod: 'amount' as 'amount' | 'frequency' | 'hybrid',
    bronzeToSilver: { amount: 10000, frequency: 3 },
    silverToGold: { amount: 25000, frequency: 8 },
    goldToPlatinum: { amount: 50000, frequency: 15 },
    evaluationPeriod: 12, // meses
    autoUpgrade: true,
    autoDowngrade: false,
    notifyLevelChange: true
  });

  // Objetivos de venta (meta mensual)
  const [goals, setGoals] = useState({
    monthlyGoal: 100000
  });

  useEffect(() => {
    loadSettings();
    loadBusinessSettings();
    loadClientClassificationSettings();
    // Cargar seguridad y denominaciones
    try {
      const sec = localStorage.getItem('securitySettings');
      if (sec) setSecurity(JSON.parse(sec));
    } catch {}
    try {
      const den = localStorage.getItem('cashDenominations');
      if (den) setCashDenominations(JSON.parse(den));
    } catch {}
  }, []);

  const loadClientClassificationSettings = () => {
    const savedClassificationSettings = localStorage.getItem('clientClassificationSettings');
    if (savedClassificationSettings) {
      setClientClassificationSettings(JSON.parse(savedClassificationSettings));
    }
  };

  const saveClientClassificationSettings = () => {
    localStorage.setItem('clientClassificationSettings', JSON.stringify(clientClassificationSettings));
    alert('Configuración de clasificación de clientes actualizada correctamente');
  };

  // (eliminado) calculateCustomerLevel no utilizado; usamos calculateCustomerLevelBasic en el módulo de Clientes

  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getSettings();
        setSettings(data);
        
        // Extraer configuraciones específicas
        data.forEach((setting: any) => {
          if (setting.key === 'business_name') {
            setBusinessSettings(prev => ({ ...prev, businessName: setting.value }));
          }
          if (setting.key === 'tax_rate') {
            setBusinessSettings(prev => ({ ...prev, taxRate: parseFloat(setting.value) * 100 }));
          }
          if (setting.key === 'monthly_goal') {
            const mg = parseFloat(setting.value);
            if (!Number.isNaN(mg)) setGoals(prev => ({ ...prev, monthlyGoal: mg }));
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadBusinessSettings = () => {
    // Simular carga de configuraciones adicionales (en una implementación real, esto vendría de la base de datos)
    const savedDiscountLevels = localStorage.getItem('discountLevels');
    const savedBusinessSettings = localStorage.getItem('businessSettings');
    const savedSystemSettings = localStorage.getItem('systemSettings');

    if (savedDiscountLevels) {
      setDiscountLevels(JSON.parse(savedDiscountLevels));
    }
    if (savedBusinessSettings) {
      setBusinessSettings(JSON.parse(savedBusinessSettings));
    }
    if (savedSystemSettings) {
      setSystemSettings(JSON.parse(savedSystemSettings));
    }
  };

  const handleEdit = (setting: any) => {
    setEditingSetting(setting);
    setNewValue(setting.value);
  };

  const handleSave = async () => {
    try {
      if (window.electronAPI && editingSetting) {
        await window.electronAPI.updateSetting(editingSetting.key, newValue);
        setEditingSetting(null);
        setNewValue('');
        loadSettings();
        
        // Actualizar configuraciones locales
        if (editingSetting.key === 'business_name') {
          setBusinessSettings(prev => ({ ...prev, businessName: newValue }));
        }
        if (editingSetting.key === 'tax_rate') {
          setBusinessSettings(prev => ({ ...prev, taxRate: parseFloat(newValue) * 100 }));
        }
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Error al actualizar la configuración');
    }
  };

  const saveDiscountLevels = () => {
    localStorage.setItem('discountLevels', JSON.stringify(discountLevels));
    alert('Niveles de descuento actualizados correctamente');
  };

  const saveBusinessSettings = () => {
    localStorage.setItem('businessSettings', JSON.stringify(businessSettings));
    // Espejar a settings del backend si aplica
    try {
      window.electronAPI?.updateSetting?.('business_name', businessSettings.businessName);
      const tax = (businessSettings.taxRate || 0) / 100;
      window.electronAPI?.updateSetting?.('tax_rate', String(tax));
    } catch {}
    alert('Configuración del negocio actualizada correctamente');
  };

  const saveSystemSettings = () => {
    localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
    alert('Configuración del sistema actualizada correctamente');
  };

  const saveGoals = async () => {
    try {
      // Persistir en backend (si aplica) y also en localStorage como respaldo
      await window.electronAPI?.updateSetting?.('monthly_goal', String(goals.monthlyGoal));
      localStorage.setItem('goals', JSON.stringify(goals));
      alert('Meta mensual actualizada correctamente');
    } catch (e) {
      console.error('Error updating monthly_goal', e);
      alert('No se pudo actualizar la meta mensual');
    }
  };

  const saveSecurity = () => {
    localStorage.setItem('securitySettings', JSON.stringify(security));
    if (security.dashboardPassword) localStorage.setItem('dashboardPassword', security.dashboardPassword);
    alert('Seguridad actualizada');
  };

  const saveDenominations = () => {
    // Normalizar: quitar duplicados, números positivos, orden descendente
    const cleaned = Array.from(new Set(cashDenominations.filter(n => typeof n === 'number' && n > 0)))
      .sort((a,b)=> b-a);
    setCashDenominations(cleaned);
    localStorage.setItem('cashDenominations', JSON.stringify(cleaned));
    alert('Denominaciones de efectivo guardadas');
  };

  const getInputType = (key: string) => {
    if (key.includes('rate') || key.includes('tax')) return 'number';
    if (key.includes('email')) return 'email';
    if (key.includes('phone')) return 'tel';
    return 'text';
  };

  const getInputStep = (key: string) => {
    if (key.includes('rate') || key.includes('tax')) return '0.01';
    return undefined;
  };

  return (
    <div style={{ padding: '20px', maxHeight: '100vh', overflowY: 'auto' }}>
      <h1>⚙️ Configuración del Sistema</h1>
      
      <div style={{ display: 'grid', gap: '25px', maxWidth: '1100px' }}>

        {/* Seguridad y privacidad */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#6a1b9a', 
            borderBottom: '3px solid #ede7f6', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🔐 Seguridad y privacidad
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            <div>
              <label style={{ display:'block', marginBottom:4, fontWeight:'bold' }}>Contraseña para Dashboard</label>
              <input type="password" value={security.dashboardPassword}
                onChange={e=> setSecurity(prev=> ({ ...prev, dashboardPassword: e.target.value }))}
                placeholder="••••••" style={{ width:'100%', padding:'10px', border:'1px solid #ddd', borderRadius:6 }} />
              <small style={{ color:'#666' }}>Se usa para revelar montos en el dashboard</small>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="checkbox" checked={security.maskAmountsByDefault} onChange={e=> setSecurity(prev=> ({ ...prev, maskAmountsByDefault: e.target.checked }))} />
              Ocultar montos por defecto en Dashboard
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={saveSecurity} style={{ background:'#6a1b9a', color:'#fff', border:'none', padding:'10px 16px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>💾 Guardar seguridad</button>
          </div>
        </div>
        
        {/* Configuración de Niveles de Descuento */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#e91e63', 
            borderBottom: '3px solid #fce4ec', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            💎 Niveles de Descuento para Clientes
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {Object.entries(discountLevels).map(([level, discount]) => (
              <div key={level} style={{ 
                border: '2px solid #f0f0f0', 
                borderRadius: '8px', 
                padding: '15px',
                background: level === 'Bronze' ? '#f3e5ab' : 
                           level === 'Silver' ? '#e8e8e8' : 
                           level === 'Gold' ? '#ffd700' : '#e5e4e2'
              }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {level}:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={discount}
                    onChange={(e) => setDiscountLevels(prev => ({
                      ...prev,
                      [level]: parseFloat(e.target.value) || 0
                    }))}
                    style={{ 
                      width: '80px', 
                      padding: '6px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}
                  />
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>%</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveDiscountLevels}
            style={{ 
              background: '#e91e63', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            💾 Guardar Niveles de Descuento
          </button>
        </div>

        {/* Configuración del Negocio */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#1976d2', 
            borderBottom: '3px solid #e3f2fd', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🏪 Información del Negocio
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre del Negocio:</label>
              <input
                type="text"
                value={businessSettings.businessName}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, businessName: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono:</label>
              <input
                type="tel"
                value={businessSettings.phone}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, phone: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email:</label>
              <input
                type="email"
                value={businessSettings.email}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, email: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Sitio Web:</label>
              <input
                type="url"
                value={businessSettings.website}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, website: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Moneda:</label>
              <select
                value={businessSettings.currency}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, currency: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="MXN">Peso Mexicano (MXN)</option>
                <option value="USD">Dólar Americano (USD)</option>
                <option value="EUR">Euro (EUR)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tasa de IVA (%):</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={businessSettings.taxRate}
                onChange={(e) => setBusinessSettings(prev => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección Completa:</label>
            <textarea
              value={businessSettings.address}
              onChange={(e) => setBusinessSettings(prev => ({ ...prev, address: e.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Pie de Página del Recibo:</label>
            <textarea
              value={businessSettings.receiptFooter}
              onChange={(e) => setBusinessSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
              rows={2}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
            />
          </div>
          <button
            onClick={saveBusinessSettings}
            style={{ 
              background: '#1976d2', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            💾 Guardar Configuración del Negocio
          </button>
        </div>

        {/* Configuración del Sistema */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#4caf50', 
            borderBottom: '3px solid #e8f5e8', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🔧 Configuración del Sistema
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={systemSettings.autoBackup}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <label style={{ fontWeight: 'bold' }}>Respaldo Automático</label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Intervalo de Respaldo (horas):</label>
              <input
                type="number"
                min="1"
                max="168"
                value={systemSettings.backupInterval}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, backupInterval: parseInt(e.target.value) || 24 }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Alerta de Stock Bajo:</label>
              <input
                type="number"
                min="1"
                max="100"
                value={systemSettings.lowStockAlert}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, lowStockAlert: parseInt(e.target.value) || 10 }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={systemSettings.allowNegativeStock}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, allowNegativeStock: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <label style={{ fontWeight: 'bold' }}>Permitir Stock Negativo</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={systemSettings.requireCustomerForSale}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, requireCustomerForSale: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <label style={{ fontWeight: 'bold' }}>Requerir Cliente en Ventas</label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={systemSettings.printReceiptAutomatically}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, printReceiptAutomatically: e.target.checked }))}
                style={{ width: '18px', height: '18px' }}
              />
              <label style={{ fontWeight: 'bold' }}>Imprimir Recibo Automáticamente</label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Método de Pago Por Defecto:</label>
              <select
                value={systemSettings.defaultPaymentMethod}
                onChange={(e) => setSystemSettings(prev => ({ ...prev, defaultPaymentMethod: e.target.value }))}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </div>
          </div>
          <button
            onClick={saveSystemSettings}
            style={{ 
              background: '#4caf50', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '6px', 
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            💾 Guardar Configuración del Sistema
          </button>
        </div>

        {/* Objetivos de Venta */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#ff5722', 
            borderBottom: '3px solid #ffe0b2', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🎯 Objetivos de Venta
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>
            <div>
              <label style={{ display:'block', marginBottom:6, fontWeight:'bold' }}>Meta mensual (importe)</label>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontWeight:700 }}>$</span>
                <input type="number" min={0} step={100} value={goals.monthlyGoal}
                  onChange={e=> setGoals(prev=> ({ ...prev, monthlyGoal: Math.max(0, parseFloat(e.target.value)||0) }))}
                  style={{ flex:1, padding:'10px', border:'1px solid #ddd', borderRadius:6 }} />
              </div>
              <small style={{ color:'#666' }}>Se usa para el indicador de progreso en el Dashboard</small>
            </div>
          </div>
          <div style={{ marginTop:12 }}>
            <button onClick={saveGoals} style={{ background:'#ff5722', color:'#fff', border:'none', padding:'10px 16px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>💾 Guardar meta</button>
          </div>
        </div>

        {/* Preferencias de Corte de Caja */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop:0, color:'#795548', borderBottom:'3px solid #efebe9', paddingBottom:12, display:'flex', alignItems:'center', gap:10 }}>
            💵 Denominaciones de efectivo
          </h3>
          <div>
            <p style={{ marginTop:0, color:'#555' }}>Configura las denominaciones usadas en el arqueo de efectivo del módulo Corte de Caja.</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12 }}>
              {cashDenominations.map((d, idx)=> (
                <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, border:'1px solid #ddd', borderRadius:6, padding:'6px 8px', background:'#fafafa' }}>
                  <span>$</span>
                  <input type="number" min={0.01} step={0.01} value={d}
                    onChange={e=> {
                      const val = parseFloat(e.target.value)||0;
                      setCashDenominations(prev=> prev.map((x,i)=> i===idx ? val : x));
                    }}
                    style={{ width:90, padding:'6px 8px', border:'1px solid #ddd', borderRadius:6 }} />
                  <button onClick={()=> setCashDenominations(prev=> prev.filter((_,i)=> i!==idx))} style={{ background:'#fff', border:'1px solid #e57373', color:'#e57373', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>Eliminar</button>
                </div>
              ))}
              <button onClick={()=> setCashDenominations(prev=> [...prev, 0])} style={{ background:'#fff', border:'1px dashed #bbb', color:'#555', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>+ Agregar</button>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={saveDenominations} style={{ background:'#795548', color:'#fff', border:'none', padding:'10px 16px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>💾 Guardar denominaciones</button>
              <button onClick={()=> setCashDenominations([1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5])} style={{ background:'#fff', border:'1px solid #795548', color:'#795548', borderRadius:6, padding:'10px 16px', cursor:'pointer' }}>Restablecer MX</button>
            </div>
          </div>
        </div>

        {/* Configuración de Clasificación Automática de Clientes */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '25px' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#9c27b0', 
            borderBottom: '3px solid #f3e5f5', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🎯 Clasificación Automática de Clientes
          </h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#666' }}>
              📊 Método de Clasificación:
            </label>
            <select
              value={clientClassificationSettings.classificationMethod}
              onChange={(e) => setClientClassificationSettings({
                ...clientClassificationSettings,
                classificationMethod: e.target.value as 'amount' | 'frequency' | 'hybrid'
              })}
              style={{ 
                width: '100%', 
                maxWidth: '300px',
                padding: '10px', 
                border: '2px solid #e0e0e0', 
                borderRadius: '8px',
                fontSize: '14px',
                background: '#f8f9fa'
              }}
            >
              <option value="amount">Por Monto Total de Compras</option>
              <option value="frequency">Por Número de Compras</option>
              <option value="hybrid">Híbrido (Monto + Frecuencia)</option>
            </select>
            <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
              {clientClassificationSettings.classificationMethod === 'amount' && 'Los clientes se clasifican solo por el monto total gastado'}
              {clientClassificationSettings.classificationMethod === 'frequency' && 'Los clientes se clasifican solo por el número de compras realizadas'}
              {clientClassificationSettings.classificationMethod === 'hybrid' && 'Los clientes deben cumplir AMBOS criterios (monto Y frecuencia)'}
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            {/* Bronze to Silver */}
            <div style={{ border: '2px solid #cd7f32', borderRadius: '8px', padding: '15px', background: '#faf9f7' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#cd7f32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🥉 Bronze → Silver
              </h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Monto Mínimo ($):</label>
                <input
                  type="number"
                  value={clientClassificationSettings.bronzeToSilver.amount}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    bronzeToSilver: { ...clientClassificationSettings.bronzeToSilver, amount: parseFloat(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Compras Mínimas:</label>
                <input
                  type="number"
                  value={clientClassificationSettings.bronzeToSilver.frequency}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    bronzeToSilver: { ...clientClassificationSettings.bronzeToSilver, frequency: parseInt(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
            </div>

            {/* Silver to Gold */}
            <div style={{ border: '2px solid #c0c0c0', borderRadius: '8px', padding: '15px', background: '#f8f8f8' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#c0c0c0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🥈 Silver → Gold
              </h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Monto Mínimo ($):</label>
                <input
                  type="number"
                  value={clientClassificationSettings.silverToGold.amount}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    silverToGold: { ...clientClassificationSettings.silverToGold, amount: parseFloat(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Compras Mínimas:</label>
                <input
                  type="number"
                  value={clientClassificationSettings.silverToGold.frequency}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    silverToGold: { ...clientClassificationSettings.silverToGold, frequency: parseInt(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
            </div>

            {/* Gold to Platinum */}
            <div style={{ border: '2px solid #ffd700', borderRadius: '8px', padding: '15px', background: '#fffef7' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#b8860b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🥇 Gold → Platinum
              </h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Monto Mínimo ($):</label>
                <input
                  type="number"
                  value={clientClassificationSettings.goldToPlatinum.amount}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    goldToPlatinum: { ...clientClassificationSettings.goldToPlatinum, amount: parseFloat(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Compras Mínimas:</label>
                <input
                  type="number"
                  value={clientClassificationSettings.goldToPlatinum.frequency}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    goldToPlatinum: { ...clientClassificationSettings.goldToPlatinum, frequency: parseInt(e.target.value) || 0 }
                  })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginTop: '3px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                📅 Período de Evaluación (meses):
              </label>
              <input
                type="number"
                min="1"
                max="24"
                value={clientClassificationSettings.evaluationPeriod}
                onChange={(e) => setClientClassificationSettings({
                  ...clientClassificationSettings,
                  evaluationPeriod: parseInt(e.target.value) || 12
                })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <small style={{ color: '#666', fontSize: '11px' }}>
                Solo se consideran compras de los últimos X meses
              </small>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                🔧 Opciones Automáticas:
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={clientClassificationSettings.autoUpgrade}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    autoUpgrade: e.target.checked
                  })}
                />
                ⬆️ Subir nivel automáticamente
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={clientClassificationSettings.autoDowngrade}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    autoDowngrade: e.target.checked
                  })}
                />
                ⬇️ Bajar nivel automáticamente
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={clientClassificationSettings.notifyLevelChange}
                  onChange={(e) => setClientClassificationSettings({
                    ...clientClassificationSettings,
                    notifyLevelChange: e.target.checked
                  })}
                />
                🔔 Notificar cambios de nivel
              </label>
            </div>
          </div>

          <button
            onClick={saveClientClassificationSettings}
            style={{
              background: 'linear-gradient(135deg, #9c27b0, #7b1fa2)',
              color: 'white',
              padding: '12px 25px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
            }}
          >
            💾 Guardar Configuración de Clasificación
          </button>
        </div>

        {/* Configuraciones básicas existentes */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#ff9800', 
            borderBottom: '3px solid #fff3e0', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📋 Configuraciones Base
          </h3>
          {settings.map((setting) => (
            <div key={setting.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '15px 0', 
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  {setting.description || setting.key}
                </div>
                <div style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                  {setting.key}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '300px' }}>
                {editingSetting?.id === setting.id ? (
                  <>
                    <input
                      type={getInputType(setting.key)}
                      step={getInputStep(setting.key)}
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      style={{ 
                        flex: 1, 
                        padding: '8px', 
                        border: '2px solid #2196f3', 
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSave}
                      style={{ 
                        background: '#4caf50', 
                        color: 'white', 
                        border: 'none', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingSetting(null);
                        setNewValue('');
                      }}
                      style={{ 
                        background: '#d32f2f', 
                        color: 'white', 
                        border: 'none', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ 
                      flex: 1, 
                      padding: '8px 12px', 
                      background: '#f5f5f5', 
                      borderRadius: '4px',
                      fontFamily: setting.key.includes('rate') || setting.key.includes('tax') ? 'monospace' : 'inherit',
                      fontSize: '14px'
                    }}>
                      {setting.key.includes('rate') || setting.key.includes('tax') 
                        ? `${(parseFloat(setting.value) * 100).toFixed(1)}%` 
                        : setting.value}
                    </span>
                    <button
                      onClick={() => handleEdit(setting)}
                      style={{ 
                        background: '#2196f3', 
                        color: 'white', 
                        border: 'none', 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Editar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Información del sistema */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#9c27b0', 
            borderBottom: '3px solid #f3e5f5', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            📱 Información del Sistema
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Versión</div>
              <div style={{ color: '#666' }}>1.0.0</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Plataforma</div>
              <div style={{ color: '#666' }}>Electron + React</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Base de Datos</div>
              <div style={{ color: '#666' }}>Mock Database</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Estado</div>
              <div style={{ color: '#4caf50', fontWeight: 'bold' }}>✓ Operativo</div>
            </div>
          </div>
        </div>

        {/* Acciones del sistema */}
        <div style={{ background: 'white', padding: '25px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ 
            marginTop: 0, 
            color: '#f44336', 
            borderBottom: '3px solid #ffebee', 
            paddingBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🔧 Acciones del Sistema
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de que quieres recargar la aplicación?')) {
                  window.location.reload();
                }
              }}
              style={{ 
                background: '#2196f3', 
                color: 'white', 
                border: 'none', 
                padding: '15px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🔄 Recargar Aplicación
            </button>
            <button
              onClick={() => {
                // Exportar configuraciones
                const allSettings = {
                  discountLevels,
                  businessSettings,
                  systemSettings,
                  goals,
                  security,
                  clientClassificationSettings,
                  cashDenominations
                };
                const dataStr = JSON.stringify(allSettings, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'configuraciones_joyeria.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                alert('Configuraciones exportadas correctamente');
              }}
              style={{ 
                background: '#4caf50', 
                color: 'white', 
                border: 'none', 
                padding: '15px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              💾 Exportar Configuraciones
            </button>
            <button
              onClick={() => {
                // Importar desde archivo
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'application/json';
                input.onchange = async () => {
                  const file = (input.files && input.files[0]) as File;
                  if (!file) return;
                  const text = await file.text();
                  try {
                    const data = JSON.parse(text);
                    if (data.discountLevels) { setDiscountLevels(data.discountLevels); localStorage.setItem('discountLevels', JSON.stringify(data.discountLevels)); }
                    if (data.businessSettings) { setBusinessSettings(data.businessSettings); localStorage.setItem('businessSettings', JSON.stringify(data.businessSettings)); }
                    if (data.systemSettings) { setSystemSettings(data.systemSettings); localStorage.setItem('systemSettings', JSON.stringify(data.systemSettings)); }
                    if (data.security) { setSecurity(data.security); localStorage.setItem('securitySettings', JSON.stringify(data.security)); if (data.security.dashboardPassword) localStorage.setItem('dashboardPassword', data.security.dashboardPassword); }
                    if (data.goals) {
                      setGoals(data.goals);
                      localStorage.setItem('goals', JSON.stringify(data.goals));
                      try { await window.electronAPI?.updateSetting?.('monthly_goal', String(data.goals.monthlyGoal)); } catch {}
                    }
                    if (data.clientClassificationSettings) { setClientClassificationSettings(data.clientClassificationSettings); localStorage.setItem('clientClassificationSettings', JSON.stringify(data.clientClassificationSettings)); }
                    if (data.cashDenominations) { setCashDenominations(data.cashDenominations); localStorage.setItem('cashDenominations', JSON.stringify(data.cashDenominations)); }
                    alert('Configuraciones importadas');
                  } catch (e) {
                    alert('Archivo inválido');
                  }
                };
                input.click();
              }}
              style={{ 
                background: '#8d6e63', 
                color: 'white', 
                border: 'none', 
                padding: '15px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📥 Importar Configuraciones
            </button>
            <button
              onClick={() => {
                alert('Funcionalidad de respaldo no implementada en la versión demo');
              }}
              style={{ 
                background: '#ff9800', 
                color: 'white', 
                border: 'none', 
                padding: '15px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              📊 Crear Respaldo
            </button>
            <button
              onClick={() => {
                if (confirm('¿Estás seguro de que quieres restablecer todas las configuraciones?')) {
                  localStorage.removeItem('discountLevels');
                  localStorage.removeItem('businessSettings');
                  localStorage.removeItem('systemSettings');
                  localStorage.removeItem('securitySettings');
                  localStorage.removeItem('clientClassificationSettings');
                  localStorage.removeItem('cashDenominations');
                  localStorage.removeItem('dashboardPassword');
                  window.location.reload();
                }
              }}
              style={{ 
                background: '#f44336', 
                color: 'white', 
                border: 'none', 
                padding: '15px 20px', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🔄 Restablecer Todo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente de Clientes
const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [detailsCustomer, setDetailsCustomer] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({
    // Información básica
    name: '', 
    email: '', 
    phone: '', 
    alternatePhone: '',
    address: '', 
    discountLevel: 'Bronze',
    
    // Información demográfica
    birthDate: '',
    gender: '',
    occupation: '',
    
    // Información comercial
    customerType: 'Particular', // Particular, Empresa, Mayorista
    referredBy: '',
    preferredContact: 'Email', // Email, Teléfono, SMS, WhatsApp
    
    // Preferencias de compra
    preferredCategories: [] as string[],
    budgetRange: '',
    specialOccasions: [] as string[], // Aniversario, Cumpleaños, Navidad, etc.
    
    // Información adicional
    notes: '',
    tags: [] as string[], // VIP, Frecuente, Ocasional, etc.
    isActive: true
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      if (window.electronAPI) {
        const [customersData, productsData, salesData] = await Promise.all([
          window.electronAPI.getCustomers(),
          window.electronAPI.getProducts(),
          window.electronAPI.getSales()
        ]);
        setCustomers(customersData);
        setProducts(productsData);
        setSales(salesData);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  // Función básica para calcular nivel del cliente
  const calculateCustomerLevelBasic = async (customerId: number) => {
    try {
      const salesData = await window.electronAPI.getSales();
      const customerSales = salesData.filter((sale: any) => sale.customerId === customerId);
      
      if (customerSales.length === 0) return 'Bronze';

      // Obtener configuración de clasificación desde localStorage
      const savedClassificationSettings = localStorage.getItem('clientClassificationSettings');
      const classificationConfig = savedClassificationSettings 
        ? JSON.parse(savedClassificationSettings)
        : {
            classificationMethod: 'amount',
            bronzeToSilver: { amount: 10000, frequency: 3 },
            silverToGold: { amount: 25000, frequency: 8 },
            goldToPlatinum: { amount: 50000, frequency: 15 },
            evaluationPeriod: 12
          };

      // Filtrar ventas según el período de evaluación
      const evaluationDate = new Date();
      evaluationDate.setMonth(evaluationDate.getMonth() - classificationConfig.evaluationPeriod);
      
      const recentSales = customerSales.filter((sale: any) => 
        new Date(sale.createdAt) >= evaluationDate
      );

      const totalAmount = recentSales.reduce((sum: number, sale: any) => sum + sale.total, 0);
      const totalPurchases = recentSales.length;

      // Determinar nivel según configuración
      const { classificationMethod, bronzeToSilver, silverToGold, goldToPlatinum } = classificationConfig;

      let level = 'Bronze';

      if (classificationMethod === 'amount') {
        if (totalAmount >= goldToPlatinum.amount) level = 'Platinum';
        else if (totalAmount >= silverToGold.amount) level = 'Gold';
        else if (totalAmount >= bronzeToSilver.amount) level = 'Silver';
      } else if (classificationMethod === 'frequency') {
        if (totalPurchases >= goldToPlatinum.frequency) level = 'Platinum';
        else if (totalPurchases >= silverToGold.frequency) level = 'Gold';
        else if (totalPurchases >= bronzeToSilver.frequency) level = 'Silver';
      } else if (classificationMethod === 'hybrid') {
        // Método híbrido: ambos criterios deben cumplirse
        if (totalAmount >= goldToPlatinum.amount && totalPurchases >= goldToPlatinum.frequency) level = 'Platinum';
        else if (totalAmount >= silverToGold.amount && totalPurchases >= silverToGold.frequency) level = 'Gold';
        else if (totalAmount >= bronzeToSilver.amount && totalPurchases >= bronzeToSilver.frequency) level = 'Silver';
      }

      return level;
    } catch (error) {
      console.error('Error calculating customer level:', error);
      return 'Bronze';
    }
  };

  // Función para actualizar niveles de todos los clientes
  const updateAllCustomerLevels = async () => {
    try {
      let updatedCount = 0;
      const updates: string[] = [];

      for (const customer of customers) {
        const currentLevel = customer.discountLevel;
        const calculatedLevel = await calculateCustomerLevelBasic(customer.id);
        
        if (currentLevel !== calculatedLevel) {
          await window.electronAPI.updateCustomer(customer.id, {
            ...customer,
            discountLevel: calculatedLevel
          });
          updatedCount++;
          updates.push(`${customer.name}: ${currentLevel} → ${calculatedLevel}`);
        }
      }

      if (updatedCount > 0) {
        const updateDetails = updates.join('\n');
  alert(`✅ Se actualizaron ${updatedCount} clientes:\n\n${updateDetails}`);
  loadAll(); // Recargar la lista y ventas
      } else {
        alert('ℹ️ Todos los clientes ya tienen el nivel correcto según las configuraciones actuales.');
      }
    } catch (error) {
      console.error('Error updating customer levels:', error);
      alert('❌ Error al actualizar los niveles de clientes');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.electronAPI) {
        // Validaciones simples
        if (newCustomer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email)) {
          alert('Email inválido');
          return;
        }
        const digits = (newCustomer.phone||'').replace(/\D+/g,'');
        if (newCustomer.phone && digits.length < 7) {
          alert('Teléfono principal inválido');
          return;
        }

        const customerData = {
          ...newCustomer,
          preferredCategories: newCustomer.preferredCategories.filter(cat => cat.trim() !== ''),
          specialOccasions: newCustomer.specialOccasions.filter(occ => occ.trim() !== ''),
          tags: newCustomer.tags.filter(tag => tag.trim() !== '')
        };
        
        if (editingCustomer) {
          await window.electronAPI.updateCustomer(editingCustomer.id, customerData);
        } else {
          await window.electronAPI.createCustomer(customerData);
        }
        
        resetForm();
        loadAll();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error al guardar el cliente');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        if (window.electronAPI) {
          await window.electronAPI.deleteCustomer(id);
          loadAll();
        }
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      alternatePhone: customer.alternatePhone || '',
      address: customer.address || '',
      discountLevel: customer.discountLevel || 'Bronze',
      birthDate: customer.birthDate || '',
      gender: customer.gender || '',
      occupation: customer.occupation || '',
      customerType: customer.customerType || 'Particular',
      referredBy: customer.referredBy || '',
      preferredContact: customer.preferredContact || 'Email',
      preferredCategories: customer.preferredCategories || ([] as string[]),
      budgetRange: customer.budgetRange || '',
      specialOccasions: customer.specialOccasions || ([] as string[]),
      notes: customer.notes || '',
      tags: customer.tags || ([] as string[]),
      isActive: customer.isActive !== false
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setNewCustomer({ 
      name: '', email: '', phone: '', alternatePhone: '', address: '', discountLevel: 'Bronze',
      birthDate: '', gender: '', occupation: '', customerType: 'Particular', referredBy: '',
      preferredContact: 'Email', preferredCategories: [] as string[], budgetRange: '', 
      specialOccasions: [] as string[], notes: '', tags: [] as string[], isActive: true
    });
    setEditingCustomer(null);
    setShowAddForm(false);
  };

  const filteredCustomers = customers.filter(customer => {
    const raw = searchTerm.trim();
    if (!raw) return true;
    const q = raw.toLowerCase();
    const qDigits = raw.replace(/\D+/g,'');
    const idMatch = String(customer.id||'').includes(raw);
    const nameMatch = (customer.name||'').toLowerCase().includes(q);
    const emailMatch = (customer.email||'').toLowerCase().includes(q);
    const occMatch = (customer.occupation||'').toLowerCase().includes(q);
    const typeMatch = (customer.customerType||'').toLowerCase().includes(q);
    const tagMatch = (Array.isArray(customer.tags)? customer.tags.join(' ') : '').toLowerCase().includes(q);
    const phones = [customer.phone, customer.alternatePhone].filter(Boolean) as string[];
    const phoneMatch = qDigits.length>0 && phones.some(p => p.replace(/\D+/g,'').includes(qDigits));
    return idMatch || nameMatch || emailMatch || occMatch || typeMatch || tagMatch || phoneMatch;
  });

  const getDiscountColor = (level: string) => {
    switch(level) {
      case 'Bronze': return '#cd7f32';
      case 'Silver': return '#c0c0c0';
      case 'Gold': return '#ffd700';
      case 'Platinum': return '#e5e4e2';
      default: return '#666';
    }
  };

  const getCustomerTypeColor = (type: string) => {
    switch(type) {
      case 'Particular': return '#2196f3';
      case 'Empresa': return '#4caf50';
      case 'Mayorista': return '#ff9800';
      default: return '#666';
    }
  };

  // (eliminados) helpers de categorías/ocasiones no usados actualmente

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Stats por cliente (usa ventas cargadas)
  const getStatsForCustomer = (customerId: number) => {
    const mySales = sales.filter((s:any)=> s.customerId === customerId);
    const purchases = mySales.length;
    const total = mySales.reduce((sum:number, s:any)=> sum + (Number(s.total)||0), 0);
    const lastPurchase = mySales.reduce((acc:string, s:any)=> !acc || new Date(s.createdAt) > new Date(acc) ? s.createdAt : acc, '');
    const avg = purchases ? +(total / purchases).toFixed(2) : 0;
    // Top categorías: de productos + notas manuales
    const catCount: Record<string, number> = {};
    const prodMap = new Map(products.map((p:any)=> [p.id, p]));
    mySales.forEach((s:any)=> {
      (s.items||[]).forEach((it:any)=> {
        if (it.productId && it.productId !== 0) {
          const p = prodMap.get(it.productId);
          const cat = p?.category || 'Sin categoría';
          catCount[cat] = (catCount[cat]||0) + it.quantity;
        }
      });
      if (typeof s.notes === 'string' && s.notes.includes('Categoría:')) {
        const m = s.notes.match(/Categoría:\s*([^|]+)/);
        if (m && m[1]) {
          const cat = m[1].trim();
          catCount[cat] = (catCount[cat]||0) + 1;
        }
      }
    });
    const topCategories = Object.entries(catCount).sort((a,b)=> b[1]-a[1]).slice(0,5);
    const recent = [...mySales].sort((a:any,b:any)=> new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,8);
    return { purchases, total, lastPurchase, avg, topCategories, recent };
  };

  const recalcLevelFor = async (customer:any) => {
    try {
      const level = await calculateCustomerLevelBasic(customer.id);
      await window.electronAPI.updateCustomer(customer.id, { ...customer, discountLevel: level });
      alert(`Nivel actualizado: ${level}`);
      loadAll();
    } catch (e) {
      console.error(e);
      alert('Error al recalcular nivel');
    }
  };

  const exportCSV = () => {
    const rows = [
      ['id','name','email','phone','alternatePhone','address','discountLevel','birthDate','gender','occupation','customerType','referredBy','preferredContact','budgetRange','isActive']
    ];
    customers.forEach((c:any)=> {
      rows.push([
        c.id, c.name||'', c.email||'', c.phone||'', c.alternatePhone||'', (c.address||'').replace(/\n/g,' '), c.discountLevel||'', c.birthDate||'', c.gender||'', c.occupation||'', c.customerType||'', c.referredBy||'', c.preferredContact||'', c.budgetRange||'', c.isActive!==false ? 'true':'false'
      ].map(String));
    });
    const csv = rows.map(r=> r.map(f=> /[",\n]/.test(f) ? '"'+f.replace(/"/g,'""')+'"' : f).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth()+1).padStart(2,'0');
    const dd = String(date.getDate()).padStart(2,'0');
    a.download = `clientes_${yyyy}-${mm}-${dd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 Gestión Avanzada de Clientes</h1>
        <button 
          onClick={() => setShowAddForm(true)}
          style={{ 
            background: '#2196f3', 
            color: 'white', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
            marginRight: '10px'
          }}
        >
          + Nuevo Cliente
        </button>
        <button 
          onClick={updateAllCustomerLevels}
          style={{ 
            background: '#9c27b0', 
            color: 'white', 
            padding: '12px 24px', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(156, 39, 176, 0.3)'
          }}
          title="Recalcular niveles de todos los clientes según configuración actual"
        >
          🔄 Actualizar Niveles
        </button>
        <button 
          onClick={exportCSV}
          style={{ 
            background: 'white', 
            color: '#232323', 
            padding: '12px 24px', 
            border: '1px solid #e5e5ea', 
            borderRadius: '8px', 
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginLeft: '10px'
          }}
          title="Exportar clientes a CSV"
        >
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="lux-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '25px' }}>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Total Clientes</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{customers.length}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Registrados</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Activos</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{customers.filter(c => c.isActive !== false).length}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Con estado activo</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>VIP / Gold+</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{customers.filter(c => ['Gold', 'Platinum'].includes(c.discountLevel)).length}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Clientes preferentes</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Empresas</h3>
          <div className="stat-value" style={{fontSize:'42px'}}>{customers.filter(c => c.customerType === 'Empresa').length}</div>
          <small style={{ fontSize:'12px', color:'#9aa4b1' }}>Clientes tipo empresa</small>
        </div>
        <div className="stat-card">
          <h3 style={{margin:'0 0 10px', fontSize:'14px', textTransform:'uppercase', letterSpacing:'1px', color:'#9aa4b1'}}>Herramientas</h3>
          <button
            onClick={async () => {
              if (confirm('¿Actualizar automáticamente los niveles de TODOS los clientes basado en las configuraciones actuales?')) {
                await updateAllCustomerLevels();
              }
            }}
            style={{
              background: '#ffffff',
              color: '#232323',
              border: '1px solid #e5e5ea',
              padding: '10px 12px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              width: '100%',
              marginTop: '6px'
            }}
            title="Recalcular niveles para todos los clientes"
          >
            🔄 Actualizar Niveles
          </button>
        </div>
      </div>

      {/* Búsqueda avanzada */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre, email, teléfono, ocupación o tipo de cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            maxWidth: '600px',
            padding: '15px 20px', 
            border: '2px solid #e0e0e0', 
            borderRadius: '12px', 
            fontSize: '16px',
            background: '#f8f9fa',
            transition: 'all 0.3s ease'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2196f3';
            e.target.style.background = 'white';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e0e0e0';
            e.target.style.background = '#f8f9fa';
          }}
        />
      </div>

      {/* Formulario expandido */}
      {showAddForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '30px', 
            borderRadius: '15px', 
            minWidth: '800px', 
            maxWidth: '90vw',
            maxHeight: '90vh', 
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0, color: '#2196f3', borderBottom: '3px solid #e3f2fd', paddingBottom: '15px' }}>
              {editingCustomer ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              {/* Información Básica */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#4caf50', marginBottom: '15px', borderBottom: '2px solid #e8f5e8', paddingBottom: '8px' }}>
                  📋 Información Básica
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre Completo *:</label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      required
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email:</label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono Principal:</label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono Alternativo:</label>
                    <input
                      type="tel"
                      value={newCustomer.alternatePhone}
                      onChange={(e) => setNewCustomer({...newCustomer, alternatePhone: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección Completa:</label>
                  <textarea
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    rows={3}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Información Demográfica */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#ff9800', marginBottom: '15px', borderBottom: '2px solid #fff3e0', paddingBottom: '8px' }}>
                  👤 Información Demográfica
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fecha de Nacimiento:</label>
                    <input
                      type="date"
                      value={newCustomer.birthDate}
                      onChange={(e) => setNewCustomer({...newCustomer, birthDate: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Género:</label>
                    <select
                      value={newCustomer.gender}
                      onChange={(e) => setNewCustomer({...newCustomer, gender: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Otro">Otro</option>
                      <option value="Prefiero no decir">Prefiero no decir</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ocupación:</label>
                    <input
                      type="text"
                      value={newCustomer.occupation}
                      onChange={(e) => setNewCustomer({...newCustomer, occupation: e.target.value})}
                      placeholder="Ej: Doctora, Ingeniero, Empresario"
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Información Comercial */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#9c27b0', marginBottom: '15px', borderBottom: '2px solid #f3e5f5', paddingBottom: '8px' }}>
                  💼 Información Comercial
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tipo de Cliente:</label>
                    <select
                      value={newCustomer.customerType}
                      onChange={(e) => setNewCustomer({...newCustomer, customerType: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    >
                      <option value="Particular">Particular</option>
                      <option value="Empresa">Empresa</option>
                      <option value="Mayorista">Mayorista</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nivel de Descuento:</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                      <select
                        value={newCustomer.discountLevel}
                        onChange={(e) => setNewCustomer({...newCustomer, discountLevel: e.target.value})}
                        style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                      >
                        <option value="Bronze">Bronze (0% descuento)</option>
                        <option value="Silver">Silver (5% descuento)</option>
                        <option value="Gold">Gold (8% descuento)</option>
                        <option value="Platinum">Platinum (12% descuento)</option>
                      </select>
                      {editingCustomer && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const level = await calculateCustomerLevelBasic(editingCustomer.id);
                              setNewCustomer({...newCustomer, discountLevel: level});
                              alert(`Nivel calculado automáticamente: ${level}`);
                            } catch (error) {
                              console.error('Error calculating level:', error);
                              alert('Error al calcular el nivel automáticamente');
                            }
                          }}
                          style={{
                            padding: '10px 15px',
                            background: 'linear-gradient(135deg, #ff9800, #f57c00)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}
                          title="Calcular nivel automáticamente basado en historial de compras"
                        >
                          🔄 Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Contacto Preferido:</label>
                    <select
                      value={newCustomer.preferredContact}
                      onChange={(e) => setNewCustomer({...newCustomer, preferredContact: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    >
                      <option value="Email">Email</option>
                      <option value="Teléfono">Teléfono</option>
                      <option value="SMS">SMS</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Rango de Presupuesto:</label>
                    <select
                      value={newCustomer.budgetRange}
                      onChange={(e) => setNewCustomer({...newCustomer, budgetRange: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="$500 - $2,000">$500 - $2,000</option>
                      <option value="$2,000 - $5,000">$2,000 - $5,000</option>
                      <option value="$5,000 - $10,000">$5,000 - $10,000</option>
                      <option value="$10,000 - $25,000">$10,000 - $25,000</option>
                      <option value="$25,000+">$25,000+</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Referido por:</label>
                    <input
                      type="text"
                      value={newCustomer.referredBy}
                      onChange={(e) => setNewCustomer({...newCustomer, referredBy: e.target.value})}
                      placeholder="Nombre del referente"
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Información Adicional */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#f44336', marginBottom: '15px', borderBottom: '2px solid #ffebee', paddingBottom: '8px' }}>
                  📝 Información Adicional
                </h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Notas del Cliente:</label>
                  <textarea
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                    rows={3}
                    placeholder="Preferencias, alergias, información importante..."
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                  <input
                    type="checkbox"
                    checked={newCustomer.isActive}
                    onChange={(e) => setNewCustomer({...newCustomer, isActive: e.target.checked})}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label style={{ fontWeight: 'bold' }}>Cliente Activo</label>
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '2px solid #f0f0f0' }}>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ 
                    padding: '12px 25px', 
                    border: '2px solid #ddd', 
                    background: 'white',
                    color: '#666',
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ❌ Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ 
                    background: 'linear-gradient(135deg, #4caf50, #45a049)', 
                    color: 'white', 
                    padding: '12px 25px', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)'
                  }}
                >
                  {editingCustomer ? '💾 Actualizar Cliente' : '➕ Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla mejorada de clientes */}
      <div style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', border: '1px solid #e0e0e0', boxShadow: '0 8px 25px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(135deg, #f5f5f5, #e8e8e8)' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Cliente</th>
              <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Contacto</th>
              <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Perfil</th>
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Nivel</th>
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Estado</th>
              <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <td style={{ padding: '15px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>{customer.name}</div>
                    {customer.occupation && (
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>{customer.occupation}</div>
                    )}
                    {customer.birthDate && (
                      <div style={{ fontSize: '11px', color: '#999' }}>
                        Edad: {calculateAge(customer.birthDate)} años
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '15px' }}>
                  <div style={{ fontSize: '14px' }}>
                    {customer.email && <div>📧 {customer.email}</div>}
                    {customer.phone && <div>📞 {customer.phone}</div>}
                    {customer.preferredContact && (
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        Prefiere: {customer.preferredContact}
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
                      background: getCustomerTypeColor(customer.customerType || 'Particular'),
                      marginRight: '5px'
                    }}>
                      {customer.customerType || 'Particular'}
                    </span>
                    {customer.budgetRange && (
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                        Presupuesto: {customer.budgetRange}
                      </div>
                    )}
                    {customer.gender && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {customer.gender}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: getDiscountColor(customer.discountLevel)
                  }}>
                    {customer.discountLevel}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: customer.isActive !== false ? '#4caf50' : '#f44336'
                  }}>
                    {customer.isActive !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <button 
                    onClick={() => setDetailsCustomer(customer)}
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
                    onClick={() => handleEdit(customer)}
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
                    onClick={() => recalcLevelFor(customer)}
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
                    title="Recalcular nivel de este cliente"
                  >
                    ⭐ Nivel
                  </button>
                  <button 
                    onClick={() => handleDelete(customer.id)}
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
      {detailsCustomer && (
        <CustomerDetailsModal
          customer={detailsCustomer}
          stats={getStatsForCustomer(detailsCustomer.id)}
          onClose={() => setDetailsCustomer(null)}
        />
      )}
    </div>
  );
};

// Modal de detalles de cliente
const CustomerDetailsModal: React.FC<{ customer:any, onClose:()=>void, stats:any }>= ({ customer, onClose, stats }) => {
  const phoneDigits = (customer.phone||'').replace(/\D+/g,'');
  const waLink = phoneDigits ? `https://wa.me/${phoneDigits}` : '';
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

function App() {
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');

  console.log('🚀 Joyería PVenta - App component rendering...', { currentView });

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'sales':
        return <Sales />;
      case 'products':
        return <Products />;
      case 'customers':
        return <Customers />;
      case 'cash-session':
        return <CashSession />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    { id: 'dashboard' as CurrentView, label: 'Dashboard', icon: '📊' },
    { id: 'sales' as CurrentView, label: 'Ventas', icon: '🛒' },
    { id: 'products' as CurrentView, label: 'Productos', icon: '📦' },
    { id: 'customers' as CurrentView, label: 'Clientes', icon: '👥' },
    { id: 'cash-session' as CurrentView, label: 'Corte de Caja', icon: '💰' },
    { id: 'reports' as CurrentView, label: 'Reportes', icon: '📈' },
    { id: 'settings' as CurrentView, label: 'Configuración', icon: '⚙️' }
  ];

  return (
    <div className="app-shell jewelry-theme" style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden' }}>
      <div className="luxury-sidebar" style={{ width:'clamp(240px,18vw,300px)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'32px 30px 28px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="sidebar-brand" style={{ margin:0, fontSize:'28px', fontWeight:600 }}>Joyería PVenta</h2>
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
          <div style={{ marginTop:'4px' }}>© 2025 Joyería PVenta</div>
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
