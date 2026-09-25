/** Server settings, passed in from the platform (process.env on Vercel, context.env on Cloudflare). */
export type Env = Partial<Record<
  | 'IYZICO_API_KEY'
  | 'IYZICO_SECRET_KEY'
  | 'IYZICO_BASE_URL'
  | 'SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'PUBLIC_URL',
  string
>>;
