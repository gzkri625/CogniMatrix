// Cloudflare Pages Functions entry point; logic lives in server/odeme.ts.
import type { Env } from '../../../server/env';
import { sonuc } from '../../../server/odeme';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => sonuc(request, env);
