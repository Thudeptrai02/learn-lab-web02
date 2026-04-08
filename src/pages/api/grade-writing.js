export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const { userText, partName } = await request.json();
    const apiKey = import.meta.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Chưa có API Key trong file .env");
    }

    const prompt = `
    Bạn là giám khảo Cambridge A2 Key. Hãy chấm bài Writing: ${partName}.
    Bài làm: "${userText}"
    
    Chấm trên 3 tiêu chí (tối đa 5đ/tiêu chí):
    1. Content: Đủ ý, đủ 25-35 từ chưa?
    2. Organisation: Có từ nối (and, but, so, because) không?
    3. Language: Ngữ pháp và từ vựng cơ bản ổn không?

    Trả về đúng 1 khối JSON duy nhất:
    {"content": số, "organisation": số, "language": số, "feedback": "nhận xét tiếng Việt"}
    `;

    // SỬA TÊN MODEL: Chuyển từ 2.5-flash sang 1.5-flash để ổn định hơn
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.2, 
          response_mime_type: "application/json" 
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const aiText = data.candidates[0].content.parts[0].text;
    const finalObject = JSON.parse(aiText);

    return new Response(JSON.stringify(finalObject), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      content: 0, organisation: 0, language: 0,
      feedback: `AI đang bận: ${error.message}. Vui lòng thử lại sau vài giây.`
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};