-- Tạo bảng surveys
CREATE TABLE IF NOT EXISTS surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Khảo sát mới',
  description TEXT DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tạo bảng responses
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_info TEXT DEFAULT '',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index cho truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);

-- Row Level Security
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Cho phép anon key truy cập (API endpoints dùng service_role nên không cần policy,
-- nhưng để anon có thể select/insert vào survey_responses cho public form)
CREATE POLICY "anon_select_surveys" ON surveys FOR SELECT USING (true);
CREATE POLICY "anon_insert_responses" ON survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_responses" ON survey_responses FOR SELECT USING (true);

-- Function để tạo bảng từ setup API
CREATE OR REPLACE FUNCTION setup_survey_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  CREATE TABLE IF NOT EXISTS surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Khảo sát mới',
    description TEXT DEFAULT '',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    respondent_info TEXT DEFAULT '',
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);

  ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "anon_select_surveys" ON surveys;
  CREATE POLICY "anon_select_surveys" ON surveys FOR SELECT USING (true);

  DROP POLICY IF EXISTS "anon_insert_responses" ON survey_responses;
  CREATE POLICY "anon_insert_responses" ON survey_responses FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "anon_select_responses" ON survey_responses;
  CREATE POLICY "anon_select_responses" ON survey_responses FOR SELECT USING (true);
END;
$$;
