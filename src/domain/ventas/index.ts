export interface NuevaVentaInput {
  fecha?: string;
  categoria: string;
  cantidad: number;
  precioUnitario?: number;
  metodoPago: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  customerId?: number;
  productId?: number;
  notas?: string;
}

export type NuevaVentaResultado =
  | { ok: true; venta: any }
  | { ok: false; error: string; fields?: Partial<Record<keyof NuevaVentaInput, string>> };

export interface IVentasService {
  validar(input: NuevaVentaInput): NuevaVentaResultado | null;
  crearVenta(input: NuevaVentaInput): Promise<NuevaVentaResultado>;
}
