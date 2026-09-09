const BASE = "/api";

export async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export function get(path, token) {
  return request(path, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function post(path, body, token) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
