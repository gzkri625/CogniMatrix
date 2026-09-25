// GET /api/odeme/durum — lets the storefront know whether online card
// payment is available (keys configured) and whether it is in test mode.
import { isConfigured, isSandbox, json } from '../_lib/iyzico';

export function GET() {
  return json({ aktif: isConfigured(), test: isSandbox() });
}
