import { CreateSaleDTO, ISalesRepository, SaleItemDTO, SaleDTO } from '../data/SalesRepository';

export type NuevaVentaInput = {
  fecha?: string; // ISO, defaults now
  categoria: string; // requerido ahora
  cantidad: number;
  precioUnitario?: number; // opcional, si no se provee se infiere por categoría
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
    if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) errors.cantidad = 'Cantidad debe ser mayor a 0';
    if (!input.categoria) errors.categoria = 'La categoría es requerida';
    if (!input.metodoPago) errors.metodoPago = 'El método de pago es requerido';
    if (Object.keys(errors).length) return { ok: false, error: 'Validación fallida', fields: errors };
    return null;
  }

  private getCategoryUnitPrice(categoria: string): number {
    const defaultMap: Record<string, number> = {
      'Anillos': 1200,
      'Collares': 1800,
      'Aretes': 800,
      'Pulseras': 900,
      'Relojes': 2500,
      'Otros': 600
    };
    return defaultMap[categoria] ?? defaultMap['Otros'];
  }

  async crearVenta(input: NuevaVentaInput): Promise<NuevaVentaResultado> {
    const invalid = this.validar(input);
    if (invalid) return invalid;

    const unit = input.precioUnitario && input.precioUnitario > 0 ? input.precioUnitario : this.getCategoryUnitPrice(input.categoria);
    const { subtotal, discount, tax, total } = this.calcularTotales(input.cantidad, unit);
    const categoryName = input.categoria?.trim() || 'Otros';
    const categoryId = categoryName.trim().toLowerCase();

    const item: SaleItemDTO = {
      productId: input.productId,
      categoryId,
      categoryName,
      quantity: Math.floor(input.cantidad),
      unitPrice: unit,
      subtotal: +(input.cantidad * unit).toFixed(2),
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
