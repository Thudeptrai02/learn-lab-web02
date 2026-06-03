export const prerender = false;

export async function GET({ url }) {
  const imageUrl = url.searchParams.get('url');
  if (!imageUrl) return new Response('Missing url param', { status: 400 });

  try {
    const resp = await fetch(imageUrl);
    const buffer = await resp.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Failed to fetch image', { status: 502 });
  }
}
