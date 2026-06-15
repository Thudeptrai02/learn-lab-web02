export const prerender = false;

const appId = 'a627ead2-e4da-4f11-a6a3-7233e6b263ed';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODAwODEwMzZ9.cWrqh1Cw0doSr736vcY-z6N_NRSd6lglXhVBmZjBhKQ';

// Step 2: Check TTS request status → returns status + audio_link (fast, <2s)
export async function GET({ url }) {
  try {
    const requestId = url.searchParams.get('id');
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Missing request id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const statusRes = await fetch(`https://vbee.vn/api/v1/tts/${requestId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'app-id': appId
      }
    });

    if (!statusRes.ok) {
      return new Response(JSON.stringify({ status: 'PENDING' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const statusData = await statusRes.json();
    const result = statusData.result;

    if (result && (result.status === 'SUCCESS' || result.audio_link)) {
      return new Response(JSON.stringify({ status: 'SUCCESS', audio_link: result.audio_link }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (result && result.status === 'FAILED') {
      return new Response(JSON.stringify({ status: 'FAILED', error: 'Vbee processing failed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ status: 'PENDING' }), {
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
