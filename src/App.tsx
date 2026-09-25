import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Link from './components/AppLink';
import AuthForm from './components/AuthForm';
import Home from './pages/Home';
import NewShop from './pages/NewShop';
import Storefront from './pages/Storefront';
import Checkout from './pages/Checkout';
import OrderDone from './pages/OrderDone';
import Panel from './pages/Panel';
import { useStore } from './store';

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
        <Route path="/giris" element={<SignIn />} />
        <Route path="/:slug" element={<Storefront />} />
        <Route path="/:slug/odeme" element={<Checkout />} />
        <Route path="/:slug/siparis/:orderId" element={<OrderDone />} />
        <Route path="/:slug/panel" element={<Panel />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

/** Landing page for e-mail confirmation links; sends owners to their shop. */
function SignIn() {
  const { user, shops, shopsLoading } = useStore();
  if (user && !shopsLoading) {
    const mine = shops.find((s) => s.ownerId === user.id);
    return <Navigate to={mine ? `/${mine.slug}/panel` : '/dukkan-ac'} replace />;
  }
  return (
    <PlatformShell>
      <AuthForm />
    </PlatformShell>
  );
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const { user, backend } = useStore();
  return (
    <>
      <header className="platform-bar">
        <div className="wrap row">
          <Link to="/" className="logo">🏪 Esnaf Çarşı</Link>
          <span className="row gap">
            {user ? (
              <button className="link" onClick={() => backend.signOut()}>Çıkış</button>
            ) : (
              <Link to="/giris" className="link">Esnaf girişi</Link>
            )}
            <Link to="/dukkan-ac" className="btn btn-sm">Dükkanını Aç</Link>
          </span>
        </div>
      </header>
      {children}
    </>
  );
}

export function Loading() {
  return (
    <div className="center-page">
      <div className="spinner" aria-label="Yükleniyor" />
    </div>
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
