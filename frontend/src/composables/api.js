export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(url, options = {}) {
  const token = localStorage.getItem("geo_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch {}
    throw new ApiError(res.status, data?.error || `HTTP ${res.status}`, data);
  }
  if (res.status === 204) return undefined;
  return res.json();
}
