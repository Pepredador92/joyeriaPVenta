import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ToastTone = 'info' | 'success' | 'error';

type QuickSaleDraft = {
  fecha: string;
  categoria: string;
  cantidad: string;
  precioUnitario: string;
  notas: string;
};

type VentasPageProps = {
  onNotify?: (message: string, tone?: ToastTone) => void;
};

const sanitizeIntegerDraft = (raw: string, fallback: number): { value: number; display: string } => {
  const digits = (raw ?? '').toString().replace(/[^0-9]/g, '');
  if (!digits) {
    return { value: fallback, display: String(fallback) };
  }
  const parsed = Math.max(fallback, parseInt(digits, 10));
  return { value: parsed, display: String(parsed) };
};

const sanitizeMoneyDraft = (raw: string): { value: number | null; display: string } => {
  if (typeof raw !== 'string') {
    return { value: null, display: '' };
  }
  const normalized = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  if (!normalized) {
    return { value: null, display: '' };
  }
  const parsed = parseFloat(normalized);
  if (Number.isNaN(parsed)) {
    return { value: null, display: '' };
  }
  const clamped = Math.max(0, Math.min(999999999, parsed));
  const display = clamped === 0 ? '0.00' : clamped.toFixed(2);
  return { value: clamped, display };
};

const formatMoneyForInput = (value: number) => {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0.00';
  return value.toFixed(2);
};

const buildInitialQuickSaleDraft = (categoryList: string[], preferredCategory?: string): QuickSaleDraft => {
  const normalizedPreferred = (preferredCategory || '').trim();
  return {
    fecha: new Date().toISOString().split('T')[0],
    categoria: normalizedPreferred || categoryList[0] || '',
    cantidad: '1',
    precioUnitario: '',
    notas: '',
  };
};

