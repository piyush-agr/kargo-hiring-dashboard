const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function gemini(prompt: string, retries = 6): Promise<any> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  let lastErr = '';
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      lastErr = `Gemini ${res.status}`;
      await sleep(4000 + i * 4000);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    const text = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    try {
      return JSON.parse(text.replace(/^```json|```$/g, '').trim());
    } catch {
      lastErr = 'Gemini returned invalid JSON';
      await sleep(1500);
    }
  }
  throw new Error(lastErr || 'Gemini failed');
}
