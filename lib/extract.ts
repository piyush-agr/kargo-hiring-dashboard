import { extractText, getDocumentProxy } from 'unpdf';

export async function fileToText(buf: Buffer, name: string): Promise<string> {
  if (/\.txt$/i.test(name)) return buf.toString('utf8');
  if (/\.docx$/i.test(name)) {
    const mammoth: any = await import('mammoth');
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;

function nameFromFile(file: string) {
  const base = file.replace(/\.[^.]+$/, '').replace(/^(cv_)?(spm_|pm_)?\d+_/i, '').replace(/^(cv_|spm_|pm_)/i, '');
  return base.split(/[_\s-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function roleFromFile(file: string, text: string): 'PM' | 'SPM' {
  if (/^spm_/i.test(file)) return 'SPM';
  if (/^pm_/i.test(file)) return 'PM';
  if (/senior product manager|sr\.? product manager|principal product|group product|head of product|director|vp product/i.test(text)) return 'SPM';
  const m = text.match(/(\d{1,2})\+?\s*(?:years|yrs)/i);
  return m && parseInt(m[1]) >= 6 ? 'SPM' : 'PM';
}

/** Splits personal details (kept private, never sent to AI) from CV content (redacted). */
export function splitPII(text: string, fileName: string) {
  const email = (text.match(EMAIL)?.[0] || '').replace(/^[A-Z]+(?=[a-z0-9._])/, '');
  const phoneRaw = text.match(PHONE)?.[0] || '';
  const phone = phoneRaw.replace(/\s+/g, ' ').trim();
  let name = nameFromFile(fileName);
  if (!name || name.length < 3) {
    const first = text.split('\n').map((l) => l.trim()).find((l) => /^[A-Za-z .'-]{3,40}$/.test(l));
    name = first || 'Candidate';
  }

  let c = text;
  c = c.replace(new RegExp(EMAIL.source, 'g'), ' ');
  c = c.replace(/https?:\/\/\S+|(?:www\.)?(?:linkedin|github|behance|flowcv|figma|tinyurl|leetcode)\.[a-z.]+\/?\S*/gi, ' ');
  c = c.replace(/\+?\d[\d\s-]{8,}\d/g, ' ');              // any long digit run (phones, incl. doubled layers)
  const head = c.slice(0, 700).replace(/\b[6-9]\d{4}\b|\b\d{5}\b/g, ' '); // leftover 5-digit phone halves in header
  c = head + c.slice(700);
  // name tokens (also catches "ISHAANRoy" style fused layers)
  const tokens = name.split(' ').filter((t) => t.length >= 3);
  for (const t of tokens) c = c.replace(new RegExp(t, 'gi'), ' ');
  c = c.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return { personal: { name, email, phone }, content: c };
}
