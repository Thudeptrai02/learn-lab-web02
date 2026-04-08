export const prerender = false;
export const POST = async ({ request }) => {
  try {
    const { userText, partName } = await request.json();
    const apiKey = import.meta.env.GEMINI_API_KEY;

    const prompt = `Bạn là giám khảo Cambridge A2 Key. Chấm bài Writing ${partName}: "${userText}". 
    Tiêu chí (mỗi cái 5đ): 1.Content, 2.Organisation, 3.Language. 
    Trả về JSON: {"content":số, "organisation":số, "language":số, "feedback":"tiếng Việt"}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json" } })
    });

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ feedback: "Lỗi kết nối AI." }), { status: 500 });
  }
};