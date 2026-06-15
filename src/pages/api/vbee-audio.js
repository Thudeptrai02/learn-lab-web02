export const prerender = false;

// Step 3: Proxy download audio file from Vbee audio_link (fast, streams binary)
export async function GET({ url }) {
  try {
    const audioUrl = url.searchParams.get('url');
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: 'Missing audio url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    }

    const arrayBuffer = await audioRes.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
