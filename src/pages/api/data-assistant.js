export const prerender = false;

// TẠM DỪNG — DeepSeek API đã hết credit
// Khi nạp tiền, bỏ comment code dưới và xoá đoạn return này

export const POST = async ({ request }) => {
  return new Response(JSON.stringify({
    choices: [{ message: { content: '{"message":"⚠️ AI tạm dừng do hết credit DeepSeek. Các tính năng fix (nút trong quality report, Tạo chuẩn SPSS) vẫn hoạt động bình thường.","actions":[]}' } }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
