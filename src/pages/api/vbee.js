export const prerender = false;

const appId = process.env.VBEE_APP_ID || 'a627ead2-e4da-4f11-a6a3-7233e6b263ed';
const token = process.env.VBEE_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODAwODEwMzZ9.cWrqh1Cw0doSr736vcY-z6N_NRSd6lglXhVBmZjBhKQ';

export async function POST({ request }) {
  try {
    const { text, voiceCode } = await request.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Nội dung văn bản không được để trống' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Gửi yêu cầu sinh giọng nói bất đồng bộ tới Vbee
    const response = await fetch('https://vbee.vn/api/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'app-id': appId
      },
      body: JSON.stringify({
        app_id: appId,
        inputText: text,
        voiceCode: voiceCode || 'hn_female_ngochuyen_full_48k-fhg',
        callbackUrl: 'https://example.com/vbee-callback'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Vbee API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (data.status === 0 || !data.result) {
      throw new Error(data.error_message || 'Xác thực hoặc tham số Vbee không hợp lệ');
    }

    const requestId = data.result.request_id;

    // 2. Thử nghiệm tuần tự (polling) để đợi file audio được hoàn thành trên server Vbee
    let audioLink = null;
    for (let i = 0; i < 20; i++) {
      // Đợi 1.2 giây trước mỗi lượt check để tối ưu tốc độ và tránh spam API
      await new Promise(r => setTimeout(r, 1200));

      const statusRes = await fetch(`https://vbee.vn/api/v1/tts/${requestId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'app-id': appId
        }
      });

      if (!statusRes.ok) continue;

      const statusData = await statusRes.json();
      const statusResult = statusData.result;

      if (statusResult) {
        if (statusResult.status === 'SUCCESS' || statusResult.audio_link) {
          audioLink = statusResult.audio_link;
          break;
        }
        if (statusResult.status === 'FAILED') {
          throw new Error('Vbee báo lỗi xử lý âm thanh trên máy chủ');
        }
      }
    }

    if (!audioLink) {
      throw new Error('Quá thời gian chờ tạo file âm thanh từ Vbee (Timeout)');
    }

    // 3. Tải file âm thanh nhị phân trả về từ Vbee
    const audioRes = await fetch(audioLink);
    if (!audioRes.ok) {
      throw new Error(`Không thể tải tệp âm thanh từ liên kết của Vbee: ${audioLink}`);
    }

    const audioBuffer = await audioRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (error) {
    console.error("❌ LỖI VBEE PROXY SERVER:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
