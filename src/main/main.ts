import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import log from 'electron-log';
import { databaseService } from './database/DatabaseService';
import { IPC_CHANNELS } from '../shared/types';

// Configurar logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class JoyeriaApp {
  private mainWindow: BrowserWindow | null = null;
  private isDevelopment = process.env.NODE_ENV === 'development';

  constructor() {
    this.setupApp();
  }

  private setupApp() {
  // Unificar nombre de app (afecta app.getPath('userData'))
  try { app.setName('Vangelico'); } catch {}
  // Configuración de seguridad
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIPC();
      this.initializeDatabase();
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // Configuración de seguridad
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    });
  }

  private async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs'),
        webSecurity: true
      },
      titleBarStyle: 'default',
      icon: process.platform === 'win32' ? 
        path.join(__dirname, '../../assets/icon.ico') : 
        path.join(__dirname, '../../assets/icon.png'),
      show: true,  // Mostrar inmediatamente
      alwaysOnTop: false,
      skipTaskbar: false
    });

    // Configurar menu
    this.setupMenu();

    // Cargar la aplicación
    await this.loadRenderer();

    // La ventana ya está visible (show: true), pero asegurarse de que tenga foco
    this.mainWindow.focus();
    
    if (this.isDevelopment) {
      this.mainWindow.webContents.openDevTools();
    }

    // Logging para debugging
    this.mainWindow.webContents.on('did-finish-load', () => {
  log.info('🚀 Vangelico loaded successfully');
    });
  }

  private async loadRenderer() {
    if (!this.mainWindow) return;

    if (this.isDevelopment) {
      // En desarrollo, conectarse SOLO a la URL/puerto esperado
      const devPort = Number(process.env.VITE_DEV_SERVER_PORT || 5173);
      const url = process.env.VITE_DEV_SERVER_URL || `http://localhost:${devPort}`;
      try {
        log.info(`🔗 Trying to load URL: ${url}`);
        await this.mainWindow.loadURL(url);
        log.info(`✅ Successfully loaded: ${url}`);
      } catch (error) {
        log.error(`❌ Could not connect to development server at ${url}`);
        log.error(error);
        app.quit();
      }
    } else {
      // En producción
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  }

  private setupMenu() {
    if (process.platform === 'darwin') {
      const template = [
        {
          label: 'Vangelico',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        },
        {
          label: 'Archivo',
          submenu: [
            { role: 'close' }
          ]
        },
        {
          label: 'Editar',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectall' }
          ]
        },
        {
          label: 'Ver',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
          ]
        }
      ];
      Menu.setApplicationMenu(Menu.buildFromTemplate(template as any));
    } else {
      Menu.setApplicationMenu(null);
    }
  }

  private setupIPC() {
    // Handlers para Productos
    ipcMain.handle(IPC_CHANNELS.GET_PRODUCTS, async () => {
      try {
        return await databaseService.getProducts();
      } catch (error) {
        log.error('Error getting products:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.GET_CATEGORY_CATALOG, async (_, term?: string) => {
      try {
        return await databaseService.getCategoryCatalog(term);
      } catch (error) {
        log.error('Error getting category catalog:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.CREATE_PRODUCT, async (_, productData) => {
      try {
        return await databaseService.createProduct(productData);
      } catch (error) {
        log.error('Error creating product:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_PRODUCT, async (_, id, productData) => {
      try {
        return await databaseService.updateProduct(id, productData);
      } catch (error) {
        log.error('Error updating product:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_PRODUCT, async (_, id) => {
      try {
        return await databaseService.deleteProduct(id);
      } catch (error) {
        log.error('Error deleting product:', error);
        throw error;
      }
    });

    // Handlers para Clientes
    ipcMain.handle(IPC_CHANNELS.GET_CUSTOMERS, async () => {
      try {
        return await databaseService.getCustomers();
      } catch (error) {
        log.error('Error getting customers:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.CREATE_CUSTOMER, async (_, customerData) => {
      try {
        return await databaseService.createCustomer(customerData);
      } catch (error) {
        log.error('Error creating customer:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_CUSTOMER, async (_, id, customerData) => {
      try {
        return await databaseService.updateCustomer(id, customerData);
      } catch (error) {
        log.error('Error updating customer:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOMER, async (_, id) => {
      try {
        return await databaseService.deleteCustomer(id);
      } catch (error) {
        log.error('Error deleting customer:', error);
        throw error;
      }
    });

    // Handlers para Ventas
    ipcMain.handle(IPC_CHANNELS.GET_SALES, async () => {
      try {
        return await databaseService.getSales();
      } catch (error) {
        log.error('Error getting sales:', error);
        throw error;
      }
    });
    ipcMain.handle(IPC_CHANNELS.GET_SALES_BY_RANGE, async (_evt, startDate: string, endDate: string) => {
      try {
        return await databaseService.getSalesByRange(startDate, endDate);
      } catch (error) {
        log.error('Error getting sales by range:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.GET_SALES_BY_CUSTOMER, async (_evt, customerId: number) => {
      try {
        return await databaseService.getSalesByCustomer(customerId);
      } catch (error) {
        log.error('Error getting sales by customer:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.CREATE_SALE, async (_, saleData) => {
      try {
        return await databaseService.createSale(saleData);
      } catch (error) {
        log.error('Error creating sale:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_SALE, async (_evt, id: number, saleData) => {
      try {
        return await databaseService.updateSale(id, saleData);
      } catch (error) {
        log.error('Error updating sale:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_SALE, async (_evt, id: number) => {
      try {
        return await databaseService.deleteSale(id);
      } catch (error) {
        log.error('Error deleting sale:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.CLEAR_SALES, async () => {
      try {
        log.info('🗑️ CLEAR_SALES invoked');
        const result = await databaseService.clearSales();
        if (result && this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.SALES_CHANGED);
        }
        log.info(`🗑️ CLEAR_SALES completed: ${result}`);
        return result;
      } catch (error) {
        log.error('Error clearing sales:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_ALL_SALES, async () => {
      try {
        const result = await databaseService.deleteAllSales();
        if (result && this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.SALES_CHANGED);
        }
        return result;
      } catch (error) {
        log.error('Error deleting all sales:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_ALL_CUSTOMERS, async () => {
      try {
        return await databaseService.deleteAllCustomers();
      } catch (error) {
        log.error('Error deleting all customers:', error);
        throw error;
      }
    });

    // Handlers para Sesiones de Caja
    ipcMain.handle(IPC_CHANNELS.GET_CASH_SESSIONS, async () => {
      try {
        return await databaseService.getCashSessions();
      } catch (error) {
        log.error('Error getting cash sessions:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.CREATE_CASH_SESSION, async (_, sessionData) => {
      try {
        return await databaseService.createCashSession(sessionData);
      } catch (error) {
        log.error('Error creating cash session:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_CASH_SESSION, async (_, id, sessionData) => {
      try {
        return await databaseService.updateCashSession(id, sessionData);
      } catch (error) {
        log.error('Error updating cash session:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.DELETE_CASH_SESSION, async (_evt, id: number) => {
      try {
        return await databaseService.deleteCashSession(id);
      } catch (error) {
        log.error('Error deleting cash session:', error);
        throw error;
      }
    });

    // Handlers para Configuración
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
      try {
        return await databaseService.getSettings();
      } catch (error) {
        log.error('Error getting settings:', error);
        throw error;
      }
    });

    ipcMain.handle(IPC_CHANNELS.UPDATE_SETTING, async (_, key, value) => {
      try {
        return await databaseService.updateSetting(key, value);
      } catch (error) {
        log.error('Error updating setting:', error);
        throw error;
      }
    });

    // Logging básico
    ipcMain.handle(IPC_CHANNELS.LOG_INFO, async (_evt, msg: string) => {
      try { log.info(msg); } catch {}
      return true;
    });
    ipcMain.handle(IPC_CHANNELS.LOG_WARN, async (_evt, msg: string) => {
      try { log.warn(msg); } catch {}
      return true;
    });

    log.info('🔗 IPC handlers registered successfully');
  }

  private async initializeDatabase() {
    try {
      await databaseService.initialize();
  try { log.info(`📂 userData: ${app.getPath('userData')}`); } catch {}
      log.info('🗄️ Database initialized successfully');
    } catch (error) {
      log.error('❌ Database initialization failed:', error);
      app.quit();
    }
  }
}

// Inicializar la aplicación
new JoyeriaApp();

// Manejar eventos de cierre
process.on('before-exit', async () => {
  // El MockDatabaseService no necesita cierre explícito
  log.info('🔐 Application closing...');
});

process.on('SIGINT', async () => {
  log.info('🔐 Application interrupted...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('🔐 Application terminated...');
  process.exit(0);
});
