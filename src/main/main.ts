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
      contents.on('new-window', (navigationEvent) => {
        navigationEvent.preventDefault();
      });

      contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
      });
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
        enableRemoteModule: false,
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
      log.info('🚀 Joyería PVenta loaded successfully');
    });
  }

  private async loadRenderer() {
    if (!this.mainWindow) return;

    if (this.isDevelopment) {
      // En desarrollo, intentar conectar con múltiples puertos
      const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179];
      
      for (const port of ports) {
        try {
          const url = `http://localhost:${port}`;
          log.info(`🔗 Trying to load URL: ${url}`);
          await this.mainWindow.loadURL(url);
          log.info(`✅ Successfully loaded: ${url}`);
          break;
        } catch (error) {
          log.warn(`❌ Failed to load port ${port}, trying next...`);
          if (port === ports[ports.length - 1]) {
            log.error('❌ Could not connect to development server');
            app.quit();
          }
        }
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
          label: 'Joyería PVenta',
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

    ipcMain.handle(IPC_CHANNELS.CREATE_SALE, async (_, saleData) => {
      try {
        return await databaseService.createSale(saleData);
      } catch (error) {
        log.error('Error creating sale:', error);
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

    log.info('🔗 IPC handlers registered successfully');
  }

  private async initializeDatabase() {
    try {
      await databaseService.initialize();
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
