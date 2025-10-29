import { Category, Product } from '../../shared/types';

// Tipos
export type Producto = Product;
export type ProductoCreateInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductoUpdateInput = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;

const normalizeCategory = (value: string) => (value || '').toString().trim();
const normalizeName = (value: string) => (value || '').toString().trim();
const normalizeDescription = (value?: string | null) => {
  const clean = (value ?? '').toString().trim();
  return clean || undefined;
};

export async function loadCategoryCatalog(term?: string): Promise<Category[]> {
  if (!(window as any).electronAPI?.getCategoryCatalog) return [];
  return (await (window as any).electronAPI.getCategoryCatalog(term)) as Category[];
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
  const name = normalizeName(input.name || '');
  if (!name) errors.name = 'El nombre es obligatorio';

  const sku = (input.sku || '').trim();
  if (input.sku !== undefined && !sku) errors.sku = 'El SKU es obligatorio';

  const category = normalizeCategory(input.category || '');
  if (!category) errors.category = 'La categoría es obligatoria';

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
    name: normalizeName(input.name || ''),
    price: Number(input.price) || 0,
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    category: normalizeCategory(input.category || ''),
    description: normalizeDescription(input.description),
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
    stock: input.stock ?? 0,
  });
  // Quitar errores de campos no provistos (dummy)
  if (input.name === undefined) delete base.errors.name;
  if (input.sku === undefined) delete base.errors.sku;
  if (input.category === undefined) delete base.errors.category;
  if (input.stock === undefined) delete base.errors.stock;
  if (Object.keys(base.errors).length) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = base.errors;
    throw err;
  }
  const patch: ProductoUpdateInput = {
    ...input,
    name: input.name !== undefined ? normalizeName(input.name) : undefined,
    category: input.category !== undefined ? normalizeCategory(input.category) : undefined,
    description: input.description !== undefined ? normalizeDescription(input.description) : undefined,
    stock: input.stock !== undefined ? Math.max(0, Math.floor(Number(input.stock))) : undefined,
    price: input.price !== undefined ? Number(input.price) || 0 : undefined,
  };
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
