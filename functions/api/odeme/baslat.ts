// Cloudflare Pages Functions entry point; logic lives in server/odeme.ts.
import type { Env } from '../../../server/env';
import { baslat } from '../../../server/odeme';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => baslat(request, env);
