import { Product } from '../../shared/types';

// Tipos
export type Producto = Product;
export type ProductoCreateInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductoUpdateInput = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;

// Catálogo base de categorías
export const defaultCategories = ['Anillos', 'Collares', 'Aretes', 'Pulseras', 'Relojes', 'Otros'] as const;

// Filtrar por nombre, SKU o categoría
export function filterProductos(products: Product[], term: string): Product[] {
  const q = (term || '').trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.sku || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q)
  );
}

// Validación
export function validateProducto(input: Partial<Product>): { ok: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = (input.name || '').trim();
  if (!name) errors.name = 'El nombre es obligatorio';

  const sku = (input.sku || '').trim();
  if (input.sku !== undefined && !sku) errors.sku = 'El SKU es obligatorio';

  const category = (input.category || '').trim();
  if (!category) errors.category = 'La categoría es obligatoria';

  const price = Number(input.price);
  if (!isFinite(price) || price < 0) errors.price = 'Precio inválido';

  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0) errors.stock = 'Stock inválido';

  return { ok: Object.keys(errors).length === 0, errors };
}

// Reglas de stock (para UI)
export type StockLevel = 'low' | 'medium' | 'ok';
export function getStockLevel(stock: number): StockLevel {
  if (stock < 10) return 'low';
  if (stock < 20) return 'medium';
  return 'ok';
}

// Sugerir SKU único tipo JOY-YYYYMMDD-XXXX
export function generateSKU(): string {
  const date = new Date();
  const yyyymmdd =
    date.getFullYear().toString() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `JOY-${yyyymmdd}-${random}`;
}

export function getUniqueSKU(existing: Product[]): string {
  let sku = '';
  let exists = true;
  while (exists) {
    sku = generateSKU();
    exists = existing.some((p) => (p.sku || '').trim() === sku);
  }
  return sku;
}
