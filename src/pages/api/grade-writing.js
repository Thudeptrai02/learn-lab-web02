// src/pages/api/grade-writing.js
// Part 6 (Email) → DeepSeek (text)
// Part 7 (Story) → DeepSeek với Picture_Story context từ JSON

async function gradeWithDeepSeek(studentAnswer, taskPrompt, partNumber, pictureStory) {
  const API_KEY = import.meta.env.DEEPSEEK_API_KEY || "sk-687993c8495a449c86653a91c44f5828";
  const partLabel = partNumber === 6 ? "Email" : "Story";
  const wordReq = partNumber === 6 ? "25 words" : "35 words";

  let contentCheck = partNumber === 6
    ? "Check: Did they answer all 3 questions from the email prompt?"
    : "Check: Does the student's story cover the key events described below?";

  let extraContext = "";
  if (pictureStory) {
    extraContext = `
Expected story: "${pictureStory.full_story || ""}"
Key actions to cover: ${(pictureStory.key_actions || []).join(" → ")}
Grammar focus: ${pictureStory.grammar_focus || "past simple tense"}
Minimum words: ${pictureStory.min_words || 35}`;
  }

  const prompt = `You are a Cambridge English Examiner for A2 Key (KET). Grade this Part ${partNumber} (${partLabel}) writing task.

CAMBRIDGE A2 KEY WRITING RUBRIC (15 marks total, 5 per criterion):

1. CONTENT (0-5):
   5 = All content elements covered, target reader fully informed
   4 = All covered, some could be more developed
   3 = Main elements covered, one less successful
   2 = Two elements covered
   1 = One element covered
   0 = No relevant content
   ${contentCheck}

2. ORGANISATION (0-5):
   5 = Well-organised, coherent, range of cohesive devices
   4 = Well-organised with some linking
   3 = Generally well-organised with basic linking (and, but, so, because)
   2 = Connected but not always logical
   1 = Not well-organised
   0 = No organisation

3. LANGUAGE (0-5):
   5 = Good range of vocabulary + simple grammar, few errors
   4 = Adequate range, some errors but meaning clear
   3 = Sufficient range for task, errors don't impede communication
   2 = Limited range, frequent errors
   1 = Very limited range
   0 = No language evident

Word count requirement: ~${wordReq}

Task: "${taskPrompt}"${extraContext}
Student Answer: "${studentAnswer}"

Respond STRICTLY in this JSON format (no markdown, no code fences):
{
  "content": number,
  "organisation": number,
  "language": number,
  "feedback_vn": "Nhận xét chi tiết bằng tiếng Việt.",
  "sample": "Bài viết mẫu đạt 15/15."
}`;

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  const result = await res.json();
  if (result.error) throw new Error(result.error.message);

  const raw = result.choices[0].message.content;
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { content: 0, organisation: 0, language: 0, feedback_vn: "Lỗi parse JSON từ DeepSeek.", sample: "" };
  }
}

export const POST = async ({ request }) => {
  try {
    const { studentAnswer, taskPrompt, partNumber, pictureStory } = await request.json();

    const parsed = await gradeWithDeepSeek(studentAnswer, taskPrompt, partNumber, pictureStory);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Lỗi hệ thống: " + error.message }), { status: 500 });
  }
};