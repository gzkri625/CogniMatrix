import type { Order, OrderInput, OrderStatus, Product, Shop, User } from '../types';

export type NewShop = Omit<Shop, 'ownerId' | 'products'>;
export type ShopPatch = Partial<Omit<Shop, 'slug' | 'ownerId' | 'products'>>;

/**
 * Everything the UI needs from storage. Two implementations:
 * Supabase (real, multi-device) and demo (localStorage, single browser).
 */
export interface Backend {
  mode: 'demo' | 'supabase';

  listShops(): Promise<Shop[]>;
  createShop(shop: NewShop, products: Omit<Product, 'id'>[]): Promise<Shop>;
  updateShop(slug: string, patch: ShopPatch): Promise<void>;
  /** Inserts when product.id is empty, otherwise updates. */
  saveProduct(slug: string, product: Product): Promise<Product>;
  deleteProduct(slug: string, productId: string): Promise<void>;

  /** Prices are computed by the backend from its own catalog, never from the client. */
  placeOrder(input: OrderInput): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  switchToCash(id: string): Promise<void>;
  listOrders(slug: string): Promise<Order[]>;
  setOrderStatus(id: string, status: OrderStatus): Promise<void>;
  /** Calls onChange whenever the shop's orders change. Returns unsubscribe. */
  subscribeOrders(slug: string, onChange: () => void): () => void;

  currentUser(): Promise<User | null>;
  onAuthChange(cb: (user: User | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** needsConfirmation: the account must be confirmed via the e-mail link first. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;

  resetDemo?(): void;
}
