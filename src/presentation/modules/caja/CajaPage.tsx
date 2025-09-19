import React, { useEffect, useMemo, useState } from 'react';
import {
  AperturaCaja,
  EstadoCaja,
  loadAperturaActual,
  openRegister,
  loadCashState,
  registrarIngreso,
  registrarRetiro,
  registrarDevolucion,
  closeRegister,
  withEfectivoContado,
} from '../../../domain/caja/cajaService';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export const CajaPage: React.FC = () => {
  const [apertura, setApertura] = useState<AperturaCaja | null>(null);
  const [estado, setEstado] = useState<EstadoCaja | null>(null);
  const [loading, setLoading] = useState(true);
  const [saldoInicialInput, setSaldoInicialInput] = useState<string>('0');
  const [contado, setContado] = useState<number | ''>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [showSummary, setShowSummary] = useState<{ estado: EstadoCaja; observaciones?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const show = (m: string) => { setToast(m); setTimeout(()=> setToast(null), 1800); };

  const refresh = async () => {
    setLoading(true);
    try {
      const ap = await loadAperturaActual();
      setApertura(ap);
      if (ap) {
        const st = await loadCashState(ap.id, typeof contado==='number'? contado : undefined);
        setEstado(st);
        setSaldoInicialInput(String(st.saldoInicial ?? ap.saldoInicial ?? 0));
      } else {
        setEstado(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=> { refresh(); }, []);

  const diferencia = useMemo(()=> {
    if (!estado) return 0;
    if (contado === '') return 0;
    return Number(contado) - estado.efectivoEsperado;
  }, [estado, contado]);

  // recalcular diferencia en tiempo real sin pedir al backend
  const estadoConContado = useMemo(()=> {
    if (!estado) return null;
    if (contado === '') return estado;
    return withEfectivoContado(estado, Number(contado));
  }, [estado, contado]);

  const abrir = async () => {
    try {
      const saldo = Math.max(0, Number(saldoInicialInput) || 0);
      const ap = await openRegister(saldo);
      setApertura(ap);
      const st = await loadCashState(ap.id);
      setEstado(st);
      show('Caja abierta');
    } catch (e:any) {
      show(e?.messages?.join?.('\n') || e?.message || 'No se pudo abrir');
    }
  };

  const onIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const monto = Number(data.get('monto')||0);
    const motivo = String(data.get('motivo')||'');
    try {
  await registrarIngreso(monto, motivo);
  if (apertura) setEstado(await loadCashState(apertura.id, typeof contado==='number'? contado: undefined));
      form.reset();
      show('Ingreso registrado');
    } catch (err:any) { show(err?.message || 'Error'); }
  };

  const onRetiro = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const monto = Number(data.get('monto')||0);
    const motivo = String(data.get('motivo')||'');
    try {
  await registrarRetiro(monto, motivo);
  if (apertura) setEstado(await loadCashState(apertura.id, typeof contado==='number'? contado: undefined));
      form.reset();
      show('Retiro registrado');
    } catch (err:any) { show(err?.message || 'Error'); }
  };

  const onDevolucion = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const monto = Number(data.get('monto')||0);
    const motivo = String(data.get('motivo')||'');
    try {
  await registrarDevolucion(monto, motivo);
  if (apertura) setEstado(await loadCashState(apertura.id, typeof contado==='number'? contado: undefined));
      form.reset();
      show('Devolución registrada');
    } catch (err:any) { show(err?.message || 'Error'); }
  };

  const cerrar = async () => {
    if (!apertura) return;
    setSaving(true);
    try {
      const st = await closeRegister(apertura.id, (observaciones || undefined), typeof contado==='number'? contado: undefined);
      setShowSummary({ estado: st, observaciones });
      show('Caja cerrada');
      setApertura(null);
      setEstado(null);
      setContado('');
      setSaldoInicialInput('0');
      setObservaciones('');
    } catch (err:any) { show(err?.message || 'No se pudo cerrar'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>💵 Caja / Arqueo</h1>
      {loading ? (
        <div>Cargando…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>
          {/* Apertura */}
          {!apertura && (
            <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
              <h3 style={{ marginTop:0 }}>Apertura</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label>Saldo inicial:</label>
                <input type="number" value={saldoInicialInput} onChange={e=> setSaldoInicialInput(e.target.value)} />
                <button onClick={abrir}>Abrir caja</button>
              </div>
            </div>
          )}

          {/* Panel de estado */}
      {apertura && estadoConContado && (
            <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
              <h3 style={{ marginTop:0 }}>Estado</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:12 }}>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Ventas Totales</div><div className="stat-value">{fmt.format(estadoConContado.ventasTotales)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Efectivo</div><div className="stat-value">{fmt.format(estadoConContado.efectivoVentas)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Tarjeta</div><div className="stat-value">{fmt.format(estadoConContado.tarjetaVentas)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Transferencia</div><div className="stat-value">{fmt.format(estadoConContado.transferenciaVentas)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Saldo Inicial</div><div className="stat-value">{fmt.format(estadoConContado.saldoInicial)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Ingresos (no venta)</div><div className="stat-value">{fmt.format(estadoConContado.ingresosNoVenta)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Retiros</div><div className="stat-value">{fmt.format(estadoConContado.retiros)}</div></div>
        <div className="stat-card"><div style={{ color:'#6a6a6a' }}>Devoluciones</div><div className="stat-value">{fmt.format(estadoConContado.devolucionesEfectivo)}</div></div>
        <div className="stat-card" style={{ border:'1px solid #1976d2' }}><div style={{ color:'#1976d2' }}>Efectivo Esperado</div><div className="stat-value" style={{ color:'#1976d2' }}>{fmt.format(estadoConContado.efectivoEsperado)}</div></div>
              </div>
              {/* Efectivo contado opcional */}
              <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center' }}>
                <label>Efectivo contado (opcional):</label>
                <input type="number" value={contado} onChange={e=> setContado(e.target.value==='' ? '' : Number(e.target.value))} />
        <div>Diferencia: <strong style={{ color: Math.sign(diferencia)===0 ? '#2e7d32' : (diferencia>0?'#2e7d32':'#d32f2f') }}>{fmt.format(diferencia)}</strong></div>
              </div>
            </div>
          )}

          {/* Movimientos */}
          {apertura && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>
              <form onSubmit={onIngreso} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
                <h4 style={{ marginTop:0 }}>Ingreso</h4>
                <input name="monto" type="number" min={0} step={0.01} placeholder="Monto" required style={{ width:'100%', marginBottom:8 }} />
                <input name="motivo" type="text" placeholder="Motivo (opcional)" style={{ width:'100%', marginBottom:8 }} />
                <button type="submit">Registrar</button>
              </form>
              <form onSubmit={onRetiro} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
                <h4 style={{ marginTop:0 }}>Retiro</h4>
                <input name="monto" type="number" min={0} step={0.01} placeholder="Monto" required style={{ width:'100%', marginBottom:8 }} />
                <input name="motivo" type="text" placeholder="Motivo (opcional)" style={{ width:'100%', marginBottom:8 }} />
                <button type="submit">Registrar</button>
              </form>
              <form onSubmit={onDevolucion} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
                <h4 style={{ marginTop:0 }}>Devolución</h4>
                <input name="monto" type="number" min={0} step={0.01} placeholder="Monto" required style={{ width:'100%', marginBottom:8 }} />
                <input name="motivo" type="text" placeholder="Motivo (opcional)" style={{ width:'100%', marginBottom:8 }} />
                <button type="submit">Registrar</button>
              </form>
            </div>
          )}

          {/* Cierre */}
          {apertura && estadoConContado && (
            <div style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, padding:16 }}>
              <button onClick={cerrar} disabled={saving}>Cerrar caja</button>
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                <label htmlFor="obs">Observaciones (opcional)</label>
                <textarea
                  id="obs"
                  placeholder="Notas del cierre, incidencias, etc."
                  value={observaciones}
                  onChange={(e)=> setObservaciones(e.target.value)}
                  rows={3}
                  style={{ width:'100%', padding:8, borderRadius:6, border:'1px solid #c7c7c7', resize:'vertical' }}
                />
              </div>
            </div>
          )}
        </div>
      )}
      {toast && (
        <div style={{ position:'fixed', bottom:16, right:16, background:'#333', color:'#fff', padding:'8px 12px', borderRadius:8 }}>{toast}</div>
      )}
  {showSummary && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:18, width:420 }}>
            <h3 style={{ marginTop:0 }}>Resumen de Cierre</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, fontSize:14 }}>
      <div>Saldo Inicial</div><div>{fmt.format(showSummary.estado.saldoInicial)}</div>
      <div>Ventas Totales</div><div>{fmt.format(showSummary.estado.ventasTotales)}</div>
      <div>· Efectivo</div><div>{fmt.format(showSummary.estado.efectivoVentas)}</div>
      <div>· Tarjeta</div><div>{fmt.format(showSummary.estado.tarjetaVentas)}</div>
      <div>· Transferencia</div><div>{fmt.format(showSummary.estado.transferenciaVentas)}</div>
      <div>Ingresos</div><div>{fmt.format(showSummary.estado.ingresosNoVenta)}</div>
      <div>Retiros</div><div>{fmt.format(showSummary.estado.retiros)}</div>
      <div>Devoluciones</div><div>{fmt.format(showSummary.estado.devolucionesEfectivo)}</div>
      <div>Efectivo Esperado</div><div>{fmt.format(showSummary.estado.efectivoEsperado)}</div>
      <div>Efectivo Contado</div><div>{fmt.format(showSummary.estado.efectivoEsperado + showSummary.estado.diferencia)}</div>
      <div>Diferencia</div><div style={{ fontWeight:700, color: showSummary.estado.diferencia===0?'#2e7d32':(showSummary.estado.diferencia>0?'#2e7d32':'#d32f2f') }}>{fmt.format(showSummary.estado.diferencia)}</div>
      <div>Observaciones</div><div style={{ whiteSpace:'pre-wrap' }}>{(showSummary.observaciones && showSummary.observaciones.trim()) ? showSummary.observaciones : '—'}</div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button onClick={()=> setShowSummary(null)} style={{ padding:'8px 12px' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CajaPage;
