// src/pages/api/grade-writing.js - Bản Siêu Bền (Fix lỗi 500 & Model Not Found)

export const POST = async ({ request }) => {
  try {
    const data = await request.json();
    const { studentAnswer, taskPrompt, partNumber } = data;
    const API_KEY = import.meta.env.GEMINI_API_KEY;

    if (!API_KEY) {
      console.error("❌ THIẾU API KEY: Sếp kiểm tra lại file .env nhé!");
      return new Response(JSON.stringify({ error: "Chưa cấu hình API Key!" }), { status: 500 });
    }

    // Dùng v1 và gemini-pro để đảm bảo ĐỘ ỔN ĐỊNH CAO NHẤT
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;

    const systemPrompt = `
      You are a Cambridge English Examiner for A2 Key (KET). 
      Grade this Writing Part ${partNumber} out of 15 marks.
      
      CRITERIA (0-5 marks each):
      1. Content: Did they answer all 3 prompts?
      2. Organisation: Linking words (and, but, so, because)?
      3. Language: Simple grammar accuracy?
      
      Task: "${taskPrompt}"
      Student Answer: "${studentAnswer}"
      
      Respond ONLY in this JSON format:
      {
        "content": number,
        "organisation": number,
        "language": number,
        "feedback_vn": "Nhận xét chi tiết bằng tiếng Việt",
        "sample": "Bản mẫu 15/15"
      }
    `;

    console.log("🚀 Đang gọi Google AI chấm bài...");

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    const result = await response.json();

    // 1. Kiểm tra nếu Google báo lỗi API
    if (result.error) {
      console.error("❌ LỖI GOOGLE:", result.error.message);
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500 });
    }

    // 2. Kiểm tra nếu AI chặn nội dung (Safety Filters)
    if (!result.candidates || result.candidates.length === 0) {
      console.error("⚠️ AI chặn bài viết này vì lý do an toàn.");
      return new Response(JSON.stringify({ error: "AI từ chối chấm bài này, sếp viết lại tử tế xem!" }), { status: 500 });
    }

    const aiText = result.candidates[0].content.parts[0].text;
    
    // 3. Trích xuất JSON (đề phòng AI trả về text thừa)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ AI không trả về JSON chuẩn:", aiText);
      throw new Error("Dữ liệu AI trả về bị lỗi format.");
    }

    console.log("✅ Chấm điểm thành công!");
    return new Response(jsonMatch[0], { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error("❌ LỖI HỆ THỐNG:", error.message);
    return new Response(JSON.stringify({ error: "Lỗi hệ thống: " + error.message }), { status: 500 });
  }
};