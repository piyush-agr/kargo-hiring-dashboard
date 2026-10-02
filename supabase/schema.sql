-- Run this whole file once in Supabase > SQL Editor.
create table if not exists rubric_criteria (
  id serial primary key,
  role text not null check (role in ('PM','SPM')),
  position int not null,
  name text not null,
  description text not null,
  weight int not null
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  role_applied text not null check (role_applied in ('PM','SPM')),
  personal_details jsonb not null,          -- {name,email,phone} - never sent to AI
  cv_content text not null,                 -- redacted: no name/email/phone
  scores jsonb,                             -- {PM:{total,criteria:[...]},SPM:{...}}
  score_pm numeric, score_spm numeric,
  brief text,
  email_type text,                          -- 'invite' | 'rejection'
  email_subject text,
  email_body text,                          -- contains {{NAME}} placeholder
  status text not null default 'new',       -- new | scored | drafted | sent
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);
alter table rubric_criteria enable row level security;
alter table candidates enable row level security;   -- no policies: only the service-role key can read/write

delete from rubric_criteria;
insert into rubric_criteria (role, position, name, description, weight) values
('PM',1,'Ground-level freight exposure','Strong: CV shows the person personally worked inside freight, port, 3PL, customs or carrier operations (e.g. handled shipments, documentation, carrier allocation, customer escalations) BEFORE or alongside product work, with specifics of what they saw break. Weak: logistics appears only as an industry they built software for from a desk, or not at all (e-commerce, fintech, HR tech, consulting).',25),
('PM',2,'Self-started fixes others adopted','Strong: names a specific broken process or gap they noticed without being asked, built the fix themselves (prototype, tracker, framework, SOP, dashboard) and states that colleagues or teams adopted it. Weak: only lists assigned deliverables, features shipped from a backlog, or tools used.',25),
('PM',3,'Owned the call, no layer above','Strong: explicitly sole owner of a product area or function, decisions made without a manager approving them, with a named consequence they lived with. Weak: supported senior people, part of a large team, strategy or advisory without delivery.',20),
('PM',4,'Learning from failure on record','Strong: documents something that failed or was killed (feature removed for low adoption, lost deal post-mortem, outage post-mortem) and what changed afterwards. Weak: only success stories, no failure or reversal mentioned.',15),
('PM',5,'Measured results','Strong: concrete before/after numbers tied to their own action (percent reduced, days saved, adoption). Weak: vague claims, responsibilities listed without outcomes.',15),
('SPM',1,'Ground-level freight exposure','Strong: multiple years of first-hand operations work in freight, port, 3PL, customs or carrier environments, with specific examples of operational pain they dealt with directly, and that experience visibly shaped later product decisions. Weak: domain knowledge from advising or building software from outside.',20),
('SPM',2,'Self-started fixes others adopted','Strong: several examples of unprompted fixes they designed and built that spread beyond their own team (adopted org-wide, became standard practice), including at least one that scaled past the original scope. Weak: one small example or none; only assigned work.',20),
('SPM',3,'Owned the call, no layer above','Strong: multi-year track record as the senior-most decision-maker on a product or platform area with no PM manager above, owning outcomes end to end through launch AND consequences. Weak: strategy, oversight, or advisory roles; has never carried a product through delivery.',30),
('SPM',4,'Learning from failure on record','Strong: more than one documented reversal, killed bet, or post-mortem, with a process or practice they changed so it would not repeat. Weak: no failures mentioned, or blame placed elsewhere.',15),
('SPM',5,'Measured results','Strong: multiple concrete, attributable numbers across roles showing sustained impact on the business or customers. Weak: vague or only one metric.',15);
