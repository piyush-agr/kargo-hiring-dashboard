import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const runtime = 'nodejs';

// Only ever called by the founder clicking Confirm. Nothing is auto-sent.
export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const { data: c, error } = await db().from('candidates').select('*').eq('id', id).single();
    if (error || !c) throw new Error('Candidate not found');
    if (c.status === 'sent') return NextResponse.json({ ok: true, already: true });
    if (!c.email_body) throw new Error('No draft email yet');
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    const first = (c.personal_details.name || '').split(' ')[0];
    const to = process.env.RESEND_TEST_TO || c.personal_details.email;
    const body = c.email_body.replaceAll('{{NAME}}', first);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Kargo Hiring <onboarding@resend.dev>',
        to: [to],
        subject: c.email_subject,
        text: body,
      }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.message || 'Resend error ' + res.status);
    await db().from('candidates').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ok: true, to });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
