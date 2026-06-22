export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const { vocabList } = await request.json();
    if (!vocabList || !Array.isArray(vocabList) || vocabList.length === 0) {
      return new Response(JSON.stringify({ error: "Danh sách từ vựng không hợp lệ hoặc trống." }), { status: 400 });
    }

    const apiKey = import.meta.env.GEMINI_API_KEY;
    const wordString = vocabList.join(", ");

    const prompt = `Bạn là một chuyên gia ra đề thi TOEIC. 
    Nhiệm vụ:
    1. Viết một đoạn văn tiếng Anh (theo định dạng Reading Comprehension của TOEIC như email, bài báo, thông báo, thư tín...) có độ dài khoảng 100-150 từ. 
       ĐOẠN VĂN PHẢI SỬ DỤNG TẤT CẢ CÁC TỪ VỰNG SAU MỘT CÁCH TỰ NHIÊN: ${wordString}.
    2. Cung cấp bản dịch tiếng Việt cho đoạn văn đó.
    3. Tạo 3 câu hỏi trắc nghiệm (A, B, C, D) bằng tiếng Anh kiểm tra đọc hiểu dựa trên đoạn văn đó. Ưu tiên các câu hỏi về ngữ cảnh hoặc nghĩa của các từ vựng đã cung cấp.
    4. Cung cấp chỉ mục đáp án đúng (từ 0 đến 3) và lời giải thích ngắn gọn bằng tiếng Việt.

    QUAN TRỌNG: Mày CHỈ ĐƯỢC PHÉP trả về ĐÚNG 1 khối JSON. TUYỆT ĐỐI KHÔNG thêm bất kỳ văn bản nào khác (không giải thích, không xin chào, không dùng markdown \`\`\`json).
    Định dạng JSON BẮT BUỘC (phải tuân thủ nghiêm ngặt):
    {
      "passage_en": "Nội dung đoạn văn tiếng Anh ở đây...",
      "passage_vi": "Bản dịch tiếng Việt ở đây...",
      "questions": [
        {
          "question": "Câu hỏi tiếng Anh số 1?",
          "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
          "correct_answer_index": 0,
          "explanation": "Giải thích tiếng Việt..."
        },
        {
          "question": "Câu hỏi tiếng Anh số 2?",
          "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
          "correct_answer_index": 1,
          "explanation": "Giải thích tiếng Việt..."
        },
        {
          "question": "Câu hỏi tiếng Anh số 3?",
          "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3", "D. Lựa chọn 4"],
          "correct_answer_index": 2,
          "explanation": "Giải thích tiếng Việt..."
        }
      ]
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Google từ chối: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Google không trả về kết quả.");
    }

    let aiText = data.candidates[0].content.parts[0].text;
    aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const finalObject = JSON.parse(aiText);

    return new Response(JSON.stringify(finalObject), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error("❌ Lỗi sinh đoạn văn ngữ cảnh:", error.message);
    
    return new Response(JSON.stringify({ 
      error: "Lỗi kết nối AI hoặc dữ liệu JSON không hợp lệ.", 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
