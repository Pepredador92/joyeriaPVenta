import React, { useEffect, useState } from 'react';
import {
  filterProductos as filterProductosSvc,
  validateProducto as validateProductoSvc,
  getUniqueSKU,
} from '../../../domain/productos/productosService';

export const ProductosPage: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    sku: '', name: '', price: 0, stock: 0, category: '', description: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      if (!(window as any).electronAPI?.getProducts) {
        setProducts([]);
        return;
      }
      const data = await (window as any).electronAPI.getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        if (!(window as any).electronAPI?.updateProduct) {
          alert('IPC no disponible');
          return;
        }
      } else if (!(window as any).electronAPI?.createProduct) {
        alert('IPC no disponible');
        return;
      }
      // Validar antes de enviar
      const v = validateProductoSvc(newProduct);
      if (!v.ok) {
        const first = Object.values(v.errors)[0] || 'Datos inválidos';
        alert(first);
        return;
      }
      const normalizedPayload = {
        sku: (newProduct.sku || '').trim(),
        name: (newProduct.name || '').trim(),
        price: Number(newProduct.price) || 0,
        stock: Number(newProduct.stock) || 0,
        category: (newProduct.category || '').trim(),
        description: newProduct.description?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      if (editingProduct) {
        await (window as any).electronAPI.updateProduct(editingProduct.id, normalizedPayload);
      } else {
        const payload = {
          ...normalizedPayload,
          createdAt: new Date().toISOString(),
        };
        await (window as any).electronAPI.createProduct(payload);
      }
      resetForm();
      loadProducts();
    } catch (error) {
      const err: any = error as any;
      console.error('Error saving product:', err);
      if (err?.message === 'VALIDATION_ERROR' && err.fields) {
        const first = Object.values(err.fields)[0] as string;
        alert(first || 'Error de validación');
      } else {
        alert('Error al guardar el producto');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      try {
        if (!(window as any).electronAPI?.deleteProduct) {
          alert('IPC no disponible');
          return;
        }
        await (window as any).electronAPI.deleteProduct(id);
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar el producto');
      }
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description || ''
    });
    setShowAddForm(true);
  };

  // Cuando se abre el formulario de nuevo producto, autogenerar SKU
  const handleShowAddForm = () => {
    setEditingProduct(null);
    const uniqueSku = getUniqueSKU(products);
    setNewProduct({ sku: uniqueSku, name: '', price: 0, stock: 0, category: '', description: '' });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setNewProduct({ sku: '', name: '', price: 0, stock: 0, category: '', description: '' });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const filteredProducts = filterProductosSvc(products, searchTerm);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📦 Gestión de Productos</h1>
        <button
          onClick={handleShowAddForm}
          style={{
            background: '#2196f3',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          + Nuevo Producto
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
      </div>

      {/* Formulario */}
      {showAddForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '500px' }}>
            <h2>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>SKU:</label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    readOnly={!editingProduct}
                    onChange={editingProduct ? (e) => setNewProduct({...newProduct, sku: e.target.value}) : undefined}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', background: editingProduct ? 'white' : '#f5f5f5', color: editingProduct ? 'black' : '#888' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Categoría:</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Anillos">Anillos</option>
                    <option value="Collares">Collares</option>
                    <option value="Aretes">Aretes</option>
                    <option value="Pulseras">Pulseras</option>
                    <option value="Relojes">Relojes</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nombre:</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Precio:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value) || 0})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Stock:</label>
                  <input
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({...newProduct, stock: parseInt(e.target.value) || 0})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Descripción:</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#4caf50',
                    color: 'white',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {editingProduct ? 'Actualizar' : 'Crear'} Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>SKU</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Producto</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Categoría</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Precio</th>
              <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Stock</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px', fontFamily: 'monospace' }}>{product.sku}</td>
                <td style={{ padding: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                    {product.description && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{product.description}</div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    background: '#e3f2fd',
                    color: '#1565c0'
                  }}>
                    {product.category}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>${product.price.toFixed(2)}</td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <span style={{
                    color: product.stock < 10 ? '#d32f2f' : product.stock < 20 ? '#f57c00' : '#388e3c',
                    fontWeight: product.stock < 10 ? 'bold' : 'normal'
                  }}>
                    {product.stock}
                    {product.stock < 10 && ' ⚠️'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleEdit(product)}
                    style={{ marginRight: '8px', padding: '4px 8px', border: '1px solid #2196f3', background: 'white', color: '#2196f3', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    style={{ padding: '4px 8px', border: '1px solid #d32f2f', background: 'white', color: '#d32f2f', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
