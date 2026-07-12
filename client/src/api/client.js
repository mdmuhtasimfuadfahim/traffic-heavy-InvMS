const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8977';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error?.message || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.code = body?.error?.code;
    throw error;
  }

  return body;
}

export const api = {
  identify: (username) => request('/api/users', { method: 'POST', body: JSON.stringify({ username }) }),
  listDrops: () => request('/api/drops'),
  createDrop: (payload) => request('/api/drops', { method: 'POST', body: JSON.stringify(payload) }),
  reserve: (dropId, userId) =>
    request(`/api/drops/${dropId}/reservations`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  purchase: (reservationId, userId) =>
    request(`/api/reservations/${reservationId}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  cancel: (reservationId, userId) =>
    request(`/api/reservations/${reservationId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

export { API_URL };
