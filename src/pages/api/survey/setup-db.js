export const prerender = false;

const SQL = `CREATE TABLE IF NOT EXISTS surveys (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  intro_text TEXT DEFAULT '',
  thank_you_text TEXT DEFAULT 'Cảm ơn bạn đã hoàn thành khảo sát!',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  construct TEXT DEFAULT '',
  construct_label TEXT DEFAULT '',
  variable_name TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'likert5',
  order_index INT NOT NULL DEFAULT 0,
  required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_spent_seconds INT DEFAULT NULL,
  is_auto_fill BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id BIGINT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  value TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON survey_answers(question_id);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_surveys" ON surveys;
CREATE POLICY "public_read_surveys" ON surveys FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "public_read_questions" ON survey_questions;
CREATE POLICY "public_read_questions" ON survey_questions FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "public_insert_responses" ON survey_responses;
CREATE POLICY "public_insert_responses" ON survey_responses FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "public_insert_answers" ON survey_answers;
CREATE POLICY "public_insert_answers" ON survey_answers FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "admin_all_surveys" ON surveys;
CREATE POLICY "admin_all_surveys" ON surveys FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "admin_all_questions" ON survey_questions;
CREATE POLICY "admin_all_questions" ON survey_questions FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "admin_all_responses" ON survey_responses;
CREATE POLICY "admin_all_responses" ON survey_responses FOR ALL USING (TRUE);

DROP POLICY IF EXISTS "admin_all_answers" ON survey_answers;
CREATE POLICY "admin_all_answers" ON survey_answers FOR ALL USING (TRUE);`;

export const GET = async () => {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase/)[1];
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

  // Try Management API
  let apiResult = null;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query: SQL })
    });
    if (res.ok) {
      apiResult = { success: true, message: '✅ Database setup complete!' };
    } else {
      const errText = await res.text();
      apiResult = { success: false, message: `API error ${res.status}`, detail: errText.slice(0, 300) };
    }
  } catch (e) {
    apiResult = { success: false, message: e.message };
  }

  return new Response(JSON.stringify({
    apiResult,
    sqlEditorUrl,
    sql: SQL,
    hint: 'Nếu API không hoạt động, click link SQL Editor → paste code → Run.'
  }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST = async () => GET();
