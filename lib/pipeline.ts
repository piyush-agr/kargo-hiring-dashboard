import { db } from './supabase';
import { gemini } from './gemini';

export type Criterion = { id: number; role: 'PM' | 'SPM'; position: number; name: string; description: string; weight: number };

export async function getRubric(): Promise<{ PM: Criterion[]; SPM: Criterion[] }> {
  const { data, error } = await db().from('rubric_criteria').select('*').order('position');
  if (error) throw new Error(error.message);
  return { PM: data.filter((r: any) => r.role === 'PM'), SPM: data.filter((r: any) => r.role === 'SPM') };
}

const fmt = (cs: Criterion[]) =>
  cs.map((c, i) => `${i + 1}. ${c.name} (weight ${c.weight}%): ${c.description}`).join('\n');

export async function scoreCandidate(id: string, content: string) {
  const rubric = await getRubric();
  const prompt = `You are scoring an anonymised CV against a hiring rubric for Kargo, a logistics SaaS startup. The rubric comes from patterns in Kargo's best past hires, not from a job description.
Score ONLY on evidence written in the CV. If there is no evidence for a criterion, give 0-2. Be strict and consistent: 9-10 only when the CV matches the "Strong" description with specifics.
Each reason must be ONE short sentence citing the actual evidence (or its absence).

PM RUBRIC:
${fmt(rubric.PM)}

SPM RUBRIC:
${fmt(rubric.SPM)}

CV (anonymised):
"""
${content.slice(0, 12000)}
"""

Return JSON exactly: {"PM":[{"score":0-10,"reason":"..."}, ... one per PM criterion in order],"SPM":[{"score":0-10,"reason":"..."}, ... one per SPM criterion in order]}`;
  const out = await gemini(prompt);
  const scores: any = {};
  for (const role of ['PM', 'SPM'] as const) {
    const cs = rubric[role];
    const arr = out[role] || [];
    const criteria = cs.map((c, i) => {
      const s = Math.max(0, Math.min(10, Number(arr[i]?.score) || 0));
      return { name: c.name, weight: c.weight, score: s, reason: String(arr[i]?.reason || '') };
    });
    const total = Math.round(criteria.reduce((a, c) => a + c.score * c.weight, 0) / 10);
    scores[role] = { total, criteria };
  }
  const { error } = await db()
    .from('candidates')
    .update({ scores, score_pm: scores.PM.total, score_spm: scores.SPM.total, status: 'scored', error: null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

const SIGN = 'Arjun Mehta, Founder, Kargo (Mumbai)';

async function draft(c: any, invite: boolean) {
  const s = c.scores[c.role_applied];
  const evidence = s.criteria.map((x: any) => `- ${x.name} (${x.score}/10): ${x.reason}`).join('\n');
  const prompt = invite
    ? `Kargo is a Series A logistics SaaS in Mumbai hiring a ${c.role_applied === 'SPM' ? 'Senior Product Manager' : 'Product Manager'}. This candidate ranked in the top group. Anonymised CV and score evidence below. The candidate's name is NOT known to you: write the placeholder {{NAME}} wherever the first name should go.

CV:
"""${c.cv_content.slice(0, 6000)}"""
Score evidence (${s.total}/100):
${evidence}

Return JSON: {"brief":"EXACTLY three sentences for the founder: (1) why this person ranks here, (2) their strongest evidence, (3) what to probe in the interview.","subject":"short email subject","body":"warm, concise interview-invite email from Arjun (4-6 sentences) that references one specific thing from their CV, proposes a 30-minute chat this/next week, starts with 'Hi {{NAME}},' and ends with the sign-off '${SIGN}'"}`
    : `Kargo is a Series A logistics SaaS in Mumbai. This candidate applied for ${c.role_applied === 'SPM' ? 'Senior Product Manager' : 'Product Manager'} and was not taken forward for an interview at this stage. The candidate's name is NOT known to you: use the placeholder {{NAME}}.

CV:
"""${c.cv_content.slice(0, 4000)}"""

Return JSON: {"subject":"short email subject","body":"warm, honest rejection email from Arjun (4-5 sentences): thank them, acknowledge one specific genuine strength from their CV, say we are not moving forward for this role right now, no false promises, no reasons that criticise them, starts with 'Hi {{NAME}},' and ends with the sign-off '${SIGN}'"}`;
  const out = await gemini(prompt);
  return {
    brief: invite ? String(out.brief || '') : null,
    email_type: invite ? 'invite' : 'rejection',
    email_subject: String(out.subject || (invite ? 'Kargo: let us talk' : 'Your application to Kargo')),
    email_body: String(out.body || ''),
    status: 'drafted',
  };
}

/** Scores unscored candidates, then ranks per role and drafts briefs/emails where missing or tier changed.
 *  Processes at most `limit` AI jobs per call; returns how many remain. */
export async function finalize(limit = 4) {
  const topN = parseInt(process.env.TOP_N || '5');
  let done = 0;

  // 1) any candidates still unscored
  const { data: unscored } = await db().from('candidates').select('id,cv_content').eq('status', 'new').limit(limit);
  for (const u of unscored || []) {
    try { await scoreCandidate(u.id, u.cv_content); } catch (e: any) { await db().from('candidates').update({ error: e.message }).eq('id', u.id); }
    done++;
  }
  if (done >= limit) return { remaining: await pending() };

  // 2) rank and draft
  const { data: all } = await db().from('candidates').select('*').neq('status', 'new');
  for (const role of ['PM', 'SPM']) {
    const list = (all || []).filter((c: any) => c.role_applied === role && c.scores)
      .sort((a: any, b: any) => b.scores[role].total - a.scores[role].total);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.status === 'sent' || done >= limit) continue;
      const invite = i < topN;
      const want = invite ? 'invite' : 'rejection';
      if (c.email_type === want && c.email_body && (!invite || c.brief)) continue;
      try {
        const d = await draft(c, invite);
        await db().from('candidates').update({ ...d, error: null }).eq('id', c.id);
      } catch (e: any) { await db().from('candidates').update({ error: e.message }).eq('id', c.id); }
      done++;
    }
  }
  return { remaining: await pending() };
}

export async function pending() {
  const topN = parseInt(process.env.TOP_N || '5');
  const { data: all } = await db().from('candidates').select('id,role_applied,scores,status,email_type,email_body,brief,error');
  let n = (all || []).filter((c: any) => c.status === 'new').length;
  for (const role of ['PM', 'SPM']) {
    const list = (all || []).filter((c: any) => c.role_applied === role && c.scores)
      .sort((a: any, b: any) => b.scores[role].total - a.scores[role].total);
    list.forEach((c: any, i: number) => {
      if (c.status === 'sent') return;
      const want = i < topN ? 'invite' : 'rejection';
      if (!(c.email_type === want && c.email_body && (want === 'rejection' || c.brief))) n++;
    });
  }
  return n;
}
