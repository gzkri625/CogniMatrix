import { qtyLabel, qtyStep } from '../format';
import type { Unit } from '../types';

export default function QtyControl({ qty, unit, onChange }: { qty: number; unit: Unit; onChange: (q: number) => void }) {
  const step = qtyStep(unit);
  return (
    <div className="qty">
      <button aria-label="Azalt" onClick={() => onChange(qty - step)}>−</button>
      <span>{qtyLabel(qty, unit)}</span>
      <button aria-label="Arttır" onClick={() => onChange(qty + step)}>+</button>
    </div>
  );
}
