import { computeEstadoCaja, AperturaCaja, Venta, MovimientoCaja } from '../src/domain/caja/cajaService';

function assertEq(name: string, a: any, b: any) {
  if (a !== b) {
    console.error(`[FAIL] ${name}: expected ${b}, got ${a}`);
    process.exit(1);
  } else {
    console.log(`[OK] ${name}: ${a}`);
  }
}

const apertura: AperturaCaja = { id: 'A1', fecha: '2025-09-18T00:00:00Z', saldoInicial: 1000 };
const ventas: Venta[] = [
  { id: 'V1', total: 1160, metodo: 'efectivo', fecha: '2025-09-18T10:00:00Z' },
];
const movs: MovimientoCaja[] = [];

const estado = computeEstadoCaja(apertura, ventas, movs);

assertEq('ventasTotales', estado.ventasTotales, 1160);
assertEq('efectivoVentas', estado.efectivoVentas, 1160);
assertEq('saldoInicial', estado.saldoInicial, 1000);
assertEq('ingresosNoVenta', estado.ingresosNoVenta, 0);
assertEq('retiros', estado.retiros, 0);
assertEq('devolucionesEfectivo', estado.devolucionesEfectivo, 0);
assertEq('efectivoEsperado', estado.efectivoEsperado, 2160);
console.log('All caja tests passed.');
