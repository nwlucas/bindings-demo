addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request))
  })
  
  async function handleRequest(request) {
    if (request.headers.get('Access-Key') !== ACCESS_KEY) {
      return new Response('Forbidden',{ status: 403 })
    }
    let data = null;
    const url = new URL(request.url);
    const key = url.pathname.substring(1);
    const params = url.searchParams;
    if (request.method === 'DELETE') {
      if (key) {
        data = await KV.delete(key);
      } else {
        data = {error: 'No key provided to delete'}
      }
    } else if (request.method === 'POST') {
      if (key) {
        data = await request.json()
        await KV.put(key, data);
      } else {
        data = {error: 'No key provided for value'}
      }
    } else { //assuming get method
      if (key) {
          data = await KV.get(key);
      } else {
        const prefix = params.get('prefix')
        data = await KV.list({prefix});
      }
    }
    const json = JSON.stringify(data, null, 2);
       return new Response(json, {
        headers: {
          'content-type': 'application/json;charset=UTF-8',
        },
      })
  }