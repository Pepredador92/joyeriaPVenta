import { CategoryOption, Product } from '../../shared/types';

// Tipos
export type Producto = Product;
export type ProductoCreateInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>;
export type ProductoUpdateInput = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;

// Catálogo base de categorías
export const defaultCategories = ['Anillos', 'Collares', 'Aretes', 'Pulseras', 'Relojes', 'Otros'] as const;

const normalizeCategoryId = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();

const formatCategoryName = (name: string) => {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
};

const fallbackCategory: CategoryOption = { id: 'otros', name: 'Otros' };

const buildCategoryOption = (raw: string): CategoryOption => {
  const formatted = formatCategoryName(raw);
  const id = normalizeCategoryId(formatted || raw);
  if (!id) return fallbackCategory;
  return { id, name: formatted || fallbackCategory.name };
};

export function toCategoryOption(name: string): CategoryOption {
  return buildCategoryOption(name);
}

export function getCategoryOptions(products: Product[]): CategoryOption[] {
  const map = new Map<string, CategoryOption>();
  defaultCategories.forEach((cat) => {
    const option = buildCategoryOption(cat);
    map.set(option.id, option);
  });
  products.forEach((product) => {
    const raw = (product?.category && product.category.trim()) || product?.categoryId || '';
    if (!raw) return;
    const option = buildCategoryOption(raw);
    if (!map.has(option.id)) {
      map.set(option.id, option);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function filterCategorySuggestions(options: CategoryOption[], term: string, limit = 8): CategoryOption[] {
  const q = term.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  return options
    .map((opt) => {
      const nameLower = opt.name.toLowerCase();
      const index = nameLower.indexOf(q);
      return { opt, index: index === -1 ? Number.MAX_SAFE_INTEGER : index };
    })
    .filter(({ index }) => index !== Number.MAX_SAFE_INTEGER)
    .sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.opt.name.localeCompare(b.opt.name, 'es');
    })
    .map(({ opt }) => opt)
    .slice(0, limit);
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

  const categoryName = formatCategoryName(input.category || input.categoryId || '');
  if (!categoryName) errors.category = 'La categoría es obligatoria';

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
  const categoryName = formatCategoryName(input.category || input.categoryId || '');
  const categoryId = normalizeCategoryId(categoryName || input.categoryId || '');
  const payload: ProductoCreateInput = {
    sku: (input.sku || '').trim(),
    name: (input.name || '').trim(),
    price: 0,
    stock: Math.max(0, Math.floor(Number(input.stock) || 0)),
    category: categoryName,
    categoryId: categoryId || undefined,
    description: input.description?.trim() || undefined,
  } as ProductoCreateInput;
  return await (window as any).electronAPI.createProduct(payload);
}

// Actualizar
export async function updateProducto(id: number, input: ProductoUpdateInput): Promise<Product | null> {
  // Para update permitimos omitir sku/name; solo validamos lo que llega con reglas básicas.
  const base = validateProducto({
    name: input.name ?? 'x',
    sku: input.sku ?? 'x',
    category: input.category ?? input.categoryId ?? 'x',
    stock: input.stock ?? 0,
  });
  // Quitar errores de campos no provistos (dummy)
  if (input.name === undefined) delete base.errors.name;
  if (input.sku === undefined) delete base.errors.sku;
  if (input.category === undefined && input.categoryId === undefined) delete base.errors.category;
  if (input.stock === undefined) delete base.errors.stock;
  if (Object.keys(base.errors).length) {
    const err = new Error('VALIDATION_ERROR');
    (err as any).fields = base.errors;
    throw err;
  }
  const patch: ProductoUpdateInput = {};
  if (input.sku !== undefined) patch.sku = input.sku.trim();
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || undefined;
  if (input.stock !== undefined) patch.stock = Math.max(0, Math.floor(Number(input.stock)));
  if (input.category !== undefined || input.categoryId !== undefined) {
    const categoryName = formatCategoryName(input.category || input.categoryId || '');
    const categoryId = normalizeCategoryId(categoryName || input.categoryId || '');
    patch.category = categoryName;
    patch.categoryId = categoryId || undefined;
  }
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
