import fs from 'fs';
import path from 'path';

export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const { topic, passageData } = await request.json();

    if (!topic || !passageData) {
      return new Response(JSON.stringify({ error: 'Missing topic or passageData' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Only allow this API to work in local dev environment
    if (import.meta.env.PROD) {
      return new Response(JSON.stringify({ error: 'Tính năng lưu file chỉ hoạt động trên Local Dev.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const dirPath = path.join(process.cwd(), 'src/data/passages');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${topic}.json`);
    fs.writeFileSync(filePath, JSON.stringify(passageData, null, 2), 'utf8');

    return new Response(JSON.stringify({ success: true, message: 'Đã lưu bài đọc thành công!' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
