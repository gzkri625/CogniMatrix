export type Unit = 'adet' | 'kg' | 'demet' | 'paket' | 'litre';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // TL, per unit
  unit: Unit;
  category: string;
  emoji: string;
  inStock: boolean;
}

export type ShopCategory =
  | 'Fırın'
  | 'Manav'
  | 'Kasap'
  | 'Balıkçı'
  | 'Kırtasiye'
  | 'Çiçekçi'
  | 'Şarküteri'
  | 'Diğer';

export interface Shop {
  slug: string;
  name: string;
  category: ShopCategory;
  tagline: string;
  emoji: string;
  color: string; // brand color (hex)
  owner: string;
  phone: string; // digits only, with country code, e.g. 905321234567
  address: string;
  district: string;
  city?: string; // il, used for iyzico addresses (default İstanbul)
  hours: string;
  deliveryFee: number;
  freeDeliveryOver: number; // 0 = never free
  minOrder: number;
  pin: string; // demo-only panel PIN, stored client side
  products: Product[];
}

export interface CartLine {
  productId: string;
  qty: number;
}

export type OrderStatus = 'yeni' | 'hazırlanıyor' | 'yolda' | 'teslim edildi' | 'iptal';

export interface OrderLine {
  productId: string;
  name: string;
  unit: Unit;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  shopSlug: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  email?: string;
  address: string;
  note: string;
  fulfillment: 'teslimat' | 'gel-al';
  payment: 'kapıda nakit' | 'kapıda kart' | 'havale' | 'online kart';
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  /** Only for payment === 'online kart'. */
  online?: {
    state: 'bekliyor' | 'ödendi' | 'başarısız';
    paymentId?: string;
    paidAmount?: number;
    card?: string;
    error?: string;
  };
}
