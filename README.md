# Kargo Hiring Dashboard (Case 2)
Upload CV -> split personal details (code, never sent to AI) -> score vs PM + SPM rubric (Gemini) -> rank -> interview brief + draft email -> founder clicks Confirm -> Resend.

## Setup
1. Supabase: SQL Editor -> run `supabase/schema.sql` (creates tables + seeds the rubric).
2. Copy `.env.example` to `.env.local` (locally) / add the same variables in Vercel.
3. `npm install && npm run dev`  (or deploy to Vercel).

Stack: Next.js, Supabase, Gemini Flash(-Lite), Resend, Vercel.
