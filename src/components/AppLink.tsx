import type { AnchorHTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// Embedded previews (sandboxed iframes on about:srcdoc / blob: URLs) have no
// usable URL, so the app runs on an in-memory router there, and links are
// drawn without href so the host page can't hijack them as navigation.
export const EMBEDDED = import.meta.env.VITE_PREVIEW === '1' || !/^https?:$/.test(window.location.protocol);

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export default function AppLink({ to, onClick, ...rest }: Props) {
  const navigate = useNavigate();
  if (!EMBEDDED) return <Link to={to} onClick={onClick} {...rest} />;
  const go = (e: MouseEvent<HTMLAnchorElement> | KeyboardEvent<HTMLAnchorElement>) => {
    onClick?.(e as MouseEvent<HTMLAnchorElement>);
    if (e.defaultPrevented) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a
      role="link"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onClick={go}
      onKeyDown={(e) => e.key === 'Enter' && go(e)}
      {...rest}
    />
  );
}
