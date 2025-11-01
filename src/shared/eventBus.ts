import { ProductCatalogEvent, ProductCatalogEventType } from './types';

type EventHandler<K extends ProductCatalogEventType> = (
  event: Extract<ProductCatalogEvent, { type: K }>
) => void;

class SimpleEventBus {
  private handlers: Map<ProductCatalogEventType, Set<(...args: any[]) => void>> = new Map();

  subscribe<K extends ProductCatalogEventType>(type: K, handler: EventHandler<K>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as (...args: any[]) => void);
    this.handlers.set(type, set);
    return () => {
      const current = this.handlers.get(type);
      if (!current) return;
      current.delete(handler as (...args: any[]) => void);
      if (current.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  publish(event: ProductCatalogEvent) {
    const listeners = this.handlers.get(event.type);
    if (!listeners || listeners.size === 0) return;
    for (const handler of Array.from(listeners)) {
      try {
        (handler as EventHandler<typeof event.type>)(event);
      } catch (error) {
        console.error('eventBus handler error', error);
      }
    }
  }
}

export const eventBus = new SimpleEventBus();
