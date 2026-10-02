import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { fileToText, splitPII, roleFromFile } from '@/lib/extract';
import { scoreCandidate } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

// One CV per call: extract -> split personal details from content -> store -> score (both rubrics)
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File;
    const roleSel = String(form.get('role') || 'AUTO');
    if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });
    const text = await fileToText(Buffer.from(await file.arrayBuffer()), file.name);
    if (text.trim().length < 80) return NextResponse.json({ error: 'Could not read text from this PDF (unusual fonts or scanned). Re-save it via Print > Save as PDF, or upload a .txt/.docx version' }, { status: 422 });
    const role = roleSel === 'PM' || roleSel === 'SPM' ? roleSel : roleFromFile(file.name, text);
    const { personal, content } = splitPII(text, file.name);
    const { data, error } = await db().from('candidates')
      .insert({ file_name: file.name, role_applied: role, personal_details: personal, cv_content: content, status: 'new' })
      .select('id').single();
    if (error) throw new Error(error.message);
    try { await scoreCandidate(data.id, content); }
    catch (e: any) { await db().from('candidates').update({ error: e.message }).eq('id', data.id); return NextResponse.json({ ok: true, id: data.id, role, warning: 'Saved; scoring will retry: ' + e.message }); }
    return NextResponse.json({ ok: true, id: data.id, role });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
