export async function bffFetch(path: string, options: RequestInit = {}) {
  const url = `/api/proxy/${path}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errJson;
    try {
      errJson = JSON.parse(errText);
    } catch {
      errJson = { error: errText };
    }
    throw new Error(errJson.error || errJson.details || `BFF call failed with status ${response.status}`);
  }

  return response.json();
}
