import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Shop } from '../types';

/** Branded shell shared by every page of a single shop's site. */
export default function ShopLayout({ shop, children, right }: { shop: Shop; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="shop-site" style={{ '--brand': shop.color } as CSSProperties}>
      <header className="shop-bar">
        <div className="wrap row">
          <Link to={`/${shop.slug}`} className="logo">
            <span>{shop.emoji}</span> {shop.name}
          </Link>
          {right}
        </div>
      </header>
      {children}
      <footer className="footer">
        <div className="wrap row">
          <span>
            {shop.name} · {shop.address}, {shop.district} ·{' '}
            <a href={`tel:+${shop.phone}`}>+{shop.phone}</a>
          </span>
          <span className="small">
            <Link to={`/${shop.slug}/panel`}>Esnaf girişi</Link> · <Link to="/">Esnaf Çarşı ile yapıldı</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
