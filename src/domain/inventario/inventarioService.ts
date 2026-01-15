import { Product } from '../../shared/types';

// Tipos
export type InventarioItem = Product;

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

export type MovimientoInventario = {
  tipo: TipoMovimiento;
  productId: number;
  cantidad?: number; // para entrada/salida
  nuevoStock?: number; // para ajuste
  razon?: string;
  documento?: string;
};

export type InventarioUpdateInput = {
  productId: number;
  delta?: number; // +n o -n para entrada/salida
  nuevoStock?: number; // para ajuste directo
  razon?: string;
  documento?: string;
};

// Filtro por nombre, SKU o categoría
export function filterInventario(items: InventarioItem[], term: string): InventarioItem[] {
  const q = (term || '').trim().toLowerCase();
  if (!q) return items;
  return items.filter((p) =>
    (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)
  );
}

// Validación de movimiento
export function validateInventarioMovimiento(mov: MovimientoInventario, product: Product | undefined): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!product) errors.productId = 'Producto no encontrado';

  if (mov.tipo === 'entrada' || mov.tipo === 'salida') {
    const cant = Number(mov.cantidad);
    if (!Number.isFinite(cant) || cant <= 0 || Math.floor(cant) !== cant) errors.cantidad = 'Cantidad inválida';
    if (mov.tipo === 'salida' && product) {
      if ((product.stock ?? 0) < cant) errors.cantidad = 'Stock insuficiente';
    }
  } else if (mov.tipo === 'ajuste') {
    const nuevo = Number(mov.nuevoStock);
    if (!Number.isFinite(nuevo) || nuevo < 0 || Math.floor(nuevo) !== nuevo) errors.nuevoStock = 'Nuevo stock inválido';
    const razón = (mov.razon || '').trim();
    if (!razón) errors.razon = 'Indica una razón de ajuste';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export type InventarioUpdateResult = {
  productId: number;
  stock: number;
  logMessage: string;
};

// Registrar entrada: aumenta stock
export function registrarEntrada(mov: MovimientoInventario, product: Product | undefined): InventarioUpdateResult {
  const { ok, errors } = validateInventarioMovimiento(mov, product);
  if (!ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = errors;
    throw err;
  }
  const cant = Number(mov.cantidad || 0);
  const nuevo = (product!.stock ?? 0) + cant;
  return {
    productId: product!.id,
    stock: nuevo,
    logMessage: `inventario_entrada: product=${product!.id}, +${cant}, stock=${nuevo}${mov.documento ? ', doc=' + mov.documento : ''}`,
  };
}

// Registrar salida: disminuye stock (validar suficiente)
export function registrarSalida(mov: MovimientoInventario, product: Product | undefined): InventarioUpdateResult {
  const { ok, errors } = validateInventarioMovimiento(mov, product);
  if (!ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = errors;
    throw err;
  }
  const cant = Number(mov.cantidad || 0);
  const nuevo = Math.max(0, (product!.stock ?? 0) - cant);
  return {
    productId: product!.id,
    stock: nuevo,
    logMessage: `inventario_salida: product=${product!.id}, -${cant}, stock=${nuevo}${mov.documento ? ', doc=' + mov.documento : ''}`,
  };
}

// Ajuste: fija stock manualmente con razon/documento
export function ajustarStock(mov: MovimientoInventario, product: Product | undefined): InventarioUpdateResult {
  const { ok, errors } = validateInventarioMovimiento(mov, product);
  if (!ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = errors;
    throw err;
  }
  const nuevo = Number(mov.nuevoStock);
  return {
    productId: product!.id,
    stock: nuevo,
    logMessage: `inventario_ajuste: product=${product!.id}, nuevo=${nuevo}${mov.razon ? ', razon=' + mov.razon : ''}${mov.documento ? ', doc=' + mov.documento : ''}`,
  };
}
