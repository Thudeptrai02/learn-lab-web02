-- ====== LEARNLAB SURVEY ENGINE ======
-- Run this SQL in Supabase SQL Editor (https://supabase.com/dashboard/project/mfpnkzjwsjpthtygzmee/sql)

-- 1. Surveys
create table if not exists surveys (
  id bigint generated always as identity primary key,
  slug text unique not null,
  title text not null,
  description text default '',
  intro_text text default '',
  thank_you_text text default 'Cảm ơn bạn đã hoàn thành khảo sát!',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Questions
create table if not exists survey_questions (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  construct text default '',
  construct_label text default '',
  variable_name text not null,
  question_text text not null,
  question_type text default 'likert5',
  order_index int not null default 0,
  required boolean default true,
  created_at timestamptz default now()
);

-- 3. Responses
create table if not exists survey_responses (
  id bigint generated always as identity primary key,
  survey_id bigint not null references surveys(id) on delete cascade,
  respondent_id text default '',
  submitted_at timestamptz not null default now(),
  time_spent_seconds int default null,
  is_auto_fill boolean default false,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 4. Answers
create table if not exists survey_answers (
  id bigint generated always as identity primary key,
  response_id bigint not null references survey_responses(id) on delete cascade,
  question_id bigint not null references survey_questions(id) on delete cascade,
  value text not null default ''
);

-- Indexes
create index if not exists idx_survey_questions_survey on survey_questions(survey_id);
create index if not exists idx_survey_responses_survey on survey_responses(survey_id);
create index if not exists idx_survey_answers_response on survey_answers(response_id);
create index if not exists idx_survey_answers_question on survey_answers(question_id);

-- Enable RLS but allow public read + anon insert
alter table surveys enable row level security;
alter table survey_questions enable row level security;
alter table survey_responses enable row level security;
alter table survey_answers enable row level security;

-- Public policies: anyone can read active surveys and questions
drop policy if exists "public_read_surveys" on surveys;
create policy "public_read_surveys" on surveys for select using (is_active = true);

drop policy if exists "public_read_questions" on survey_questions;
create policy "public_read_questions" on survey_questions for select using (true);

-- Allow anonymous users to insert responses
drop policy if exists "public_insert_responses" on survey_responses;
create policy "public_insert_responses" on survey_responses for insert with check (true);

drop policy if exists "public_insert_answers" on survey_answers;
create policy "public_insert_answers" on survey_answers for insert with check (true);

-- Admin can do everything
drop policy if exists "admin_all_surveys" on surveys;
create policy "admin_all_surveys" on surveys for all using (true);

drop policy if exists "admin_all_questions" on survey_questions;
create policy "admin_all_questions" on survey_questions for all using (true);

drop policy if exists "admin_all_responses" on survey_responses;
create policy "admin_all_responses" on survey_responses for all using (true);

drop policy if exists "admin_all_answers" on survey_answers;
create policy "admin_all_answers" on survey_answers for all using (true);
