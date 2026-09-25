// Vercel entry point; logic lives in server/odeme.ts.
import { durum } from '../../server/odeme';

export const GET = () => durum(process.env);
