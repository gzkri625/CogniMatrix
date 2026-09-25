// Cloudflare Pages Functions entry point; logic lives in server/odeme.ts.
import type { Env } from '../../../server/env';
import { durum } from '../../../server/odeme';

export const onRequestGet = ({ env }: { env: Env }) => durum(env);
