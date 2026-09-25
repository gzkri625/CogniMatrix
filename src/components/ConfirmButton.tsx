import { useEffect, useState, type ReactNode } from 'react';

/** Two-step confirm inside the page (first click arms, second click runs). */
export default function ConfirmButton({ children, confirmText, onConfirm, className = 'link' }: {
  children: ReactNode;
  confirmText: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmText : children}
    </button>
  );
}
