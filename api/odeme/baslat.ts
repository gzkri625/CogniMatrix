// Vercel entry point; logic lives in server/odeme.ts.
import { baslat } from '../../server/odeme';

export const POST = (req: Request) => baslat(req, process.env);
