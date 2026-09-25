import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel } from '../format';
import { startPayment, verifyPayment } from '../payment';
import { useStore } from '../store';
import { orderMessage, whatsappLink } from '../whatsapp';
import { Totals } from './Storefront';

export default function OrderDone() {
  const { slug = '', orderId } = useParams();
  const [params, setParams] = useSearchParams();
  const { getShop, orders, updateOrder } = useStore();
  const shop = getShop(slug);
  const order = orders.find((o) => o.id === orderId && o.shopSlug === slug);
  const token = params.get('token');
  const [checking, setChecking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const verified = useRef<string | null>(null);

  // Returning from iyzico: confirm the result server-to-server.
  useEffect(() => {
    if (!order?.online || !token || verified.current === token) return;
    verified.current = token;
    // A confirmed payment is final; a stale or forged token must not undo it.
    if (order.online.state === 'ödendi') {
      setParams({}, { replace: true });
      return;
    }
    setChecking(true);
    verifyPayment(token).then((r) => {
      const ok = r.odendi && r.siparisNo === order.id;
      updateOrder(order.id, {
        online: ok
          ? { state: 'ödendi', paymentId: r.odemeNo, paidAmount: r.tutar, card: r.kart }
          : { state: 'başarısız', error: r.odendi ? 'Sipariş numarası eşleşmedi' : r.hata },
      });
      setChecking(false);
      setParams({}, { replace: true });
    });
  }, [order, token, updateOrder, setParams]);

  if (!shop || !order) return <NotFound />;

  const online = order.online;
  const retry = async () => {
    setRetrying(true);
    setRetryError('');
    try {
      window.location.href = await startPayment(order, shop);
    } catch (err) {
      setRetryError((err as Error).message);
      setRetrying(false);
    }
  };
  const switchToCash = () => updateOrder(order.id, { payment: 'kapıda nakit', online: undefined });

  const failed = online?.state === 'başarısız';
  const pending = online?.state === 'bekliyor';

  return (
    <ShopLayout shop={shop}>
      <main className="wrap narrow">
        <div className="card center">
          {checking ? (
            <>
              <div className="big-emoji">⏳</div>
              <h1>Ödeme kontrol ediliyor…</h1>
            </>
          ) : failed || pending ? (
            <>
              <div className="big-emoji">{failed ? '❌' : '💳'}</div>
              <h1>{failed ? 'Ödeme tamamlanamadı' : 'Ödeme bekleniyor'}</h1>
              {online?.error && <p className="warn">{online.error}</p>}
              <p className="muted">Sipariş no <b>#{order.id}</b> · {money(order.total)}</p>
              <div className="row gap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={retry} disabled={retrying}>
                  {retrying ? 'Açılıyor…' : 'Tekrar kartla öde'}
                </button>
                <button className="link" onClick={switchToCash}>Kapıda nakit öderim</button>
              </div>
              {retryError && <p className="warn">{retryError}</p>}
            </>
          ) : (
            <>
              <div className="big-emoji">✅</div>
              <h1>Siparişiniz alındı!</h1>
              <p>
                Sipariş no <b>#{order.id}</b> · Durum: <span className="tag">{order.status}</span>
              </p>
              {online?.state === 'ödendi' && (
                <p className="ok">
                  💳 {money(online.paidAmount ?? order.total)} ödendi {online.card && `(${online.card})`} · iyzico no {online.paymentId}
                </p>
              )}
              <p className="muted">
                {shop.name} siparişinizi hazırlamaya başlayacak. Hızlı onay için siparişi WhatsApp'tan da iletebilirsiniz.
              </p>
              <a className="btn btn-whatsapp" href={whatsappLink(shop.phone, orderMessage(order, shop))} target="_blank" rel="noreferrer">
                WhatsApp ile esnafa gönder
              </a>
            </>
          )}
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
