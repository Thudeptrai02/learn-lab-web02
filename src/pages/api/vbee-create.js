export const prerender = false;

const appId = 'a627ead2-e4da-4f11-a6a3-7233e6b263ed';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODAwODEwMzZ9.cWrqh1Cw0doSr736vcY-z6N_NRSd6lglXhVBmZjBhKQ';

// Step 1: Submit TTS request to Vbee → returns request_id (fast, <3s)
export async function POST({ request }) {
  try {
    const { text, voiceCode } = await request.json();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

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
      throw new Error(data.error_message || 'Vbee authentication failed');
    }

    return new Response(JSON.stringify({ request_id: data.result.request_id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
