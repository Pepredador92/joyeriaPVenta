import React, { useEffect, useMemo, useState } from 'react';
import {
  loadInventario,
  filterInventario,
  registrarEntrada,
  registrarSalida,
  ajustarStock,
  validateInventarioMovimiento,
  MovimientoInventario,
  InventarioItem,
} from '../../../domain/inventario/inventarioService';

export const InventarioPage: React.FC = () => {
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [tipo, setTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [productId, setProductId] = useState<number | ''>('' as any);
  const [cantidad, setCantidad] = useState<number>(1);
  const [nuevoStock, setNuevoStock] = useState<number>(0);
  const [razon, setRazon] = useState('');
  const [documento, setDocumento] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const list = await loadInventario();
      setItems(list);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => filterInventario(items, query), [items, query]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mov: MovimientoInventario = {
      tipo,
      productId: Number(productId),
      cantidad: tipo !== 'ajuste' ? cantidad : undefined,
      nuevoStock: tipo === 'ajuste' ? nuevoStock : undefined,
      razon: tipo === 'ajuste' ? razon : undefined,
      documento: documento || undefined,
    };
    const p = items.find((it) => it.id === mov.productId);
    const v = validateInventarioMovimiento(mov, p as any);
    setErrors(v.errors);
    if (!v.ok) return;
    try {
      if (tipo === 'entrada') await registrarEntrada(mov);
      else if (tipo === 'salida') await registrarSalida(mov);
      else await ajustarStock(mov);
      setToast('Movimiento aplicado');
      setTimeout(() => setToast(null), 1500);
      setCantidad(1); setNuevoStock(0); setRazon(''); setDocumento('');
      await reload();
    } catch (err: any) {
      if (err?.message === 'VALIDATION_ERROR') setErrors(err.fields || {});
      else alert('No se pudo aplicar el movimiento');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>📦 Inventario</h1>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
        <input
          placeholder="Buscar por nombre, SKU o categoría"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8 }}
        />
      </div>

      <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <div>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
          <div>
            <label>Producto</label>
            <select value={productId} onChange={(e) => setProductId(Number(e.target.value) || ('' as any))}>
              <option value="">Seleccionar…</option>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
            {errors.productId && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.productId}</div>}
          </div>
          {tipo !== 'ajuste' ? (
            <div>
              <label>Cantidad</label>
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))} />
              {errors.cantidad && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.cantidad}</div>}
            </div>
          ) : (
            <>
              <div>
                <label>Nuevo stock</label>
                <input type="number" min={0} value={nuevoStock} onChange={(e) => setNuevoStock(Math.max(0, parseInt(e.target.value) || 0))} />
                {errors.nuevoStock && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.nuevoStock}</div>}
              </div>
              <div>
                <label>Razón</label>
                <input value={razon} onChange={(e) => setRazon(e.target.value)} />
                {errors.razon && <div style={{ color: '#d32f2f', fontSize: 12 }}>{errors.razon}</div>}
              </div>
            </>
          )}
          <div>
            <label>Documento (opcional)</label>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button type="submit">Aplicar</button>
        </div>
      </form>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Producto</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Categoría</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 8, fontFamily: 'monospace' }}>{p.sku}</td>
                <td style={{ padding: 8 }}>{p.name}</td>
                <td style={{ padding: 8 }}>{p.category}</td>
                <td style={{ padding: 8, textAlign: 'right', fontWeight: p.stock < 10 ? 'bold' : 'normal', color: p.stock < 10 ? '#d32f2f' : '#333' }}>{p.stock}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#666' }}>Sin productos</td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} style={{ padding: 12, textAlign: 'center' }}>Cargando…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#333', color: '#fff', padding: '8px 12px', borderRadius: 8 }}>{toast}</div>
      )}
    </div>
  );
};
