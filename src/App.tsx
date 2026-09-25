import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import NewShop from './pages/NewShop';
import Storefront from './pages/Storefront';
import Checkout from './pages/Checkout';
import OrderDone from './pages/OrderDone';
import Panel from './pages/Panel';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dukkan-ac" element={<NewShop />} />
        <Route path="/:slug" element={<Storefront />} />
        <Route path="/:slug/odeme" element={<Checkout />} />
        <Route path="/:slug/siparis/:orderId" element={<OrderDone />} />
        <Route path="/:slug/panel" element={<Panel />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export function NotFound() {
  return (
    <div className="center-page">
      <div className="big-emoji">🤷</div>
      <h1>Sayfa bulunamadı</h1>
      <Link className="btn" to="/">Çarşıya dön</Link>
    </div>
  );
}
