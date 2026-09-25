import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Loading, NotFound } from '../App';
import ShopLayout from '../components/ShopLayout';
import { money, qtyLabel } from '../format';
import { startPayment, verifyPayment } from '../payment';
import { useOrder, useStore } from '../store';
import { orderMessage, whatsappLink } from '../whatsapp';
import { Totals } from './Storefront';

export default function OrderDone() {
  const { slug = '', orderId } = useParams();
  const [params, setParams] = useSearchParams();
  const { getShop, shopsLoading, backend } = useStore();
  const shop = getShop(slug);
  const { order, loading, reload } = useOrder(orderId);
  const token = params.get('token');
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const verified = useRef<string | null>(null);

  // Back from iyzico: the server confirms with iyzico and records the result.
  useEffect(() => {
    if (!token || verified.current === token) return;
    verified.current = token;
    setChecking(true);
    verifyPayment(token)
      .then(reload)
      .finally(() => {
        setChecking(false);
        setParams({}, { replace: true });
      });
  }, [token, reload, setParams]);

  if (!shop || !order || order.shopSlug !== slug) return shopsLoading || loading ? <Loading /> : <NotFound />;

  const online = order.online;
  const retry = async () => {
    setBusy(true);
    setActionError('');
    try {
      window.location.href = await startPayment(order.id);
    } catch (err) {
      setActionError((err as Error).message);
      setBusy(false);
    }
  };
  const switchToCash = async () => {
    setBusy(true);
    try {
      await backend.switchToCash(order.id);
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
              <p className="muted">Sipariş no <b>#{order.code}</b> · {money(order.total)}</p>
              <div className="row gap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={retry} disabled={busy}>
                  {busy ? 'Bekleyin…' : 'Kartla öde'}
                </button>
                <button className="link" onClick={switchToCash} disabled={busy}>Kapıda nakit öderim</button>
              </div>
              {actionError && <p className="warn">{actionError}</p>}
            </>
          ) : (
            <>
              <div className="big-emoji">✅</div>
              <h1>Siparişiniz alındı!</h1>
              <p>
                Sipariş no <b>#{order.code}</b> · Durum: <span className="tag">{order.status}</span>
              </p>
              {online?.state === 'ödendi' && (
                <p className="ok">
                  💳 {money(online.paidAmount ?? order.total)} ödendi {online.card && `(${online.card})`} · iyzico no {online.paymentId}
                </p>
              )}
              <p className="muted">
                {shop.name} siparişinizi hazırlamaya başlayacak. Bu sayfanın bağlantısını saklayarak siparişinizin durumunu takip edebilirsiniz.
              </p>
              <a className="btn btn-whatsapp" href={whatsappLink(shop.phone, orderMessage(order, shop))} target="_blank" rel="noreferrer">
                WhatsApp ile esnafa yaz
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
