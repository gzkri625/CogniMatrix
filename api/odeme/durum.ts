// GET /api/odeme/durum — lets the storefront know whether online card
// payment is available (iyzico + database configured) and whether it is in test mode.
import { dbConfigured } from '../_lib/db';
import { isConfigured, isSandbox, json } from '../_lib/iyzico';

export function GET() {
  return json({ aktif: isConfigured() && dbConfigured(), test: isSandbox() });
}
