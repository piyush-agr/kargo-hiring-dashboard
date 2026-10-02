import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { pending } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await db().from('candidates')
    .select('id,file_name,role_applied,personal_details,scores,score_pm,score_spm,brief,email_type,email_subject,email_body,status,error,sent_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const out = data.map((c: any) => ({
    ...c,
    name: c.personal_details?.name,
    email: c.personal_details?.email,
    personal_details: undefined,
    email_body: c.email_body?.replaceAll('{{NAME}}', (c.personal_details?.name || '').split(' ')[0]),
  }));
  return NextResponse.json({ candidates: out, pending: await pending(), topN: parseInt(process.env.TOP_N || '5') });
}