const ClienteSelector: React.FC<{ onSelect: (c: any)=>void }> = ({ onSelect }) => {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    let cancel = false;
    const run = async () => {
      const term = q.trim();
      if (term.length < 2) { setList([]); return; }
      setLoading(true);
      try {
        const res = await searchCustomers(term);
        if (!cancel) setList(res);
      } finally { if (!cancel) setLoading(false); }
    };
    run();
    return ()=> { cancel = true; };
  }, [q]);
  return (
    <div>
      <input
        type="text"
        value={q}
        onChange={e=> setQ(e.target.value)}
        placeholder="Buscar cliente (min 2 caracteres)"
        style={{ width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, marginBottom:6 }}
      />
      {loading && <div style={{ fontSize:12, color:'#666' }}>Buscando…</div>}
      {!loading && q.trim().length>=2 && (
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
export const VentasPage: React.FC<VentasPageProps> = ({ onNotify }) => {
  const aliveRef = useRef(true);
  useEffect(() => () => {
    aliveRef.current = false;
  }, []);

  const [products, setProducts] = useState<any[]>([]);
  // clientes completos ya no se mantienen en este componente; ClienteSelector consulta al dominio
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => getInitialPaymentMethod());

  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const notesInputRef = useRef<HTMLInputElement | null>(null);

  const [quickSaleDraft, setQuickSaleDraft] = useState<QuickSaleDraft>(() => buildInitialQuickSaleDraft([]));

  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Configuración de descuentos/IVA
  const [discountMap, setDiscountMap] = useState<DiscountMap>({ Bronze: 0, Silver: 0.05, Gold: 0.08, Platinum: 0.12 });
  const [taxRate, setTaxRate] = useState(0.16);

  const handleCustomerSelect = useCallback((customer: any) => {
    setSelectedCustomer(customer);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await loadVentasData();
      if (!aliveRef.current) return;
      setProducts(data.products);
      setRecentSales(data.recentSales);
    } catch (e) {
      if (aliveRef.current) {
        console.error('Error loading sales data:', e);
      }
    }
  }, []);

  const loadCategoryOptions = useCallback(async () => {
    try {
      const api = (window as any).electronAPI;
      if (!api?.getCategoryCatalog) return;
      const rows = await api.getCategoryCatalog();
      if (!aliveRef.current) return;
      if (!Array.isArray(rows)) {
        setCategories((prev) => (prev.length ? [] : prev));
        return;
      }
      const names = rows
        .map((cat: any) => (typeof cat?.name === 'string' ? cat.name.trim() : ''))
        .filter((name: string) => name);
      const unique = Array.from(new Set(names));
      setCategories((prev) => {
        if (prev.length === unique.length && prev.every((value, index) => value === unique[index])) {
          return prev;
        }
        return unique;
      });
    } catch (err) {
      if (aliveRef.current) {
        console.warn('No se pudieron cargar categorías', err);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    loadCategoryOptions();
    const off = (window as any).electronAPI?.onSalesChanged?.(() => {
      loadData().catch(() => {});
    });
    return () => { if (typeof off === 'function') off(); };
  }, [loadData, loadCategoryOptions]);

  useEffect(() => {
    if (!categories.length) return;
    setQuickSaleDraft((prev) => {
      if ((prev.categoria || '').trim()) {
        return prev;
      }
      if (document.activeElement === categoryInputRef.current) {
        return prev;
      }
      return { ...prev, categoria: categories[0] };
    });
  }, [categories]);

  useEffect(() => {
    // Inicial rápido por localStorage para no bloquear UI
    setDiscountMap(readDiscountMapFromLocal());
    const localTax = readTaxRateFromLocal();
    setTaxRate(localTax);
    // Sincronizar desde settings
    readTaxRateFromSettings(localTax).then(setTaxRate).catch(()=>{});
    loadDiscountMapFromSettings().then(setDiscountMap).catch(()=>{});
  }, []);

  // Productos → agregar al pedido
  const addProductToOrder = useCallback((product: any) => {
    setOrderItems((prev) => addProductToOrderSvc(prev, product));
  }, []);

  // Venta rápida → agrega línea manual
  useEffect(() => {
    if (!orderItems.length) {
      setPriceDrafts((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    setPriceDrafts((prev) => {
      let changed = false;
      const next: Record<number, string> = {};
      for (const item of orderItems) {
        const fallback = formatMoneyForInput(item.unitPrice);
        const existing = prev[item.id];
        if (existing === undefined) {
          next[item.id] = fallback;
          changed = true;
        } else if (existing !== fallback) {
          next[item.id] = fallback;
          changed = true;
        } else {
          next[item.id] = existing;
        }
      }
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [orderItems]);

  const submitQuickSale = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCategory = quickSaleDraft.categoria.trim() || categories[0] || '';
    const normalizedQuickSale: QuickSale = {
      fecha: quickSaleDraft.fecha,
      categoria: trimmedCategory,
      cantidad: sanitizeIntegerDraft(quickSaleDraft.cantidad, 1).value,
      precioUnitario: sanitizeMoneyDraft(quickSaleDraft.precioUnitario).value ?? 0,
      notas: quickSaleDraft.notas.trim(),
    };
    const next = addManualQuickSaleSvc(orderItems, normalizedQuickSale);
    if (next === orderItems) {
      onNotify?.('Cantidad y precio deben ser mayores a 0', 'error');
      return;
    }
    setOrderItems(next);
    setQuickSaleDraft(buildInitialQuickSaleDraft(categories, trimmedCategory));
    if (quantityInputRef.current) {
      quantityInputRef.current.focus();
    }
  }, [orderItems, quickSaleDraft, categories]);

  // Edición de líneas
  const removeItem = useCallback((id: number) => {
    setOrderItems((prev) => removeItemSvc(prev, id));
    setPriceDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const updateQty = useCallback((id: number, qty: number) => {
    setOrderItems((prev) => updateQtySvc(prev, id, qty));
  }, []);
  const updatePriceManual = useCallback((id: number, price: number) => {
    setOrderItems((prev) => updatePriceSvc(prev, id, price));
  }, []);

  // Cliente filtrado

  // Totales
  const { subtotal, discount, tax, total } = computeTotals(orderItems, selectedCustomer, discountMap, taxRate);
  const currency = useMemo(()=> new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), []);
  const appliedLevel = selectedCustomer?.discountLevel || 'Bronze';
  const appliedPercent = Math.round(((discountMap[appliedLevel]||0) * 100));

  const confirmOrder = useCallback(async () => {
    if (orderItems.length === 0 || isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmOrderSvc(orderItems, selectedCustomer, paymentMethod, { subtotal, discount, tax, total });
      if (!aliveRef.current) {
        return;
      }
      setOrderItems([]);
      setSelectedCustomer(null);
      await loadData();
      if (aliveRef.current) {
        onNotify?.('Compra confirmada y guardada', 'success');
      }
    } catch (e: any) {
      if (aliveRef.current) {
        const code = e?.code || e?.message;
        if (code === 'REQUIRE_CUSTOMER') {
          onNotify?.('Debes seleccionar un cliente para confirmar la venta', 'error');
        } else if (code === 'CUSTOMER_NOT_FOUND') {
          onNotify?.('Cliente no encontrado. Selecciona nuevamente.', 'error');
        } else if (code === 'INSUFFICIENT_STOCK') {
          const cat = e?.categoryName ? ` para ${e.categoryName}` : '';
          onNotify?.(`Stock insuficiente${cat}. Verifica las cantidades.`, 'error');
        } else if (code === 'INVALID_ITEM') {
          onNotify?.('Hay líneas de venta con datos inválidos. Revisa cantidades y precios.', 'error');
        } else if (code === 'SALE_CONFIRMATION_FAILED') {
          onNotify?.('Error al confirmar la compra. Inténtalo nuevamente.', 'error');
        } else {
          console.error('Error al confirmar compra:', e);
          onNotify?.('Error al confirmar la compra', 'error');
        }
      }
    } finally {
      if (aliveRef.current) {
        setIsConfirming(false);
      }
    }
  }, [orderItems, isConfirming, selectedCustomer, paymentMethod, subtotal, discount, tax, total, loadData]);

  const filteredProducts = useMemo(
    () => computeFilteredProducts(products, searchTerm),
    [products, searchTerm]
  );

  return (
    <div style={{ position:'relative', padding:'30px', display:'grid', gridTemplateColumns:'1fr 420px', gap:'30px', minHeight:'100vh' }}>
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
              <input
                type="date"
                value={quickSaleDraft.fecha}
                onChange={(e) =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    fecha: e.target.value,
                  }))
                }
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Categoría</label>
              <input
                ref={categoryInputRef}
                type="text"
                list="ventas-category-catalog"
                value={quickSaleDraft.categoria}
                onChange={(e) =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    categoria: e.target.value,
                  }))
                }
                placeholder="Selecciona o crea"
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}
              />
              <datalist id="ventas-category-catalog">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Cantidad</label>
              <input
                ref={quantityInputRef}
                type="number"
                min={1}
                value={quickSaleDraft.cantidad}
                onChange={(e) =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    cantidad: e.target.value,
                  }))
                }
                onBlur={() =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    cantidad: sanitizeIntegerDraft(prev.cantidad, 1).display,
                  }))
                }
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}
              />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Precio Unitario</label>
              <input
                ref={priceInputRef}
                type="number"
                min={0}
                step="0.01"
                value={quickSaleDraft.precioUnitario}
                onChange={(e) =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    precioUnitario: e.target.value,
                  }))
                }
                onBlur={() =>
                  setQuickSaleDraft((prev) => {
                    const sanitized = sanitizeMoneyDraft(prev.precioUnitario);
                    return {
                      ...prev,
                      precioUnitario: sanitized.value === null ? '' : sanitized.display,
                    };
                  })
                }
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}
              />
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:12, color:'#666' }}>Notas</label>
              <input
                ref={notesInputRef}
                type="text"
                value={quickSaleDraft.notas}
                onChange={(e) =>
                  setQuickSaleDraft((prev) => ({
                    ...prev,
                    notas: (e.target as HTMLInputElement).value,
                  }))
                }
                placeholder="Opcional"
                style={{ width:'100%', padding:8, border:'1px solid #ddd', borderRadius:6 }}
              />
            </div>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <button type="submit" style={{ background:'#2196f3', color:'#fff', border:'none', borderRadius:6, padding:'10px 14px', cursor:'pointer' }}>Agregar al pedido</button>
              <button
                type="button"
                onClick={() => {
                  setQuickSaleDraft(buildInitialQuickSaleDraft(categories));
                  if (categoryInputRef.current) {
                    categoryInputRef.current.focus();
                  }
                }}
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
          <ClienteSelector onSelect={handleCustomerSelect} />
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
                  <div style={{ fontSize:12, color:'#666' }}>{it.categoryName || 'Sin categoría'} {it.type==='manual' && '· Manual'}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
                    <button onClick={()=>updateQty(it.id, it.quantity-1)} style={{ width:24, height:24, border:'1px solid #ddd', background:'#fff', cursor:'pointer' }}>-</button>
                    <span style={{ minWidth:20, textAlign:'center' }}>{it.quantity}</span>
                    <button onClick={()=>updateQty(it.id, it.quantity+1)} style={{ width:24, height:24, border:'1px solid #ddd', background:'#fff', cursor:'pointer' }}>+</button>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={priceDrafts[it.id] ?? formatMoneyForInput(it.unitPrice)}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setPriceDrafts((prev) => {
                          if (prev[it.id] === nextValue) return prev;
                          return { ...prev, [it.id]: nextValue };
                        });
                      }}
                      onBlur={() => {
                        const currentDraft = priceDrafts[it.id] ?? '';
                        const sanitized = sanitizeMoneyDraft(currentDraft);
                        if (sanitized.value === null) {
                          setPriceDrafts((prev) => ({ ...prev, [it.id]: formatMoneyForInput(it.unitPrice) }));
                          return;
                        }
                        setPriceDrafts((prev) => ({ ...prev, [it.id]: sanitized.display }));
                        if (sanitized.value !== it.unitPrice) {
                          updatePriceManual(it.id, sanitized.value);
                        }
                      }}
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
          <button onClick={confirmOrder} disabled={orderItems.length===0 || isConfirming} style={{ flex:1, background:'#4caf50', color:'#fff', border:'none', borderRadius:6, padding:'10px 12px', cursor: orderItems.length===0 || isConfirming ? 'not-allowed' : 'pointer', fontWeight:700, opacity: orderItems.length===0 || isConfirming ? 0.6 : 1 }}>Confirmar compra</button>
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
    </div>
  );
};

