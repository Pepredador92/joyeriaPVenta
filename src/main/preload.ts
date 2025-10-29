import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

// API segura expuesta al renderer
const electronAPI = {
  // Productos
  getProducts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PRODUCTS),
  getCategoryCatalog: (term?: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CATEGORY_CATALOG, term),
  createProduct: (productData: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PRODUCT, productData),
  updateProduct: (id: number, productData: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PRODUCT, id, productData),
  deleteProduct: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PRODUCT, id),

  // Clientes
  getCustomers: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CUSTOMERS),
  createCustomer: (customerData: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_CUSTOMER, customerData),
  updateCustomer: (id: number, customerData: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CUSTOMER, id, customerData),
  deleteCustomer: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOMER, id),

  // Ventas
  getSales: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SALES),
  createSale: (saleData: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_SALE, saleData),
  updateSale: (id: number, saleData: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SALE, id, saleData),
  deleteSale: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_SALE, id),
  clearSales: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_SALES),
  getSalesByRange: (startDate: string, endDate: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_SALES_BY_RANGE, startDate, endDate),

  // Sesiones de caja
  getCashSessions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CASH_SESSIONS),
  createCashSession: (sessionData: any) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_CASH_SESSION, sessionData),
  updateCashSession: (id: number, sessionData: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CASH_SESSION, id, sessionData),
  deleteCashSession: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_CASH_SESSION, id),

  // Configuración
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTING, key, value),
  deleteAllSales: () => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALL_SALES),
  deleteAllCustomers: () => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ALL_CUSTOMERS),

  // Logging
  logInfo: (msg: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG_INFO, msg),
  logWarn: (msg: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG_WARN, msg),

  // Eventos
  onSalesChanged: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC_CHANNELS.SALES_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SALES_CHANGED, handler);
  }
};

// Exponer API al renderer de forma segura
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Declarar el tipo para TypeScript
export type ElectronAPI = typeof electronAPI;
