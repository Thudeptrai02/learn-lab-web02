// src/pages/api/grade-writing.js - BẢN FIX 2026 (Dùng Groq Llama 3.3)

export const POST = async ({ request }) => {
  try {
    const data = await request.json();
    const { studentAnswer, taskPrompt, partNumber } = data;

    // Lấy Key từ Groq (Đảm bảo sếp đã cấu hình biến GROQ_API_KEY trong .env)
    const API_KEY = import.meta.env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "Sếp chưa nạp GROQ_API_KEY rồi!" }), { status: 500 });
    }

    // DÙNG MODEL Llama 3.3 MỚI NHẤT (Thay cho bản 3.1 đã bị xóa)
    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
    const MODEL_NAME = "llama-3.3-70b-versatile"; 

    const systemPrompt = `
      You are a Cambridge English Examiner for A2 Key (KET). Grade this Part ${partNumber} writing task out of 15 total marks.
      
      SCORING CRITERIA (5 marks each):
      1. Content: Did they answer all prompts/pictures? (P6 email ~25 words, P7 story ~35 words).
      2. Organisation: Is it coherent? Used linking words (and, but, so, because)? Correct punctuation?
      3. Language: Everyday vocabulary? Accurate simple grammar (basic tenses)?
      
      Task: "${taskPrompt}"
      Student Answer: "${studentAnswer}"
      
      Respond STRICTLY in JSON:
      {
        "content": number,
        "organisation": number,
        "language": number,
        "feedback_vn": "Nhận xét tiếng Việt chi tiết dựa trên Checklist Cambridge.",
        "sample": "Bản viết mẫu đạt 15/15."
      }
    `;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.2,
        response_format: { type: "json_object" } 
      })
    });

    const result = await response.json();

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
    }

    return new Response(result.choices[0].message.content, { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Lỗi hệ thống: " + error.message }), { status: 500 });
  }
};