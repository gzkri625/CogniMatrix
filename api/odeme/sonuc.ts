// Vercel entry point; logic lives in server/odeme.ts.
import { sonuc } from '../../server/odeme';

export const POST = (req: Request) => sonuc(req, process.env);
