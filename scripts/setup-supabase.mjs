import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase/)[1];

  // Try RPC
  try {
    const { data, error } = await supabase.rpc('setup_survey_tables');
    if (!error) { console.log('RPC OK'); return; }
    console.log('RPC failed:', error.message);
  } catch(e) { console.log('RPC error:', e.message); }

  // Try Management API
  try {
    const sql = `
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
      CREATE OR REPLACE FUNCTION setup_survey_tables()
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
      BEGIN
        CREATE TABLE IF NOT EXISTS surveys (...);
        CREATE TABLE IF NOT EXISTS survey_responses (...);
      END; $$;
    `;

    const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql })
    });
    const text = await r.text();
    console.log(`Management API: ${r.status}`);
    if (r.ok) console.log('OK:', text?.slice(0, 200));
    else console.log('Error:', text?.slice(0, 500));
  } catch(e) {
    console.log('Management API failed:', e.message);
  }
}

main().catch(console.error);
