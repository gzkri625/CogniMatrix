// Minimal iyzico REST client (IYZWSv2 auth). Server-side only: the secret key
// must never reach the browser.
import { createHmac, randomBytes } from 'node:crypto';

const SANDBOX = 'https://sandbox-api.iyzipay.com';

export const config = () => ({
  apiKey: process.env.IYZICO_API_KEY ?? '',
  secretKey: process.env.IYZICO_SECRET_KEY ?? '',
  baseUrl: (process.env.IYZICO_BASE_URL ?? SANDBOX).replace(/\/$/, ''),
});

export const isConfigured = () => {
  const c = config();
  return Boolean(c.apiKey && c.secretKey);
};

export const isSandbox = () => config().baseUrl.includes('sandbox');

export interface IyzicoResponse {
  status: 'success' | 'failure';
  errorCode?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export function authHeader(apiKey: string, secretKey: string, path: string, body: string, rnd: string) {
  const signature = createHmac('sha256', secretKey).update(rnd + path + body).digest('hex');
  const params = `apiKey:${apiKey}&randomKey:${rnd}&signature:${signature}`;
  return `IYZWSv2 ${Buffer.from(params).toString('base64')}`;
}

export async function iyzicoPost(path: string, payload: object): Promise<IyzicoResponse> {
  const { apiKey, secretKey, baseUrl } = config();
  const body = JSON.stringify(payload);
  const rnd = Date.now().toString() + randomBytes(4).toString('hex');
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-iyzi-rnd': rnd,
      Authorization: authHeader(apiKey, secretKey, path, body, rnd),
    },
    body,
  });
  return (await res.json()) as IyzicoResponse;
}

/** iyzico expects prices as strings like "12.5" / "100.0". */
export const fmtPrice = (n: number) => {
  const s = (Math.round(n * 100) / 100).toString();
  return s.includes('.') ? s : `${s}.0`;
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
