import { CreateSaleDTO, ISalesRepository, SaleItemDTO, SaleDTO } from '../data/SalesRepository';

export type NuevaVentaInput = {
  fecha?: string; // ISO, defaults now
  categoria: string; // requerido ahora
  cantidad: number;
  precioUnitario?: number; // requerido (>0); mantenido opcional en el tipo para compatibilidad
  metodoPago: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  customerId?: number;
  productId?: number; // optional simplified flow
  notas?: string;
};

export type NuevaVentaResultado = {
  ok: true;
  venta: SaleDTO;
} | {
  ok: false;
  error: string;
  fields?: Partial<Record<keyof NuevaVentaInput, string>>;
};

export class VentasService {
  constructor(private repo: ISalesRepository) {}

  // Calcula totales con IVA 16% y sin descuentos por defecto
  calcularTotales(cantidad: number, precioUnitario: number, descuentoPct = 0) {
    const qty = Math.max(0, Math.floor(cantidad));
    const unit = Math.max(0, Number(precioUnitario));
    const subtotal = qty * unit;
    const discount = subtotal * Math.max(0, Math.min(1, descuentoPct));
    const taxable = Math.max(0, subtotal - discount);
    const tax = +(taxable * 0.16).toFixed(2);
    const total = +(taxable + tax).toFixed(2);
    return { subtotal, discount, tax, total };
  }

  validar(input: NuevaVentaInput): NuevaVentaResultado | null {
    const errors: Partial<Record<keyof NuevaVentaInput, string>> = {};
    const qty = Math.floor(Number(input.cantidad));
    if (!Number.isFinite(input.cantidad) || qty < 1) errors.cantidad = 'Cantidad debe ser un entero positivo';
    const unit = Number(input.precioUnitario);
    if (!input.categoria) errors.categoria = 'La categoría es requerida';
    if (!input.metodoPago) errors.metodoPago = 'El método de pago es requerido';
    if (!Number.isFinite(unit) || unit <= 0) errors.precioUnitario = 'Captura un precio unitario válido (> 0)';
    if (Object.keys(errors).length) return { ok: false, error: 'Validación fallida', fields: errors };
    return null;
  }

  async crearVenta(input: NuevaVentaInput): Promise<NuevaVentaResultado> {
    const invalid = this.validar(input);
    if (invalid) return invalid;

    const quantity = Math.max(0, Math.floor(Number(input.cantidad)));
    const unit = Math.max(0.01, Number(input.precioUnitario));
    const { subtotal, discount, tax, total } = this.calcularTotales(quantity, unit);
    const categoryName = input.categoria?.trim() || 'Otros';
    const categoryId = categoryName.trim().toLowerCase();

    const item: SaleItemDTO = {
      productId: input.productId,
      categoryId,
      categoryName,
      quantity,
      unitPrice: unit,
      subtotal: +(quantity * unit).toFixed(2),
      notes: input.notas,
      type: input.productId ? 'product' : 'manual',
    };

    const dto: CreateSaleDTO = {
      customerId: input.customerId,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: input.metodoPago,
      items: [item],
      notes: input.notas ? `${input.notas} | Categoría: ${categoryName}` : `Categoría: ${categoryName}`,
      appliedDiscountLevel: undefined,
      appliedDiscountPercent: undefined,
    };

    try {
      const venta = await this.repo.createSale(dto);
      return { ok: true, venta };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'No se pudo crear la venta' };
    }
  }
}
