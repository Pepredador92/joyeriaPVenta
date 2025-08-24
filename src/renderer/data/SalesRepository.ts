// Simple repository to interact with main process sales API
export interface SaleItemDTO {
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CreateSaleDTO {
  customerId?: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  items: SaleItemDTO[];
  notes?: string;
}

export interface SaleDTO extends CreateSaleDTO {
  id: number;
  status: 'Completada' | 'Cancelada' | 'Pendiente';
  createdAt: string;
  updatedAt: string;
}

export interface ISalesRepository {
  createSale(data: CreateSaleDTO): Promise<SaleDTO>;
  getSales(): Promise<SaleDTO[]>;
  getRecentSales?(limit?: number): Promise<SaleDTO[]>;
}

export class SalesRepository implements ISalesRepository {
  async createSale(data: CreateSaleDTO): Promise<SaleDTO> {
    // window.electronAPI is provided by preload in renderer
    // In tests, you can mock this via dependency injection or global polyfill
    // @ts-ignore
    return await window.electronAPI.createSale(data);
  }

  async getSales(): Promise<SaleDTO[]> {
    // @ts-ignore
    return await window.electronAPI.getSales();
  }

  async getRecentSales(limit = 10): Promise<SaleDTO[]> {
    const all = await this.getSales();
    return [...all]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
}
