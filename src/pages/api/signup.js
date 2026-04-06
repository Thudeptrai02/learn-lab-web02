import { createClient } from '@supabase/supabase-js';

// BƯỚC NGOẶT LÀ ĐÂY: Ép Astro biến file này thành API động thay vì web tĩnh
export const prerender = false; 

export const POST = async ({ request }) => {
  console.log("🚀 BÁO CÁO: Đã nhận được yêu cầu đăng ký VIP!");
  
  try {
    const data = await request.json();
    console.log("📩 Đang xử lý cho email:", data.email);
    
    // Lấy URL và Chìa khóa Admin từ két sắt .env
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAdminKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseAdminKey) {
      throw new Error("Sếp ơi, chưa có chìa khóa SUPABASE_SERVICE_ROLE_KEY trong file .env kìa!");
    }

    // Khởi tạo Supabase với quyền Admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);

    // Dùng quyền Admin tạo tài khoản (Ép xác nhận luôn)
    const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, 
      user_metadata: { 
        full_name: data.fullname,
        job_title: data.jobTitle,
        career_goal: data.careerGoal,
        interests: data.interests
      }
    });

    if (error) throw error;

    console.log("✅ TẠO TÀI KHOẢN THÀNH CÔNG RỒI SẾP ƠI!");
    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("❌ BÁO ĐỘNG ĐỎ TẠI TRẠM API:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};