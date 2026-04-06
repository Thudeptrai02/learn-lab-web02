export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const { word, jobTitle, careerGoal, interests } = await request.json();
    const apiKey = import.meta.env.GEMINI_API_KEY;

    const prompt = `Viết 1 câu ví dụ tiếng Anh thực tế với từ "${word}" dành riêng cho một người làm nghề ${jobTitle}. Mục tiêu: ${careerGoal}. Sở thích: ${interests}.
    QUAN TRỌNG: Mày CHỈ ĐƯỢC PHÉP trả về đúng 1 khối JSON. TUYỆT ĐỐI KHÔNG thêm bất kỳ một chữ nào khác (không giải thích, không xin chào).
    Định dạng bắt buộc: {"en": "câu tiếng Anh", "vi": "câu dịch tiếng Việt"}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    
    // 🕵️‍♂️ MÁY NGHE LÉN: In toàn bộ thư phản hồi của Google ra Terminal
    console.log("🕵️‍♂️ TÌNH BÁO TỪ GOOGLE:\n", JSON.stringify(data, null, 2));

    // Nếu Google báo lỗi (như sai API Key, hết hạn mức...)
    if (data.error) {
      throw new Error(`Google từ chối: ${data.error.message}`);
    }

    // Nếu Google không trả về candidates (Có thể do an toàn / kiểm duyệt)
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Google không chịu nhả chữ (Có thể do chặn an toàn).");
    }

    let aiText = data.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const finalObject = JSON.parse(aiText);

    return new Response(JSON.stringify(finalObject), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("❌ BẮT LỖI TẠI TRẠM:", error.message);
    
    // Trả về phao cứu sinh kèm theo lý do lỗi để mình còn biết đường sửa
    const fallbackResponse = {
      en: "The architecture of this software needs to be optimized.",
      vi: `Lỗi kết nối AI: ${error.message}`
    };
    
    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};