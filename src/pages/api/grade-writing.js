export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const { userText, partName } = await request.json();
    const apiKey = import.meta.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Chưa có API Key. Kiểm tra lại file .env");
    }

    const prompt = `
    Bạn là giám khảo Cambridge A2 Key. Học viên vừa nộp bài cho phần: ${partName}.
    Bài làm của học viên:
    """
    ${userText}
    """
    Hãy chấm bài dựa trên 3 tiêu chí cốt lõi (Mỗi tiêu chí tối đa 5 điểm):
    1. Content (Nội dung): Đủ ý chưa? Đủ số từ (25-35 từ) không?
    2. Organisation (Bố cục): Có mạch lạc không? Có dùng từ nối (and, but, so, because) không?
    3. Language (Ngôn từ): Từ vựng/ngữ pháp cơ bản đúng không?
    QUAN TRỌNG: Mày CHỈ ĐƯỢC PHÉP trả về 1 khối JSON. TUYỆT ĐỐI KHÔNG giải thích ngoài lề.
    Định dạng bắt buộc:
    {"content": điểm_số,"organisation": điểm_số,"language": điểm_số,"feedback": "Nhận xét chi tiết tiếng Việt, chỉ rõ lỗi."}
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates) throw new Error("Google chặn nội dung.");

    const aiText = data.candidates[0].content.parts[0].text;
    const finalObject = JSON.parse(aiText);

    return new Response(JSON.stringify(finalObject), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("❌ LỖI API CHẤM BÀI:", error.message);
    return new Response(JSON.stringify({
      content: 0, organisation: 0, language: 0,
      feedback: `Lỗi kết nối AI: ${error.message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};