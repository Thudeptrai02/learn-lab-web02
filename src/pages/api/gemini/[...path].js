export const prerender = false;

export async function ALL({ params, request, url }) {
  const path = params.path;
  const targetUrl = new URL(`https://generativelanguage.googleapis.com/${path}${url.search}`);
  
  try {
    const method = request.method;
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await request.text();
    
    const headers = new Headers();
    const contentType = request.headers.get('Content-Type');
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    
    const response = await fetch(targetUrl.toString(), {
      method: method,
      headers: headers,
      body: body
    });
    
    const resBody = await response.arrayBuffer();
    const resHeaders = new Headers();
    const resContentType = response.headers.get('Content-Type');
    if (resContentType) {
      resHeaders.set('Content-Type', resContentType);
    }
    resHeaders.set('Access-Control-Allow-Origin', '*');
    
    return new Response(resBody, {
      status: response.status,
      headers: resHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: { message: error.message } }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
