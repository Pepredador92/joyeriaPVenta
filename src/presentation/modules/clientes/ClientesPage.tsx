import React, { useEffect, useMemo, useState } from 'react';
import {
  loadCustomers,
  filterCustomers,
  createCustomer as createCustomerSvc,
  updateCustomer as updateCustomerSvc,
  deleteCustomer as deleteCustomerSvc,
  validateCustomer,
} from '../../../domain/clientes/clientesService';

type ToastTone = 'info' | 'success' | 'error';

type ClientesPageProps = {
  onNotify?: (message: string, tone?: ToastTone) => void;
  onConfirm?: (message: string, detail?: string) => Promise<boolean>;
};

export const ClientesPage: React.FC<ClientesPageProps> = ({ onNotify, onConfirm }) => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({ name: '', email: '', phone: '', discountLevel: 'Bronze', customerType: 'Particular' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reload = async () => {
    setLoading(true);
    try {
      const list = await loadCustomers();
      setCustomers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => filterCustomers(customers, query), [customers, query]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateCustomer(form);
    setErrors(v.errors);
    if (!v.ok) return;
    try {
      if (editingId) {
        await updateCustomerSvc(editingId, form);
        onNotify?.('Cliente actualizado', 'success');
      } else {
        await createCustomerSvc(form);
        onNotify?.('Cliente creado', 'success');
      }
      setForm({ name: '', email: '', phone: '', discountLevel: 'Bronze', customerType: 'Particular' });
      setEditingId(null);
      await reload();
    } catch (err: any) {
      if (err?.message === 'VALIDATION_ERROR') setErrors(err.fields || {});
      else onNotify?.('No se pudo guardar', 'error');
    }
  };

  const onEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      discountLevel: c.discountLevel || 'Bronze',
      customerType: c.customerType || 'Particular',
      address: c.address || '',
    });
  };

  const onDelete = async (id: number) => {
    const shouldDelete = onConfirm ? await onConfirm('¿Eliminar cliente?') : true;
    if (!shouldDelete) return;
    await deleteCustomerSvc(id);
    onNotify?.('Cliente eliminado', 'success');
    await reload();
  };

  return (
    <div style={{ padding: 16 }}>
      <h1>👥 Clientes</h1>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input placeholder="Buscar por nombre, email o teléfono" value={query} onChange={e=> setQuery(e.target.value)} style={{ flex:1, padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }} />
      </div>

      <form onSubmit={onSubmit} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:12, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8 }}>
          <div>
            <label>Nombre</label>
            <input value={form.name} onChange={e=> setForm({ ...form, name: e.target.value })} />
            {errors.name && <div style={{ color:'#d32f2f', fontSize:12 }}>{errors.name}</div>}
          </div>
          <div>
            <label>Email</label>
            <input value={form.email||''} onChange={e=> setForm({ ...form, email: e.target.value })} />
            {errors.email && <div style={{ color:'#d32f2f', fontSize:12 }}>{errors.email}</div>}
          </div>
          <div>
            <label>Teléfono</label>
            <input value={form.phone||''} onChange={e=> setForm({ ...form, phone: e.target.value })} />
            {errors.phone && <div style={{ color:'#d32f2f', fontSize:12 }}>{errors.phone}</div>}
          </div>
          <div>
            <label>Nivel</label>
            <select value={form.discountLevel} onChange={e=> setForm({ ...form, discountLevel: e.target.value })}>
              <option>Bronze</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
            </select>
            {errors.discountLevel && <div style={{ color:'#d32f2f', fontSize:12 }}>{errors.discountLevel}</div>}
          </div>
          <div>
            <label>Tipo</label>
            <select value={form.customerType} onChange={e=> setForm({ ...form, customerType: e.target.value })}>
              <option>Particular</option>
              <option>Empresa</option>
              <option>Mayorista</option>
            </select>
          </div>
          <div>
            <label>Dirección</label>
            <input value={form.address||''} onChange={e=> setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <div style={{ marginTop:10, display:'flex', gap:8 }}>
          <button type="submit">{editingId ? 'Guardar cambios' : 'Agregar cliente'}</button>
          {editingId && <button type="button" onClick={()=> { setEditingId(null); setForm({ name: '', email: '', phone: '', discountLevel: 'Bronze', customerType: 'Particular' }); setErrors({}); }}>Cancelar</button>}
        </div>
      </form>

      <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:8 }}>Nombre</th>
              <th style={{ textAlign:'left', padding:8 }}>Email</th>
              <th style={{ textAlign:'left', padding:8 }}>Teléfono</th>
              <th style={{ textAlign:'left', padding:8 }}>Nivel</th>
              <th style={{ textAlign:'left', padding:8 }}>Tipo</th>
              <th style={{ textAlign:'center', padding:8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c:any)=> (
              <tr key={c.id} style={{ borderTop:'1px solid #eee' }}>
                <td style={{ padding:8 }}>{c.name}</td>
                <td style={{ padding:8 }}>{c.email}</td>
                <td style={{ padding:8 }}>{c.phone}</td>
                <td style={{ padding:8 }}>{c.discountLevel}</td>
                <td style={{ padding:8 }}>{c.customerType||'Particular'}</td>
                <td style={{ padding:8, textAlign:'center' }}>
                  <button onClick={()=> onEdit(c)} style={{ marginRight:8 }}>Editar</button>
                  <button onClick={()=> onDelete(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length===0 && !loading && (
              <tr><td colSpan={6} style={{ padding:12, textAlign:'center', color:'#666' }}>Sin clientes</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} style={{ padding:12, textAlign:'center' }}>Cargando…</td></tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
