import { config } from './config.js';
import { SESSION_KEY } from './logic.js';

const storage = sessionStorage;
let session = readStoredSession();

function readStoredSession() {
  try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setSession(data) {
  session = data;
  if (data) storage.setItem(SESSION_KEY, JSON.stringify(data));
  else storage.removeItem(SESSION_KEY);
}
function getHeaders(accessToken) {
  return {
    'apikey': config.supabasePublishableKey,
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
}
async function callApi(url, { method = 'GET', body, token } = {}) {
  const response = await fetch(url, {
    method,
    headers: getHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store'
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Falha na solicitação (${response.status}).`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}
export function getSession() { return session; }
export function isRecoverySession() { return session?.recovery === true; }
export function clearSession() { setSession(null); }
export function restoreFromCallback() {
  const data = new URLSearchParams(location.hash.slice(1));
  const access_token = data.get('access_token');
  const refresh_token = data.get('refresh_token');
  const type = data.get('type');
  const error = data.get('error_description') || data.get('error');
  if (!access_token || !refresh_token) {
    if (error) history.replaceState({}, '', location.pathname + location.search);
    return { consumed: false, error };
  }
  setSession({
    access_token, refresh_token,
    expires_at: Date.now() + Math.max(30, Number(data.get('expires_in') || 3600)) * 1000,
    recovery: type === 'recovery'
  });
  history.replaceState({}, '', location.pathname + location.search);
  return { consumed: true, recovery: type === 'recovery' };
}
export async function login(email, password) {
  const result = await callApi(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', body: { email, password }
  });
  if (!result?.access_token || !result?.refresh_token) throw new Error('Não foi possível autenticar.');
  setSession({ access_token: result.access_token, refresh_token: result.refresh_token,
    expires_at: Date.now() + (Number(result.expires_in || 3600) * 1000) });
  return result;
}
export async function signupInitial(password) {
  return callApi(`${config.supabaseUrl}/auth/v1/signup?redirect_to=${encodeURIComponent(location.origin + '/')}`, {
    method: 'POST', body: { email: config.adminEmail, password }
  });
}
export async function requestPasswordReset() {
  return callApi(`${config.supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(location.origin + '/')}`, {
    method: 'POST', body: { email: config.adminEmail }
  });
}
export async function refreshSession() {
  if (!session?.refresh_token) { clearSession(); return false; }
  try {
    const r = await callApi(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', body: { refresh_token: session.refresh_token }
    });
    setSession({ access_token:r.access_token, refresh_token:r.refresh_token,
      expires_at:Date.now() + (Number(r.expires_in || 3600) * 1000) });
    return true;
  } catch { clearSession(); return false; }
}
async function tokenReady() {
  if (!session?.access_token) throw new Error('Faça login para continuar.');
  if (Date.now() + 60000 >= Number(session.expires_at || 0)) {
    if (!await refreshSession()) throw new Error('Sessão expirada. Entre novamente.');
  }
  return session.access_token;
}
export async function authorizedApi(url, init = {}) {
  let token = await tokenReady();
  try { return await callApi(url, { ...init, token }); }
  catch (e) {
    if (e.status !== 401 || !await refreshSession()) throw e;
    token = session.access_token;
    return callApi(url, { ...init, token });
  }
}
export async function currentUser() { return authorizedApi(`${config.supabaseUrl}/auth/v1/user`); }
export async function table(name, params = '') {
  const allowed = new Set(['platform_settings','tenants','subscriptions','subscription_plans','invoices','payments','audit_events']);
  if (!allowed.has(name)) throw new Error('Recurso não permitido.');
  return authorizedApi(`${config.supabaseUrl}/rest/v1/${name}?${params}`);
}
export async function updatePassword(password) {
  const token = await tokenReady();
  const r = await callApi(`${config.supabaseUrl}/auth/v1/user`, { method:'PUT', body:{password}, token });
  if (session) setSession({ ...session, recovery:false });
  return r;
}
export async function logout() {
  try {
    if (session?.access_token) await callApi(`${config.supabaseUrl}/auth/v1/logout`, {method:'POST',token:session.access_token});
  } catch { /* Always remove local session even if server is unavailable. */ }
  clearSession();
}
