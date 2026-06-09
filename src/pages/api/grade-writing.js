// src/pages/api/grade-writing.js
// TẠM DỪNG — đã tắt DeepSeek API để tránh tốn credit

async function gradeWithDeepSeek(studentAnswer, taskPrompt, partNumber, pictureStory) {
  return {
    content: 0,
    organisation: 0,
    language: 0,
    feedback_vn: "⚠️ Tính năng chấm bài đã tạm dừng. Vui lòng quay lại sau.",
    sample: ""
  };
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