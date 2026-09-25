import { demoBackend } from './demo';
import { createSupabaseBackend } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backend = url && key ? createSupabaseBackend(url, key) : demoBackend;
export type { Backend } from './types';
