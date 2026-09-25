// Vercel entry point; logic lives in server/odeme.ts.
import { dogrula } from '../../server/odeme';

export const POST = (req: Request) => dogrula(req, process.env);
