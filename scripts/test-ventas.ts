import { VentasService } from '../src/renderer/domain/VentasService';
import { ISalesRepository, CreateSaleDTO, SaleDTO } from '../src/renderer/data/SalesRepository';

class MockRepo implements ISalesRepository {
  sales: SaleDTO[] = [];
  id = 1;
  async createSale(data: CreateSaleDTO): Promise<SaleDTO> {
    const s: SaleDTO = {
      id: this.id++,
      ...data,
      status: 'Completada',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.sales.push(s);
    return s;
  }
  async getSales(): Promise<SaleDTO[]> { return this.sales; }
}

(async () => {
  const service = new VentasService(new MockRepo());
  // Validación
  const invalid = await service.crearVenta({ cantidad: 0, precioUnitario: 0, metodoPago: 'Efectivo' });
  console.log('invalid.ok', invalid.ok, 'error', (invalid as any).error);

  // Cálculo
  const res = await service.crearVenta({ cantidad: 2, precioUnitario: 100, metodoPago: 'Tarjeta' });
  if (res.ok) {
    console.log('total esperado 232 =', res.venta.total);
  } else {
    console.error('falló', res.error);
  }
})();
