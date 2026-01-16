import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OrderItem,
  PaymentMethod,
  QuickSale,
  DiscountMap,
  getInitialPaymentMethod,
  loadVentasData,
  readDiscountMapFromLocal,
  readTaxRateFromLocal,
  readTaxRateFromSettings,
  addProductToOrder as addProductToOrderSvc,
  addManualQuickSale as addManualQuickSaleSvc,
  removeItem as removeItemSvc,
  updateQty as updateQtySvc,
  updatePrice as updatePriceSvc,
  computeFilteredProducts,
  computeTotals,
  confirmOrder as confirmOrderSvc,
  loadDiscountMapFromSettings,
} from '../../../domain/ventas/ventasService';
import { searchCustomers } from '../../../domain/clientes/clientesService';

const ClienteSelector: React.FC<{ customers: any[]; onSelect: (c: any)=>void }> = ({ customers, onSelect }) => {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const term = q.trim();
    if (term.length < 2) return [];
    return searchCustomers(customers, term);
  }, [customers, q]);
  return (
    <div>
      <input
        type="text"
        value={q}
        onChange={e=> setQ(e.target.value)}
        placeholder="Buscar cliente (min 2 caracteres)"
        style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:6 }}
      />
      {q.trim().length>=2 && (
        <div style={{ maxHeight:150, overflow:'auto', border:'1px solid #eee', borderRadius:8 }}>
          {list.length===0 ? (
            <div style={{ padding:8, color:'#666' }}>Sin resultados</div>
          ) : list.map(c=> (
            <div key={c.id} onClick={()=> onSelect(c)} style={{ padding:8, cursor:'pointer', borderBottom:'1px solid #f0f0f0' }}>
              <strong>{c.name}</strong> · {c.email||c.phone||''} <span style={{ color:'#888' }}>#{c.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Página principal del módulo de Ventas (UI) extraída desde App.tsx
export const VentasPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    let systemSettings: any = null;
    try {
      const raw = localStorage.getItem('systemSettings');
      systemSettings = raw ? JSON.parse(raw) : null;
    } catch {}
    return getInitialPaymentMethod(systemSettings);
  });

  const [quickSale, setQuickSale] = useState<QuickSale>({
    fecha: new Date().toISOString().split('T')[0],
    categoria: 'Anillos',
    cantidad: 1,
    precioUnitario: 0,
    notas: ''
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [cashSessions, setCashSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionInitialAmount, setSessionInitialAmount] = useState<string>('');
  const [sessionNote, setSessionNote] = useState('');
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Configuración de descuentos/IVA
  const [discountMap, setDiscountMap] = useState<DiscountMap>({ Bronze: 0, Silver: 0.05, Gold: 0.08, Platinum: 0.12 });
  const [taxRate, setTaxRate] = useState(0.16);

  const loadData = useCallback(async () => {
    try {
      if (!(window as any).electronAPI) {
        setProducts([]);
        setCustomers([]);
        setRecentSales([]);
        return;
      }
      const [productsData, customersData, salesData] = await Promise.all([
        (window as any).electronAPI.getProducts(),
        (window as any).electronAPI.getCustomers(),
        (window as any).electronAPI.getSales()
      ]);
      const data = await loadVentasData(productsData, customersData, salesData);
      setProducts(data.products);
      setCustomers(data.customers);
      setRecentSales(data.recentSales);
    } catch (e) {
      console.error('Error loading sales data:', e);
    }
  }, []);

  const loadCashSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      if (!(window as any).electronAPI?.getCashSessions) {
        setCashSessions([]);
        return;
      }
      const sessions = await (window as any).electronAPI.getCashSessions();
      setCashSessions(sessions || []);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadCashSessions();
    const off = (window as any).electronAPI?.onSalesChanged?.(() => {
      loadData().catch(() => {});
    });
    return () => { if (typeof off === 'function') off(); };
  }, [loadData, loadCashSessions]);

  useEffect(() => {
    // Inicial rápido por localStorage para no bloquear UI
    setDiscountMap(readDiscountMapFromLocal(localStorage.getItem('discountLevels')));
    const localTax = readTaxRateFromLocal(localStorage.getItem('businessSettings'));
    setTaxRate(localTax);
    // Sincronizar desde settings
    const loadSettingsFromIPC = async () => {
      if (!(window as any).electronAPI?.getSettings) return;
      const rows = await (window as any).electronAPI.getSettings();
      const tax = await readTaxRateFromSettings(rows, localTax);
      setTaxRate(tax);
      const settingsMap = new Map((rows || []).map((r: any) => [r.key, r.value] as const));
      let levels: { Bronze?: number; Silver?: number; Gold?: number; Platinum?: number } | null = null;
      const rawLevels =
        settingsMap.get('discountLevels') ||
        settingsMap.get('discount_levels') ||
        settingsMap.get('customer_discount_levels');
      if (rawLevels) {
        try {
          levels = JSON.parse(rawLevels);
        } catch {
          levels = null;
        }
      } else {
        const fromKey = (key: string) => {
          const value = settingsMap.get(key);
          if (value === undefined) return undefined;
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : undefined;
        };
        levels = {
          Bronze:
            fromKey('discount_bronze') ??
            fromKey('discount_level_bronze'),
          Silver:
            fromKey('discount_silver') ??
            fromKey('discount_level_silver'),
          Gold:
            fromKey('discount_gold') ??
            fromKey('discount_level_gold'),
          Platinum:
            fromKey('discount_platinum') ??
            fromKey('discount_level_platinum'),
        };
        if (
          levels.Bronze === undefined &&
          levels.Silver === undefined &&
          levels.Gold === undefined &&
          levels.Platinum === undefined
        ) {
          levels = null;
        }
      }
      const nextMap = await loadDiscountMapFromSettings(levels);
      setDiscountMap(nextMap);
    };
    loadSettingsFromIPC().catch(() => {});
  }, []);

  // Productos → agregar al pedido
  const addProductToOrder = (product:any) => {
    setOrderItems(prev => addProductToOrderSvc(prev, product));
  };

  // Venta rápida → agrega línea manual
  const submitQuickSale = (e: React.FormEvent) => {
    e.preventDefault();
    const next = addManualQuickSaleSvc(orderItems, quickSale);
    if (next === orderItems) {
      setFeedback({ type: 'error', message: 'Cantidad y precio deben ser mayores a 0' });
      return;
    }
    setOrderItems(next);
    setQuickSale({ fecha: new Date().toISOString().split('T')[0], categoria: quickSale.categoria, cantidad: 1, precioUnitario: 0, notas: '' });
  };

  // Edición de líneas
  const removeItem = (id:number) => setOrderItems(prev => removeItemSvc(prev, id));
  const updateQty = (id:number, qty:number) => setOrderItems(prev => updateQtySvc(prev, id, qty));
  const updatePriceManual = (id:number, price:number) => setOrderItems(prev => updatePriceSvc(prev, id, price));

  // Cliente filtrado

  // Totales
  const { subtotal, discount, tax, total } = computeTotals(orderItems, selectedCustomer, discountMap, taxRate);
  const currency = useMemo(()=> new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);
  const appliedLevel = selectedCustomer?.discountLevel || 'Bronze';
  const appliedPercent = Math.round(((discountMap[appliedLevel]||0) * 100));
  const openSession = cashSessions.find((s) => s.status === 'Abierta') || null;
  const showCashGate = !openSession;

  const confirmOrder = useCallback(async () => {
    if (orderItems.length === 0 || isConfirming) return;
    if (showCashGate) {
      setFeedback({ type: 'error', message: 'Para hacer una venta primero debes abrir una sesión de caja.' });
      return;
    }
    setIsConfirming(true);
    try {
      let requireCustomer = false;
      try {
        const sys = localStorage.getItem('systemSettings');
        if (sys) {
          const parsed = JSON.parse(sys);
          requireCustomer = !!parsed.requireCustomerForSale;
        }
      } catch {}
      const saleData = await confirmOrderSvc(
        orderItems,
        selectedCustomer,
        paymentMethod,
        { subtotal, discount, tax, total },
        { requireCustomer }
      );
      if ((window as any).electronAPI?.createSale && saleData) {
        await (window as any).electronAPI.createSale(saleData);
      }
      setOrderItems([]);
      setSelectedCustomer(null);
      await loadData();
      setFeedback({ type: 'success', message: 'Compra confirmada y guardada' });
    } catch (e: any) {
      if (e?.message === 'REQUIRE_CUSTOMER') {
        setFeedback({ type: 'error', message: 'Debes seleccionar un cliente para confirmar la venta' });
      } else {
        console.error('Error al confirmar compra:', e);
        setFeedback({ type: 'error', message: 'Error al confirmar la compra' });
      }
    } finally {
      setIsConfirming(false);
    }
  }, [orderItems, isConfirming, selectedCustomer, paymentMethod, subtotal, discount, tax, total, loadData, showCashGate]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const filteredProducts = computeFilteredProducts(products, searchTerm);

  return (
    <div style={{ position:'relative', padding:'30px', display:'grid', gridTemplateColumns:'1fr 420px', gap:'30px', minHeight:'100vh' }}>
      {showCashGate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15, 23, 42, 0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9998 }}>
          <div style={{ background:'#fff', padding:'22px 24px', borderRadius:12, boxShadow:'0 12px 32px rgba(0,0,0,0.2)', width:'min(420px, 90vw)' }}>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Sesión de caja requerida</div>
            <div style={{ color:'#555', marginBottom:14 }}>Para hacer una venta primero debes abrir una sesión de caja.</div>
            <button
              type="button"
              onClick={() => {
                setSessionError(null);
                setShowSessionModal(true);
              }}
              style={{ width:'100%', background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'10px 12px', cursor:'pointer', fontWeight:600 }}
              disabled={isLoadingSessions}
            >
              Nueva sesión
            </button>
          </div>
        </div>
      )}
      {showSessionModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
          <div style={{ background:'#fff', padding:20, borderRadius:12, width:'min(420px, 90vw)', boxShadow:'0 12px 32px rgba(0,0,0,0.25)' }}>
            <h3 style={{ marginTop:0 }}>Nueva sesión de caja</h3>
            <div style={{ display:'grid', gap:10 }}>
              <div style={{ display:'grid', gap:6 }}>
                <label>Monto inicial</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={sessionInitialAmount}
                  onChange={(e) => {
                    setSessionInitialAmount(e.target.value);
                    setSessionError(null);
                  }}
                />
                <div style={{ fontSize:12, color:'#667085' }}>Ingresa el efectivo con el que inicia la caja.</div>
              </div>
              <div style={{ display:'grid', gap:6 }}>
                <label>Nota (opcional)</label>
                <input
                  type="text"
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                  placeholder="Ej: Cambio inicial"
                />
              </div>
              {sessionError && <div style={{ color:'#d32f2f', fontSize:12 }}>{sessionError}</div>}
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSessionModal(false);
                    setSessionError(null);
                  }}
                  style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'8px 12px' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const initialAmountValue = Number(sessionInitialAmount);
                    if (!Number.isFinite(initialAmountValue) || initialAmountValue < 0) {
                      setSessionError('El monto inicial debe ser 0 o mayor.');
                      return;
                    }
                    const api = (window as any).electronAPI;
                    if (!api?.createCashSession) {
                      alert('IPC no disponible');
                      return;
                    }
                    try {
                      await api.createCashSession({
                        startTime: new Date().toISOString(),
                        initialAmount: initialAmountValue || 0,
                        status: 'Abierta',
                        notes: sessionNote.trim() || undefined,
                        endTime: null,
                        finalAmount: 0,
                      });
                      await loadCashSessions();
                      setShowSessionModal(false);
                      setSessionInitialAmount('');
                      setSessionNote('');
                      setSessionError(null);
                      setFeedback({ type: 'success', message: 'Sesión abierta. Ya puedes vender.' });
                    } catch (err: any) {
                      if (err?.message === 'CASH_SESSION_ALREADY_OPEN') {
                        await loadCashSessions();
                        setShowSessionModal(false);
                        setSessionError(null);
                        return;
                      }
                      setSessionError('No se pudo crear la sesión.');
                    }
                  }}
                  style={{ background:'#2f6fed', color:'#fff', border:'none', borderRadius:8, padding:'8px 12px', fontWeight:600 }}
                >
                  Crear sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isConfirming && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, pointerEvents:'auto' }}>
          <div style={{ background:'#fff', padding:'18px 24px', borderRadius:12, boxShadow:'0 12px 32px rgba(0,0,0,0.25)', fontWeight:600 }}>
            Procesando transacción…
          </div>
        </div>
      )}
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
                <option>Medalla</option><option>Cruz</option><option>Dije</option><option>Cadena</option><option>Juego</option><option>Anillo</option><option>Anillo-Compromiso</option><option>Anillo-Hombre</option><option>Argolla</option><option>Pulsera</option><option>Esclava</option><option>Arete</option><option>Broquel</option><option>Collar</option><option>Limpieza</option>
                <option>Otros</option>
              </select>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Cantidad</label>
              <input type="number" min={1} value={quickSale.cantidad}
                onChange={e=>setQuickSale({...quickSale, cantidad: Math.max(1, parseInt((e.target as HTMLInputElement).value)||1)})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Precio Unitario</label>
              <input type="number" min={0} step="0.01" value={quickSale.precioUnitario}
                onChange={e=>setQuickSale({...quickSale, precioUnitario: Math.max(0, parseFloat((e.target as HTMLInputElement).value)||0)})}
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }} />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Notas</label>
              <input type="text" value={quickSale.notas} onChange={e=>setQuickSale({...quickSale, notas:(e.target as HTMLInputElement).value})}
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
              onMouseOver={(e) => { if (product.stock>0) { (e.currentTarget as HTMLDivElement).style.transform='translateY(-5px)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 25px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLDivElement).style.borderColor='#4299e1'; } }}
              onMouseOut={(e) => { (e.currentTarget as HTMLDivElement).style.transform='translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 15px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor='#e2e8f0'; }}>
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
          <ClienteSelector customers={customers} onSelect={(c)=> setSelectedCustomer(c)} />
          {selectedCustomer ? (
            <div style={{ marginTop:8, padding:'10px 12px', background:'linear-gradient(135deg, #4299e1, #3182ce)', borderRadius:8, color:'#fff', fontSize:13, textAlign:'center' }}>
              Cliente seleccionado: <strong>{selectedCustomer.name}</strong> · Nivel: {selectedCustomer.discountLevel} · Descuento: {Math.round((discountMap[selectedCustomer.discountLevel]||0)*100)}%
            </div>
          ) : (
            <div style={{ marginTop:8, fontSize:12, color:'#666' }}>Cliente general (sin seleccionar)</div>
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
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unitPrice}
                      onChange={e=>updatePriceManual(it.id, parseFloat((e.target as HTMLInputElement).value)||0)}
                      style={{ marginLeft:8, width:110, padding:'4px 6px', border:'1px solid #ddd', borderRadius:6 }}
                    />
                    <span style={{ fontSize:12, color:'#666' }}> c/u</span>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontWeight:700 }}>${(it.unitPrice*it.quantity).toFixed(2)}</div>
                  <button onClick={()=>removeItem(it.id)} style={{ marginTop:6, background:'#fff', color:'#d32f2f', border:"1px solid #d32f2f", borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen y pago */}
        <div style={{ borderTop:'1px solid #ddd', paddingTop:12, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span>Subtotal</span><span>{currency.format(subtotal)}</span></div>
          {discount>0 && (
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, color:'#d32f2f' }}>
              <span>Descuento {selectedCustomer ? `(Nivel ${appliedLevel} – ${appliedPercent}%)` : ''}</span>
              <span>- {currency.format(discount)}</span>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span>IVA ({Math.round(taxRate*100)}%)</span><span>{currency.format(tax)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:18, fontWeight:700, borderTop:'1px solid #ddd', paddingTop:8 }}><span>Total</span><span>{currency.format(total)}</span></div>
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:12, color:'#666', marginBottom:6 }}>Método de pago</label>
          <select value={paymentMethod} onChange={e=>setPaymentMethod((e.target as HTMLSelectElement).value as any)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8 }}>
            <option value="Efectivo">Efectivo</option>
            <option value="Tarjeta">Tarjeta</option>
            <option value="Transferencia">Transferencia</option>
          </select>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={confirmOrder}
            disabled={orderItems.length===0 || isConfirming || showCashGate}
            style={{
              flex:1,
              background:'#4caf50',
              color:'#fff',
              border:'none',
              borderRadius:6,
              padding:'10px 12px',
              cursor: orderItems.length===0 || isConfirming || showCashGate ? 'not-allowed' : 'pointer',
              fontWeight:700,
              opacity: orderItems.length===0 || isConfirming || showCashGate ? 0.6 : 1
            }}
          >
            Confirmar compra
          </button>
          <button onClick={()=>setOrderItems([])} disabled={orderItems.length===0 || isConfirming} style={{ flex:1, background:'#fff', color:'#333', border:'1px solid #ddd', borderRadius:6, padding:'10px 12px', cursor: orderItems.length===0 || isConfirming ? 'not-allowed' : 'pointer', opacity: orderItems.length===0 || isConfirming ? 0.6 : 1 }}>Cancelar</button>
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
      {feedback && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: feedback.type === 'success' ? '#2f855a' : feedback.type === 'error' ? '#c53030' : '#2b6cb0',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 10,
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
            zIndex: 2000,
            minWidth: 220,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
};
