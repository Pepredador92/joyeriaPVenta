// Servicio de dominio para Caja/Arqueo
// Reglas:
// - ventasTotales = sum(ventas.total)
// - efectivoVentas = sum(ventas.total donde metodo==='efectivo')
// - tarjetaVentas = sum(ventas.total donde metodo==='tarjeta')
// - transferenciaVentas = sum(ventas.total donde metodo==='transferencia')
// - ingresosNoVenta = sum(movs.monto donde tipo==='ingreso')
// - retiros = sum(movs.monto donde tipo==='retiro')
// - devolucionesEfectivo = sum(movs.monto donde tipo==='devolucion')
// - efectivoEsperado = saldoInicial + efectivoVentas + ingresosNoVenta - retiros - devolucionesEfectivo
// - diferencia = efectivoContado - efectivoEsperado (la UI calcula si captura "efectivoContado")

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

export type AperturaCaja = {
  id: string;
  fecha: string;
  saldoInicial: number;
};

export type Venta = {
  id: string;
  total: number;
  metodo: MetodoPago;
  fecha: string;
};

export type MovimientoCaja = {
  id: string;
  tipo: 'ingreso' | 'retiro' | 'devolucion';
  monto: number;
  motivo?: string;
  fecha: string;
};

export type EstadoCaja = {
  ventasTotales: number;
  efectivoVentas: number;
  tarjetaVentas: number;
  transferenciaVentas: number;
  saldoInicial: number;
  ingresosNoVenta: number;
  retiros: number;
  devolucionesEfectivo: number;
  efectivoEsperado: number;
  diferencia: number; // por defecto 0; la UI puede recalcular usando efectivo contado
};

const api = () => (window as any).electronAPI || {};

export function validateApertura(saldoInicial: number): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(saldoInicial) || saldoInicial < 0) errors.push('El saldo inicial debe ser mayor o igual a 0');
  return errors;
}

export async function loadAperturaActual(): Promise<AperturaCaja | null> {
  try { return (await api().getAperturaCajaActual?.()) || null; } catch { return null; }
}

export async function openRegister(saldoInicial: number): Promise<AperturaCaja> {
  const errs = validateApertura(saldoInicial);
  if (errs.length) {
    const e = new Error('VALIDATION_ERROR');
    (e as any).messages = errs; throw e;
  }
  const a = await api().abrirCaja?.(saldoInicial);
  if (!a) throw new Error('No se pudo abrir la caja');
  return a as AperturaCaja;
}

export function computeEstadoCaja(apertura: AperturaCaja, ventas: Venta[], movs: MovimientoCaja[]): EstadoCaja {
  const ventasTotales = (ventas||[]).reduce((s,v)=> s + (v.total||0), 0);
  const efectivoVentas = (ventas||[]).filter(v=> v.metodo==='efectivo').reduce((s,v)=> s + (v.total||0), 0);
  const tarjetaVentas = (ventas||[]).filter(v=> v.metodo==='tarjeta').reduce((s,v)=> s + (v.total||0), 0);
  const transferenciaVentas = (ventas||[]).filter(v=> v.metodo==='transferencia').reduce((s,v)=> s + (v.total||0), 0);
  const ingresosNoVenta = (movs||[]).filter(m=> m.tipo==='ingreso').reduce((s,m)=> s + (m.monto||0), 0);
  const retiros = (movs||[]).filter(m=> m.tipo==='retiro').reduce((s,m)=> s + (m.monto||0), 0);
  const devolucionesEfectivo = (movs||[]).filter(m=> m.tipo==='devolucion').reduce((s,m)=> s + (m.monto||0), 0);
  const saldoInicial = apertura?.saldoInicial || 0;
  const efectivoEsperado = saldoInicial + efectivoVentas + ingresosNoVenta - retiros - devolucionesEfectivo;
  return {
    ventasTotales,
    efectivoVentas,
    tarjetaVentas,
    transferenciaVentas,
    saldoInicial,
    ingresosNoVenta,
    retiros,
    devolucionesEfectivo,
    efectivoEsperado,
    diferencia: 0
  };
}

export async function loadCashState(aperturaId: string, efectivoContado?: number): Promise<EstadoCaja> {
  const apertura = await loadAperturaActual();
  const ventas = await api().getVentasDesde?.(aperturaId);
  const movs = await api().getMovimientosCaja?.(aperturaId);
  const base = computeEstadoCaja(apertura || { id: aperturaId, fecha: new Date().toISOString(), saldoInicial: 0 }, ventas||[], movs||[]);
  if (Number.isFinite(efectivoContado as number)) {
    return { ...base, diferencia: (efectivoContado as number) - base.efectivoEsperado };
  }
  return base;
}

// Aplica un efectivo contado a un estado existente para recalcular diferencia sin reconsultar IPC
export function withEfectivoContado(estado: EstadoCaja, efectivoContado: number): EstadoCaja {
  const contado = Number.isFinite(efectivoContado) ? (efectivoContado || 0) : 0;
  return { ...estado, diferencia: contado - estado.efectivoEsperado };
}

export async function registrarIngreso(monto: number, motivo?: string): Promise<void> {
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');
  const apertura = await loadAperturaActual();
  if (!apertura) throw new Error('No hay caja abierta');
  const mov: MovimientoCaja = { id: crypto.randomUUID?.() || String(Date.now()), tipo: 'ingreso', monto, motivo, fecha: new Date().toISOString() };
  await api().registrarMovimiento?.(mov);
}

export async function registrarRetiro(monto: number, motivo?: string): Promise<void> {
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');
  const apertura = await loadAperturaActual();
  if (!apertura) throw new Error('No hay caja abierta');
  // Restricción: no permitir retiros mayores al efectivo esperado
  const estado = await loadCashState(apertura.id);
  if (monto > estado.efectivoEsperado) throw new Error('Retiro excede el efectivo disponible');
  const mov: MovimientoCaja = { id: crypto.randomUUID?.() || String(Date.now()), tipo: 'retiro', monto, motivo, fecha: new Date().toISOString() };
  await api().registrarMovimiento?.(mov);
}

export async function registrarDevolucion(monto: number, motivo?: string): Promise<void> {
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido');
  const apertura = await loadAperturaActual();
  if (!apertura) throw new Error('No hay caja abierta');
  const mov: MovimientoCaja = { id: crypto.randomUUID?.() || String(Date.now()), tipo: 'devolucion', monto, motivo, fecha: new Date().toISOString() };
  await api().registrarMovimiento?.(mov);
}

export async function closeRegister(aperturaId: string, observaciones?: string, efectivoContado?: number): Promise<EstadoCaja> {
  const apertura = await loadAperturaActual();
  if (!apertura || apertura.id !== aperturaId) {
    // Continuar con datos disponibles
  }
  const ventas = await api().getVentasDesde?.(aperturaId);
  const movs = await api().getMovimientosCaja?.(aperturaId);
  let estado = computeEstadoCaja(apertura || { id: aperturaId, fecha: new Date().toISOString(), saldoInicial: 0 }, ventas||[], movs||[]);
  if (Number.isFinite(efectivoContado as number)) {
    estado = { ...estado, diferencia: (efectivoContado as number) - estado.efectivoEsperado };
  }
  await api().cerrarCaja?.({ aperturaId, estado, observaciones });
  return estado;
}
