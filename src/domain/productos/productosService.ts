import { CategoryOption, Product } from '../../shared/types';

// Tipos
export type Producto = Product;
export type ProductoCreateInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductoUpdateInput = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;

// Catálogo base de categorías
export const defaultCategories = ['Anillos', 'Collares', 'Aretes', 'Pulseras', 'Relojes', 'Otros'] as const;

const normalizeCategoryId = (name: string) => name.trim().toLowerCase();

export function toCategoryOption(name: string): CategoryOption {
  const clean = name.trim();
  const fallback = 'Otros';
  const finalName = clean || fallback;
  return {
    id: normalizeCategoryId(finalName) || normalizeCategoryId(fallback),
    name: finalName,
  };
}

export function getCategoryOptions(products: Product[]): CategoryOption[] {
  const map = new Map<string, CategoryOption>();
  defaultCategories.forEach((cat) => {
    const option = toCategoryOption(cat);
    map.set(option.id, option);
  });
  products.forEach((product) => {
    if (!product?.category) return;
    const option = toCategoryOption(product.category);
    if (!map.has(option.id)) {
      map.set(option.id, option);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es')); // stable order for dropdowns
}

// Cargar productos
export async function loadProductos(): Promise<Product[]> {
  if (!(window as any).electronAPI?.getProducts) return [];
  return (await (window as any).electronAPI.getProducts()) as Product[];
}

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

// Crear
export async function createProducto(input: ProductoCreateInput): Promise<Product> {
  const v = validateProducto(input);
  if (!v.ok) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = v.errors;
    throw err;
  }
  const payload: ProductoCreateInput = {
    sku: (input.sku || '').trim(),
    name: (input.name || '').trim(),
    price: Number(input.price) || 0,
    stock: Number(input.stock) || 0,
    category: (input.category || '').trim(),
    description: input.description?.trim() || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;
  return await (window as any).electronAPI.createProduct(payload);
}

// Actualizar
export async function updateProducto(id: number, input: ProductoUpdateInput): Promise<Product | null> {
  // Para update permitimos omitir sku/name; solo validamos lo que llega con reglas básicas.
  const base = validateProducto({
    name: input.name ?? 'x',
    sku: input.sku ?? 'x',
    category: input.category ?? 'x',
    price: input.price ?? 0,
    stock: input.stock ?? 0,
  });
  // Quitar errores de campos no provistos (dummy)
  if (input.name === undefined) delete base.errors.name;
  if (input.sku === undefined) delete base.errors.sku;
  if (input.category === undefined) delete base.errors.category;
  if (input.price === undefined) delete base.errors.price;
  if (input.stock === undefined) delete base.errors.stock;
  if (Object.keys(base.errors).length) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = base.errors;
    throw err;
  }
  const patch: ProductoUpdateInput = { ...input };
  return await (window as any).electronAPI.updateProduct(id, patch);
}

// Eliminar
export async function deleteProducto(id: number): Promise<boolean> {
  return await (window as any).electronAPI.deleteProduct(id);
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
