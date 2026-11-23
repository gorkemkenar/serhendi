// --- DJANGO REST API İSTEMCİSİ ---
const TOKEN_KEY = 'ss_cari_token';
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export const getToken = () => {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sessizce geç
  }
};

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const extractMessage = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return String(first[0]);
  if (typeof first === 'string') return first;
  return '';
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Token ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. Django sunucusunun çalıştığından emin olun.', 0, null);
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(extractMessage(data) || `İstek başarısız (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  login: (username, password, otpCode = '') =>
    request('/auth/login/', { method: 'POST', body: { username, password, otpCode } }),
  logout: () => request('/auth/logout/', { method: 'POST' }),
  me: () => request('/auth/me/'),
  changeOwnPassword: (currentPassword, newPassword) =>
    request('/auth/change-password/', { method: 'POST', body: { currentPassword, newPassword } }),
  resetDefaults: () => request('/reset-defaults/', { method: 'POST' }),

  twoFactor: {
    status: () => request('/auth/2fa/'),
    enable: (code) => request('/auth/2fa/', { method: 'POST', body: { action: 'enable', code } }),
    disable: () => request('/auth/2fa/', { method: 'POST', body: { action: 'disable' } }),
    regenerate: () => request('/auth/2fa/', { method: 'POST', body: { action: 'regenerate' } })
  },

  security: {
    overview: () => request('/security/overview/'),
    verifyIntegrity: (reseal = false) =>
      request('/security/verify-integrity/', { method: 'POST', body: { reseal } }),
    validateUrl: (url) => request('/security/validate-url/', { method: 'POST', body: { url } })
  },

  units: {
    list: () => request('/units/'),
    create: (data) => request('/units/', { method: 'POST', body: data }),
    update: (id, data) => request(`/units/${encodeURIComponent(id)}/`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/units/${encodeURIComponent(id)}/`, { method: 'DELETE' })
  },

  transactions: {
    list: () => request('/transactions/'),
    create: (data) => request('/transactions/', { method: 'POST', body: data }),
    update: (id, data) => request(`/transactions/${encodeURIComponent(id)}/`, { method: 'PATCH', body: data }),
    remove: (id) => request(`/transactions/${encodeURIComponent(id)}/`, { method: 'DELETE' })
  },

  users: {
    list: () => request('/users/'),
    create: (data) => request('/users/', { method: 'POST', body: data }),
    update: (id, data) => request(`/users/${id}/`, { method: 'PATCH', body: data }),
    assignRole: (id, data) => request(`/users/${id}/assign-role/`, { method: 'POST', body: data }),
    remove: (id) => request(`/users/${id}/`, { method: 'DELETE' }),
    setPassword: (id, password) => request(`/users/${id}/set-password/`, { method: 'POST', body: { password } }),
    unlock: (id) => request(`/users/${id}/unlock/`, { method: 'POST' })
  }
};
