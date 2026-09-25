import { Link, useParams } from 'react-router-dom';
import { NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel } from '../format';
import { useStore } from '../store';
import { orderMessage, whatsappLink } from '../whatsapp';
import { Totals } from './Storefront';

export default function OrderDone() {
  const { slug = '', orderId } = useParams();
  const { getShop, orders } = useStore();
  const shop = getShop(slug);
  const order = orders.find((o) => o.id === orderId && o.shopSlug === slug);
  if (!shop || !order) return <NotFound />;

  return (
    <ShopLayout shop={shop}>
      <main className="wrap narrow">
        <div className="card center">
          <div className="big-emoji">✅</div>
          <h1>Siparişiniz alındı!</h1>
          <p>
            Sipariş no <b>#{order.id}</b> · Durum: <span className="tag">{order.status}</span>
          </p>
          <p className="muted">
            {shop.name} siparişinizi hazırlamaya başlayacak. Hızlı onay için siparişi WhatsApp'tan da iletebilirsiniz.
          </p>
          <a className="btn btn-whatsapp" href={whatsappLink(shop.phone, orderMessage(order, shop))} target="_blank" rel="noreferrer">
            WhatsApp ile esnafa gönder
          </a>
        </div>
        <div className="card">
          <ul className="summary-list">
            {order.lines.map((l) => (
              <li key={l.productId}>
                <span>{l.name} <span className="muted small">× {qtyLabel(l.qty, l.unit)}</span></span>
                <span>{money(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <Totals subtotal={order.subtotal} deliveryFee={order.deliveryFee} total={order.total} />
          <p className="small muted">
            {order.fulfillment === 'teslimat' ? `Teslimat adresi: ${order.address}` : 'Gel-al'} · Ödeme: {order.payment}
          </p>
        </div>
        <Link to={`/${slug}`} className="link">← Alışverişe devam et</Link>
      </main>
    </ShopLayout>
  );
}
