import { createClient } from '@supabase/supabase-js';

// Tự động hút chìa khóa từ file .env một cách bảo mật
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Khởi tạo trạm kết nối
export const supabase = createClient(supabaseUrl, supabaseKey);