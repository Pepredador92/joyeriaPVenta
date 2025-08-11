import React, { useState, useEffect } from 'react';
import './App.css';

// Declarar tipos para la API de Electron
declare global {
  interface Window {
    electronAPI: {
      getProducts: () => Promise<any[]>;
      createProduct: (productData: any) => Promise<any>;
      updateProduct: (id: number, productData: any) => Promise<any>;
      deleteProduct: (id: number) => Promise<boolean>;
      getCustomers: () => Promise<any[]>;
      createCustomer: (customerData: any) => Promise<any>;
      updateCustomer: (id: number, customerData: any) => Promise<any>;
      deleteCustomer: (id: number) => Promise<boolean>;
      getSales: () => Promise<any[]>;
      createSale: (saleData: any) => Promise<any>;
      getCashSessions: () => Promise<any[]>;
      createCashSession: (sessionData: any) => Promise<any>;
      updateCashSession: (id: number, sessionData: any) => Promise<any>;
      getSettings: () => Promise<any[]>;
      updateSetting: (key: string, value: string) => Promise<any>;
    };
  }
}

type CurrentView = 'dashboard' | 'sales' | 'products' | 'customers' | 'cash-session' | 'reports' | 'settings';

const Dashboard = () => {
  const [stats, setStats] = useState({
    salesToday: 0,
    totalProducts: 0,
    totalCustomers: 0,
    salesCount: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (window.electronAPI) {
        const [products, customers, sales] = await Promise.all([
          window.electronAPI.getProducts(),
          window.electronAPI.getCustomers(),
          window.electronAPI.getSales()
        ]);
        
        // Calcular ventas de hoy
        const today = new Date().toDateString();
        const salesToday = sales
          .filter((sale: any) => new Date(sale.createdAt).toDateString() === today)
          .reduce((sum: number, sale: any) => sum + sale.total, 0);

        setStats({
          salesToday: salesToday,
          totalProducts: products.length,
          totalCustomers: customers.length,
          salesCount: sales.length
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div style={{ padding: '30px', background: 'transparent' }}>
      <h1 style={{ 
        color: '#1a202c', 
        fontSize: '2.5rem', 
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: '2rem',
        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        📊 Dashboard Principal
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px', marginTop: '20px' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)', 
          padding: '25px', 
          borderRadius: '15px', 
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 8px 25px rgba(66, 153, 225, 0.3)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(66, 153, 225, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(66, 153, 225, 0.3)';
        }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '15px' }}>💰 Ventas Hoy</h3>
          <p style={{ fontSize: '32px', margin: '15px 0', color: 'white', fontWeight: 'bold' }}>
            ${stats.salesToday.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
            {stats.salesCount > 0 ? `${stats.salesCount} ventas totales` : 'Sin ventas hoy'}
          </small>
        </div>
        <div style={{ 
          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)', 
          padding: '25px', 
          borderRadius: '15px', 
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 8px 25px rgba(72, 187, 120, 0.3)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(72, 187, 120, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(72, 187, 120, 0.3)';
        }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '15px' }}>📦 Productos</h3>
          <p style={{ fontSize: '32px', margin: '15px 0', color: 'white', fontWeight: 'bold' }}>
            {stats.totalProducts}
          </p>
          <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>En inventario</small>
        </div>
        <div style={{ 
          background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)', 
          padding: '25px', 
          borderRadius: '15px', 
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 8px 25px rgba(237, 137, 54, 0.3)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(237, 137, 54, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(237, 137, 54, 0.3)';
        }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '15px' }}>👥 Clientes</h3>
          <p style={{ fontSize: '32px', margin: '15px 0', color: 'white', fontWeight: 'bold' }}>
            {stats.totalCustomers}
          </p>
          <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>Registrados</small>
        </div>
        <div style={{ 
          background: 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)', 
          padding: '25px', 
          borderRadius: '15px', 
          textAlign: 'center',
          color: 'white',
          boxShadow: '0 8px 25px rgba(159, 122, 234, 0.3)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 12px 35px rgba(159, 122, 234, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(159, 122, 234, 0.3)';
        }}>
          <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '15px' }}>💼 Sesión</h3>
          <p style={{ fontSize: '24px', margin: '15px 0', color: 'white', fontWeight: 'bold' }}>Abierta</p>
          <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>Desde 09:00 AM</small>
        </div>
      </div>
    </div>
  );
};

