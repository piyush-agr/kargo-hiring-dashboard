import { NextResponse } from 'next/server';
import { finalize } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST() {
  try { return NextResponse.json(await finalize(4)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
