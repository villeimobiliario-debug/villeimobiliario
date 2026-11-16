export const SESSION_KEY = 'ville_admin_session_v1';

export function asMoney(cents = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}
export function asDate(value) {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  return `${match[3]}/${match[2]}/${match[1]}`;
}
export function toUTCDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
}
export function daysLate(due, today = new Date()) {
  if (!due) return 0;
  const when = toUTCDate(due);
  if (!Number.isFinite(when)) return 0;
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((now - when) / 86400000));
}
export function subscriptionLabel(status) {
  return ({ trial: 'Em teste', active: 'Ativa', past_due: 'Em atraso', suspended: 'Suspensa', cancelled: 'Cancelada' })[status] || 'Indefinida';
}
export function paymentLabel(status) {
  return ({ submitted: 'Em análise', approved: 'Confirmado', rejected: 'Recusado' })[status] || 'Indefinido';
}
export function calculateMetrics({ tenants = [], subscriptions = [], invoices = [], payments = [] }) {
  return {
    tenants: tenants.length,
    active: subscriptions.filter(x => x.status === 'active').length,
    trials: subscriptions.filter(x => x.status === 'trial').length,
    outstanding: invoices.filter(x => x.status === 'open').reduce((s,x) => s + Number(x.amount_cents || 0), 0),
    received: payments.filter(x => x.state === 'approved').reduce((s,x) => s + Number(x.amount_cents || 0), 0),
    overdue: subscriptions.filter(x => x.status === 'past_due' || x.status === 'suspended').length
  };
}
export function safeText(value) { return String(value ?? ''); }