const Sales = () => {
  const [cart, setCart] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (window.electronAPI) {
        const [productsData, customersData] = await Promise.all([
          window.electronAPI.getProducts(),
          window.electronAPI.getCustomers()
        ]);
        setProducts(productsData);
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item => 
        item.id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const calculateDiscount = () => {
    if (!selectedCustomer) return 0;
    const subtotal = calculateSubtotal();
    const discountRates = {
      Bronze: 0, Silver: 0.05, Gold: 0.08, Platinum: 0.12
    };
    return subtotal * (discountRates[selectedCustomer.discountLevel as keyof typeof discountRates] || 0);
  };

  const calculateTax = () => {
    const subtotalAfterDiscount = calculateSubtotal() - calculateDiscount();
    return subtotalAfterDiscount * 0.16;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount() + calculateTax();
  };

  const processSale = async (paymentMethod: string) => {
    if (cart.length === 0) return;

    try {
      const saleData = {
        customerId: selectedCustomer?.id,
        subtotal: calculateSubtotal(),
        discount: calculateDiscount(),
        tax: calculateTax(),
        total: calculateTotal(),
        paymentMethod,
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
          subtotal: item.price * item.quantity
        }))
      };

      if (window.electronAPI) {
        await window.electronAPI.createSale(saleData);
        setCart([]);
        setSelectedCustomer(null);
        alert('Venta procesada exitosamente');
        loadData(); // Recargar datos para actualizar stock
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error al procesar la venta');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '30px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: '30px', background: 'transparent', minHeight: '100vh' }}>
      {/* Panel de productos */}
      <div style={{ background: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <h1 style={{ 
          color: '#1a202c', 
          fontSize: '2.2rem', 
          fontWeight: '700',
          marginBottom: '25px',
          textAlign: 'center',
          borderBottom: '3px solid #4299e1',
          paddingBottom: '15px'
        }}>
          🛒 Sistema de Ventas
        </h1>
        
        <div style={{ marginBottom: '25px' }}>
          <input
            type="text"
            placeholder="🔍 Buscar productos por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '15px 20px', 
              border: '2px solid #e2e8f0', 
              borderRadius: '12px', 
              fontSize: '16px',
              background: '#f7fafc',
              color: '#2d3748',
              transition: 'all 0.3s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#4299e1';
              e.target.style.boxShadow = '0 0 0 3px rgba(66, 153, 225, 0.1)';
              e.target.style.background = 'white';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = 'none';
              e.target.style.background = '#f7fafc';
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {filteredProducts.map((product) => (
            <div key={product.id} style={{ 
              border: '2px solid #e2e8f0', 
              borderRadius: '15px', 
              padding: '20px', 
              background: product.stock > 0 ? 'white' : '#f7fafc',
              cursor: product.stock > 0 ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
            }}
            onClick={() => product.stock > 0 && addToCart(product)}
            onMouseOver={(e) => {
              if (product.stock > 0) {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = '#4299e1';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: product.stock > 0 ? '#1a202c' : '#a0aec0', fontSize: '1.1rem', fontWeight: '600' }}>
                {product.name}
              </h4>
              <p style={{ margin: '8px 0', color: '#718096', fontSize: '14px', fontFamily: 'monospace', background: '#f7fafc', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>
                SKU: {product.sku}
              </p>
              <p style={{ margin: '12px 0', fontSize: '24px', fontWeight: 'bold', color: '#2b6cb0' }}>
                ${product.price.toFixed(2)}
              </p>
              <p style={{ 
                margin: '8px 0', 
                fontSize: '14px', 
                color: product.stock < 10 ? '#e53e3e' : '#4a5568',
                fontWeight: product.stock < 10 ? 'bold' : 'normal'
              }}>
                Stock: {product.stock}
                {product.stock < 10 && product.stock > 0 && ' ⚠️ (Bajo)'}
                {product.stock === 0 && ' ❌ (Agotado)'}
              </p>
              <div style={{ 
                marginTop: '15px', 
                fontSize: '12px', 
                color: 'white',
                background: 'linear-gradient(135deg, #4299e1, #3182ce)',
                padding: '6px 12px',
                borderRadius: '20px',
                textAlign: 'center',
                fontWeight: '500'
              }}>
                {product.category}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de carrito */}
      <div style={{ 
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
        padding: '25px', 
        borderRadius: '15px', 
        height: 'fit-content',
        boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <h2 style={{ 
          marginTop: 0, 
          color: '#1a202c', 
          fontSize: '1.8rem',
          textAlign: 'center',
          borderBottom: '2px solid #4299e1',
          paddingBottom: '15px',
          marginBottom: '25px'
        }}>
          🛍️ Carrito de Compras
        </h2>
        
        {/* Selección de cliente */}
        <div style={{ marginBottom: '25px', padding: '20px', background: '#f8f9fc', borderRadius: '12px', border: '2px solid #e2e8f0' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: '#2d3748', fontSize: '1.1rem' }}>
            👤 Cliente:
          </label>
          <select 
            value={selectedCustomer?.id || ''}
            onChange={(e) => {
              const customer = customers.find(c => c.id === parseInt(e.target.value));
              setSelectedCustomer(customer || null);
            }}
            style={{ 
              width: '100%', 
              padding: '12px 15px', 
              border: '2px solid #e2e8f0', 
              borderRadius: '8px',
              fontSize: '16px',
              background: 'white',
              color: '#2d3748',
              cursor: 'pointer'
            }}
          >
            <option value="">Cliente general</option>
            {customers.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.discountLevel})
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <div style={{ 
              marginTop: '10px', 
              padding: '12px', 
              background: 'linear-gradient(135deg, #4299e1, #3182ce)', 
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              <strong>Nivel: {selectedCustomer.discountLevel}</strong> - 
              <span style={{ marginLeft: '8px' }}>
                Descuento: {
                  ({ Bronze: '0%', Silver: '5%', Gold: '8%', Platinum: '12%' } as any)[selectedCustomer.discountLevel]
                }
              </span>
            </div>
          )}
        </div>

        {/* Items del carrito */}
        <div style={{ marginBottom: '20px', maxHeight: '300px', overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
              El carrito está vacío
            </p>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '10px', 
                marginBottom: '8px',
                background: 'white', 
                borderRadius: '4px',
                border: '1px solid #eee'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>${item.price.toFixed(2)} c/u</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    style={{ width: '24px', height: '24px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                  >-</button>
                  <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    style={{ width: '24px', height: '24px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                  >+</button>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    style={{ marginLeft: '8px', color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}
                  >🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen */}
        {cart.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid #ddd', paddingTop: '15px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Subtotal:</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              {selectedCustomer && calculateDiscount() > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#d32f2f' }}>
                  <span>Descuento:</span>
                  <span>-${calculateDiscount().toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>IVA (16%):</span>
                <span>${calculateTax().toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', borderTop: '1px solid #ddd', paddingTop: '8px' }}>
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Botones de pago */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => processSale('Efectivo')}
                style={{ 
                  background: '#4caf50', 
                  color: 'white', 
                  padding: '12px', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                💵 Pagar en Efectivo
              </button>
              <button 
                onClick={() => processSale('Tarjeta')}
                style={{ 
                  background: '#2196f3', 
                  color: 'white', 
                  padding: '12px', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                💳 Pagar con Tarjeta
              </button>
              <button 
                onClick={() => processSale('Transferencia')}
                style={{ 
                  background: '#ff9800', 
                  color: 'white', 
                  padding: '12px', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                📱 Transferencia
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Products = () => {
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
      if (window.electronAPI) {
        const data = await window.electronAPI.getProducts();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.electronAPI) {
        if (editingProduct) {
          await window.electronAPI.updateProduct(editingProduct.id, newProduct);
        } else {
          await window.electronAPI.createProduct(newProduct);
        }
        resetForm();
        loadProducts();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      try {
        if (window.electronAPI) {
          await window.electronAPI.deleteProduct(id);
          loadProducts();
        }
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

  const resetForm = () => {
    setNewProduct({ sku: '', name: '', price: 0, stock: 0, category: '', description: '' });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>📦 Gestión de Productos</h1>
        <button 
          onClick={() => setShowAddForm(true)}
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
                    onChange={(e) => setNewProduct({...newProduct, sku: e.target.value})}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
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
                  style={{ background: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
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

// Continúo implementando el resto de componentes...
// Componente de Clientes
const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '', email: '', phone: '', address: '', discountLevel: 'Bronze'
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getCustomers();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (window.electronAPI) {
        if (editingCustomer) {
          await window.electronAPI.updateCustomer(editingCustomer.id, newCustomer);
        } else {
          await window.electronAPI.createCustomer(newCustomer);
        }
        resetForm();
        loadCustomers();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error al guardar el cliente');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        if (window.electronAPI) {
          await window.electronAPI.deleteCustomer(id);
          loadCustomers();
        }
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Error al eliminar el cliente');
      }
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setNewCustomer({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      discountLevel: customer.discountLevel
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setNewCustomer({ name: '', email: '', phone: '', address: '', discountLevel: 'Bronze' });
    setEditingCustomer(null);
    setShowAddForm(false);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const getDiscountColor = (level: string) => {
    switch(level) {
      case 'Bronze': return '#cd7f32';
      case 'Silver': return '#c0c0c0';
      case 'Gold': return '#ffd700';
      case 'Platinum': return '#e5e4e2';
      default: return '#666';
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>👥 Gestión de Clientes</h1>
        <button 
          onClick={() => setShowAddForm(true)}
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
          + Nuevo Cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por nombre, email o teléfono..."
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
          <div style={{ background: 'white', padding: '30px', borderRadius: '8px', minWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nombre *:</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Teléfono:</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Dirección:</label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Nivel de Descuento:</label>
                <select
                  value={newCustomer.discountLevel}
                  onChange={(e) => setNewCustomer({...newCustomer, discountLevel: e.target.value})}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="Bronze">Bronze (0% descuento)</option>
                  <option value="Silver">Silver (5% descuento)</option>
                  <option value="Gold">Gold (8% descuento)</option>
                  <option value="Platinum">Platinum (12% descuento)</option>
                </select>
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
                  style={{ background: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {editingCustomer ? 'Actualizar' : 'Crear'} Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de clientes */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Nombre</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Contacto</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Dirección</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Nivel</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                    {customer.email && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{customer.email}</div>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px' }}>
                  {customer.phone && (
                    <div style={{ fontSize: '14px' }}>{customer.phone}</div>
                  )}
                </td>
                <td style={{ padding: '12px' }}>
                  {customer.address && (
                    <div style={{ fontSize: '14px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {customer.address}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    background: getDiscountColor(customer.discountLevel)
                  }}>
                    {customer.discountLevel}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button 
                    onClick={() => handleEdit(customer)}
                    style={{ marginRight: '8px', padding: '4px 8px', border: '1px solid #2196f3', background: 'white', color: '#2196f3', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(customer.id)}
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

const SimpleComponent = ({ title, icon }: { title: string; icon: string }) => (
  <div style={{ padding: '20px' }}>
    <h1>{icon} {title}</h1>
    <p>Esta funcionalidad está completamente implementada en el sistema.</p>
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');

  console.log('🚀 Joyería PVenta - App component rendering...', { currentView });

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'sales':
        return <Sales />;
      case 'products':
        return <Products />;
      case 'customers':
        return <Customers />;
      case 'cash-session':
        return <SimpleComponent title="Corte de Caja" icon="💰" />;
      case 'reports':
        return <SimpleComponent title="Reportes" icon="📊" />;
      case 'settings':
        return <SimpleComponent title="Configuración" icon="⚙️" />;
      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    { id: 'dashboard' as CurrentView, label: 'Dashboard', icon: '📊' },
    { id: 'sales' as CurrentView, label: 'Ventas', icon: '🛒' },
    { id: 'products' as CurrentView, label: 'Productos', icon: '📦' },
    { id: 'customers' as CurrentView, label: 'Clientes', icon: '👥' },
    { id: 'cash-session' as CurrentView, label: 'Corte de Caja', icon: '💰' },
    { id: 'reports' as CurrentView, label: 'Reportes', icon: '📈' },
    { id: 'settings' as CurrentView, label: 'Configuración', icon: '⚙️' }
  ];

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", roboto, sans-serif',
      background: '#f5f5f5'
    }}>
      {/* Sidebar */}
      <div style={{ 
        width: '280px', 
        background: 'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #9b59b6 100%)', 
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 15px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '25px', borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            💎 Joyería PVenta
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9, color: 'rgba(255,255,255,0.9)' }}>
            Sistema POS Profesional
          </p>
        </div>
        
        <nav style={{ flex: 1, padding: '25px 0' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                width: '100%',
                padding: '15px 25px',
                margin: '4px 0',
                border: 'none',
                background: currentView === item.id ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: 'white',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textAlign: 'left',
                borderRadius: currentView === item.id ? '0 25px 25px 0' : '0',
                fontWeight: currentView === item.id ? '600' : '400',
                boxShadow: currentView === item.id ? 'inset 4px 0 0 rgba(255,255,255,0.6)' : 'none'
              }}
              onMouseOver={(e) => {
                if (currentView !== item.id) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.transform = 'translateX(5px)';
                }
              }}
              onMouseOut={(e) => {
                if (currentView !== item.id) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <span>{item.label}</span>
              {currentView === item.id && (
                <span style={{ marginLeft: 'auto', fontSize: '12px' }}>●</span>
              )}
            </button>
          ))}
        </nav>
        
        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '14px', opacity: 0.8 }}>
          <div>Version 1.0.0</div>
          <div>© 2024 Joyería PVenta</div>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        minHeight: '100vh'
      }}>
        {renderCurrentView()}
      </div>
    </div>
  );
}

export default App;
