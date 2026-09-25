// Cloudflare Pages Functions entry point; logic lives in server/odeme.ts.
import type { Env } from '../../../server/env';
import { dogrula } from '../../../server/odeme';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => dogrula(request, env);
