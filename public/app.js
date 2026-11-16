import { config } from './config.js';
import { asDate, asMoney, daysLate, calculateMetrics, subscriptionLabel, paymentLabel, safeText } from './logic.js';
import { restoreFromCallback, getSession, isRecoverySession, login, signupInitial, requestPasswordReset,
  currentUser, table, logout, updatePassword, clearSession } from './auth.js';

const app = document.querySelector('#app');
const adminState = { user:null, section:'dashboard', tenants:[], subscriptions:[], invoices:[], payments:[], plans:[], events:[], settings:[] };
const icons = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>',
  receipt:'<path d="M4 3h16v18l-4-2-4 2-4-2-4 2zM8 8h8M8 12h8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/>',
  settings:'<path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1"/><circle cx="12" cy="12" r="4"/>',
  log:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>',
  wallet:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 10h18M7 3h10"/>',
  arrow:'<path d="M7 17 17 7M8 7h9v9"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  shield:'<path d="m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  x:'<path d="M5 5l14 14M19 5 5 19"/>',
  arrowright:'<path d="M5 12h14m-6-6 6 6-6 6"/>'
};
function icon(name, size=20) {return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.home}</svg>`;}
function el(tag, className, text) { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=safeText(text); return node; }
function nodeText(element, text) {element.textContent=safeText(text); return element;}
function message(text, type='error') { const n=document.querySelector('#form-message'); if(n){n.textContent=text;n.className=`form-message ${type}`;n.hidden=false;} }
function setWorking(btn,busy) { if(!btn)return;btn.disabled=busy; btn.dataset.original ||= btn.textContent; btn.textContent=busy?'Aguarde...':btn.dataset.original; }
function formatError(error) {
  const t = String(error?.message || 'Tente novamente.');
  if (/invalid login credentials/i.test(t)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(t)) return 'Confirme seu e-mail antes de entrar.';
  if (/password.*(short|6|characters)/i.test(t)) return 'Use uma senha com pelo menos 12 caracteres.';
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(t)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/failed to fetch|networkerror|network request/i.test(t)) return 'Não foi possível conectar. Verifique sua internet.';
  return t;
}
function renderAuth(screen='login', note='') {
  const register=screen==='register', recover=screen==='recover', newPass=screen==='new-password', blocked=screen==='blocked';
  app.innerHTML = `<div class="auth-page"><div class="auth-aside"><div class="brand brand-large"><span class="brand-symbol">V</span><span>VILLE<span class="brand-accent">.</span></span></div>
    <div class="aside-copy"><span class="aside-eyebrow">PLATAFORMA DE GESTÃO</span><h1>Inteligência para<br>transformar <em>gestão.</em></h1><p>Controle, clareza e tecnologia para o mercado imobiliário.</p></div><div class="aside-foot">VILLE IMOBILIÁRIO <span>•</span> ADMINISTRAÇÃO</div></div>
    <main class="auth-main"><div class="auth-top">Painel administrativo <span class="top-dot"></span> Acesso protegido</div><section class="auth-card">
    <div class="auth-chip">${icon('shield',16)} Área restrita</div>
    <h2>${register?'Criar acesso inicial':recover?'Recuperar acesso':newPass?'Definir nova senha':blocked?'Acesso não autorizado':'Bem-vindo de volta'}</h2>
    <p class="subhead">${register?'Ative sua conta administrativa com o e-mail autorizado.':recover?'Enviaremos um link de recuperação para o e-mail principal.':newPass?'Defina uma nova senha para sua conta.':blocked?'Esta conta não possui permissão para administrar a plataforma.':'Entre para acompanhar os indicadores e assinaturas da plataforma.'}</p>
    <div class="form-message" id="form-message" role="status" hidden></div>
    ${blocked ? `<div class="read-only-note">A autenticação funcionou, mas o usuário não está na lista de administradores. Confirme o e-mail e solicite a liberação de acesso.</div><button type="button" id="logout" class="btn-primary">Sair com segurança ${icon('logout',17)}</button>` : `<form id="auth-form" novalidate>
      ${(!newPass) ? `<label for="email">E-mail administrativo</label><input id="email" name="email" type="email" autocomplete="email" ${register || recover ? 'readonly':''} value="${config.adminEmail}" required>`:''}
      ${(!recover) ? `<label for="password">${newPass?'Nova senha':'Senha'}</label><div class="input-password"><input id="password" name="password" type="password" autocomplete="${register||newPass?'new-password':'current-password'}" ${register||newPass?'minlength="12"':'minlength="1"'} required placeholder="${register||newPass?'No mínimo 12 caracteres':'Sua senha'}"><button type="button" id="toggle-password" class="toggle-password" aria-label="Mostrar senha">${icon('eye',18)}</button></div>`:''}
      ${register||newPass?'<p class="field-hint">Use pelo menos 12 caracteres, com letras e números.</p>':''}
      <button type="submit" class="btn-primary" id="auth-submit">${register?'Criar acesso':recover?'Enviar link':newPass?'Salvar senha':'Entrar no painel'} ${icon('arrowright',18)}</button></form>`}
      <div class="auth-links">${register||recover||newPass?'<button type="button" class="link-button" data-screen="login">Voltar ao login</button>':!blocked?'<button type="button" class="link-button" data-screen="recover">Esqueceu a senha?</button><button type="button" class="link-button" data-screen="register">Primeiro acesso</button>':''}</div>
    <div class="auth-secure">${icon('shield',16)} Seus dados são protegidos por autenticação e permissões no servidor.</div>
    </section><div class="auth-bottom">© 2026 VILLE Imobiliário</div></main></div>`;
  if(note) message(note,'success');
  document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>renderAuth(b.dataset.screen)));
  document.querySelector('#logout')?.addEventListener('click',async()=>{await logout();renderAuth();});
  document.querySelector('#toggle-password')?.addEventListener('click',()=>{const i=document.querySelector('#password');i.type=i.type==='password'?'text':'password';});
  document.querySelector('#auth-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const btn=document.querySelector('#auth-submit');const email=document.querySelector('#email')?.value.trim().toLowerCase();const password=document.querySelector('#password')?.value;
    if(email && email !== config.adminEmail) return message('Este formulário é exclusivo para o administrador principal.');
    if((register || newPass) && (password?.length||0)<12) return message('Crie uma senha com pelo menos 12 caracteres.');
    setWorking(btn,true);
    try {
      if(recover){await requestPasswordReset(); renderAuth('login','Se o e-mail estiver cadastrado, você receberá um link de recuperação.');}
      else if(register) {await signupInitial(password);renderAuth('login','Solicitação recebida. Verifique a caixa de entrada e confirme seu e-mail antes de entrar.');}
      else if(newPass){await updatePassword(password); await startAdmin();}
      else {await login(email,password);await startAdmin();}
    } catch(err){ message(formatError(err)); }
    finally {setWorking(btn,false);}
  });
}
function emptyRow(text,colspan) {const tr=el('tr');const td=el('td','empty-cell',text);td.colSpan=colspan;tr.append(td);return tr;}
function tableRender(cols, data, rowBuilder, emptyText='Nenhum registro encontrado.') {
  const root=el('div','table-scroll');const t=el('table','data-table');const head=el('thead');const header=el('tr');
  cols.forEach(c=>header.append(el('th','',c)));head.append(header);t.append(head);
  const tbody=el('tbody'); if(!data.length)tbody.append(emptyRow(emptyText,cols.length));else data.forEach(r=>{
    const tr=el('tr');rowBuilder(r).forEach(cell=>{const td=el('td');if(typeof cell==='object' && cell && cell.badge){const span=el('span',`status-badge ${cell.kind||''}`,cell.badge);td.append(span);}else td.textContent=safeText(cell);tr.append(td);});tbody.append(tr);
  });t.append(tbody);root.append(t);return root;
}
const nav=[['dashboard','Visão geral','home'],['tenants','Imobiliárias','building'],['subscriptions','Assinaturas','calendar'],['payments','Pagamentos','receipt'],['settings','Configurações','settings']];
function renderShell() {
  app.innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="side-brand"><span class="brand-symbol">V</span><span>VILLE<span class="brand-accent">.</span><small>IMOBILIÁRIO</small></span></div>
    <div class="side-section-title">MENU PRINCIPAL</div><nav id="side-nav" class="side-nav" aria-label="Navegação principal"></nav>
    <div class="sidebar-bottom"><div class="support-box">${icon('shield',19)}<div><strong>Área protegida</strong><span>Acesso exclusivo VILLE</span></div></div><button id="logout" class="logout-btn">${icon('logout',18)} Sair da plataforma</button></div></aside>
    <div class="main-pane"><header class="topbar"><button class="menu-toggle" id="menu-toggle" aria-label="Abrir menu">${icon('menu',22)}</button><div class="breadcrumbs">VILLE Imobiliário <span>/</span> Administração</div><div class="top-user"><span class="user-dot">V</span><div><strong>Administrador</strong><small>${config.adminEmail}</small></div></div></header>
    <main class="page-content" id="page-content" tabindex="-1"></main></div><div id="sidebar-scrim" class="sidebar-scrim"></div></div>`;
  const navroot=document.querySelector('#side-nav');nav.forEach(([id,label,ic])=>{const b=el('button','nav-item');b.type='button';b.dataset.nav=id;b.innerHTML=`${icon(ic,19)}<span></span>`;b.lastElementChild.textContent=label;b.addEventListener('click',()=>{adminState.section=id;renderSection();closeSidebar();});navroot.append(b);});
  document.querySelector('#logout').addEventListener('click',async()=>{await logout();renderAuth();});
  document.querySelector('#menu-toggle').addEventListener('click',()=>document.querySelector('.app-shell').classList.toggle('sidebar-open'));
  document.querySelector('#sidebar-scrim').addEventListener('click',closeSidebar);
}
function closeSidebar(){document.querySelector('.app-shell')?.classList.remove('sidebar-open');}
function header(title,desc,action=false){const div=el('div','page-header');div.innerHTML=`<div><div class="eyebrow">ADMINISTRADOR <span>•</span> VILLE</div><h1></h1><p></p></div>${action?'<button class="outline-button" id="refresh">Atualizar dados ↻</button>':''}`;div.querySelector('h1').textContent=title;div.querySelector('p').textContent=desc;if(action)div.querySelector('#refresh').addEventListener('click',reload);return div;}
function card(label,value,variant='blue',ic='wallet',foot=''){const c=el('section',`metric-card ${variant}`);c.innerHTML=`<div class="metric-top"><span></span><span class="metric-icon">${icon(ic,18)}</span></div><strong class="metric-value"></strong><small class="metric-foot"></small>`;c.querySelector('.metric-top span').textContent=label;c.querySelector('.metric-value').textContent=value;c.querySelector('.metric-foot').textContent=foot;return c;}
function panel(title,description='',smallAction='') {const p=el('section','panel');const h=el('div','panel-heading');const text=el('div');text.append(el('h2','',title));if(description)text.append(el('p','',description));h.append(text);if(smallAction){const b=el('button','text-action',smallAction);b.addEventListener('click',()=>{adminState.section='tenants';renderSection();});h.append(b);}p.append(h);return p;}
function dashboard() {
  const wrap=el('div');wrap.append(header('Visão geral','Tudo o que importa sobre o seu SaaS, em um só lugar.',true));
  const metrics=calculateMetrics(adminState);const cards=el('div','metric-grid');
  cards.append(card('Imobiliárias cadastradas',String(metrics.tenants),'blue','building','Total de contas criadas'),card('Assinaturas ativas',String(metrics.active),'teal','check','Clientes pagantes'),card('Em teste gratuito',String(metrics.trials),'coral','calendar','Teste grátis de 7 dias'),card('Recebimentos confirmados',asMoney(metrics.received),'blue','wallet','Total histórico confirmado'));
  wrap.append(cards);
  const intro=el('div','info-line');intro.innerHTML=`${icon('shield',20)}<span>Seu painel mostra apenas <strong>dados reais do Supabase</strong>. A base está pronta para receber as primeiras imobiliárias.</span>`;wrap.append(intro);
  const two=el('div','two-column');const recent=panel('Imobiliárias recentes','Últimos cadastros','Ver todas');recent.append(tableRender(['Imobiliária','Situação','Cadastro'],adminState.tenants.slice(0,6),r=>[r.name,{badge:r.state==='enabled'?'Ativa':'Desativada',kind:r.state==='enabled'?'positive':'neutral'},asDate(r.created_at)],'Nenhuma imobiliária cadastrada ainda.'));
  const side=panel('Resumo financeiro','Cobranças de mensalidades');const info=el('div','financial-summary');
  for(const [l,v] of [['Em aberto',asMoney(metrics.outstanding)],['Contas em atraso',String(metrics.overdue)],['Pagamentos em análise',String(adminState.payments.filter(x=>x.state==='submitted').length)]]){const r=el('div','summary-row');r.append(el('span','',l));r.append(el('strong','',v));info.append(r);}side.append(info);
  two.append(recent,side);wrap.append(two);return wrap;
}
function tenants(){const root=el('div');root.append(header('Imobiliárias','Acompanhe os clientes que utilizam a plataforma.',true));const p=panel('Imobiliárias cadastradas','Contas e status dos clientes');p.append(tableRender(['Nome','Identificador','Situação','Cadastro'],adminState.tenants,r=>[r.name,r.slug,{badge:r.state==='enabled'?'Ativa':'Desativada',kind:r.state==='enabled'?'positive':'neutral'},asDate(r.created_at)]));root.append(p);const note=el('p','hint-note','O cadastro automático das imobiliárias será implementado na etapa do site institucional.');root.append(note);return root;}
function subscriptions(){const root=el('div');root.append(header('Assinaturas','Acompanhe testes gratuitos, mensalidades e atrasos.',true));const p=panel('Controle de assinaturas','Prazo de tolerância: 5 dias após o vencimento');p.append(tableRender(['Imobiliária','Situação','Fim do teste','Próximo vencimento','Dias em atraso'],adminState.subscriptions,r=>[adminState.tenants.find(t=>t.id===r.tenant_id)?.name||'—',{badge:subscriptionLabel(r.status),kind:r.status==='active'?'positive':r.status==='suspended'?'negative':'neutral'},asDate(r.trial_ends_at),asDate(r.next_due_on),daysLate(r.next_due_on)]));root.append(p);return root;}
function payments(){const root=el('div');root.append(header('Pagamentos','Confira os comprovantes antes de confirmar qualquer recebimento.',true));const p=panel('Histórico de pagamentos','Somente pagamentos conferidos podem ser considerados recebidos');p.append(tableRender(['Imobiliária','Valor','Situação','Enviado em'],adminState.payments,r=>[adminState.tenants.find(t=>t.id===r.tenant_id)?.name||'—',asMoney(r.amount_cents),{badge:paymentLabel(r.state),kind:r.state==='approved'?'positive':r.state==='rejected'?'negative':'neutral'},asDate(r.submitted_at)]));root.append(p);root.append(el('p','hint-note','A conferência e aprovação manual de comprovantes será liberada no próximo módulo.'));return root;}
function settings(){const root=el('div');root.append(header('Configurações','Regras comerciais e parâmetros da plataforma.'));const s=adminState.settings?.[0]||{};const p=panel('Parâmetros comerciais','Configurações atuais do SaaS');const list=el('div','settings-list');for(const [l,v] of [['Teste grátis',`${s.trial_days ?? 7} dias`],['Tolerância após vencimento',`${s.grace_days ?? 5} dias`],['Chave Pix',s.pix_key ? 'Configurada':'Ainda não configurada']]){const item=el('div','setting-row');item.append(el('span','',l));item.append(el('strong','',v));list.append(item);}p.append(list);root.append(p);root.append(el('p','hint-note','Para proteger dados comerciais, as alterações de parâmetros serão disponibilizadas em módulo administrativo específico, com histórico de auditoria.'));return root;}
function renderSection(){document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===adminState.section));const content=document.querySelector('#page-content');content.replaceChildren(( {dashboard,tenants,subscriptions,payments,settings}[adminState.section]||dashboard)());}
async function reload(){try{await loadData();renderSection();}catch(e){showFatal(e);}}
async function loadData() {
  const [tenants,subscriptions,invoices,payments,plans,settings] = await Promise.all([
    table('tenants','select=id,name,slug,state,created_at&order=created_at.desc&limit=1000'),
    table('subscriptions','select=tenant_id,status,trial_ends_at,next_due_on&limit=1000'),
    table('invoices','select=id,tenant_id,due_on,amount_cents,status&limit=1000'),
    table('payments','select=id,tenant_id,amount_cents,state,submitted_at&order=submitted_at.desc&limit=1000'),
    table('subscription_plans','select=id,name,monthly_price_cents,active&limit=1000'),
    table('platform_settings','select=trial_days,grace_days,pix_key&limit=1')
  ]);
  Object.assign(adminState,{tenants,subscriptions,invoices,payments,plans,settings});
}
function showFatal(error){ const note=el('div','fetch-error');note.append(el('h2','','Erro ao carregar dados'));note.append(el('p','',formatError(error)));const button=el('button','btn-primary','Tentar novamente');button.addEventListener('click',reload);note.append(button);document.querySelector('#page-content')?.replaceChildren(note);}
async function startAdmin(){
  if(!getSession()){renderAuth();return;}
  if(isRecoverySession()){renderAuth('new-password');return;}
  app.innerHTML='<main class="loading-page"><div class="spinner"></div><p>Validando permissões de acesso...</p></main>';
  try{
    const user=await currentUser();
    if(user.email?.toLowerCase()!==config.adminEmail || !user.email_confirmed_at){clearSession();renderAuth('blocked');return;}
    const permissions=await table('platform_settings','select=singleton&limit=1');
    if(!Array.isArray(permissions)||permissions.length!==1){renderAuth('blocked');return;}
    adminState.user=user;
    await loadData();
    renderShell();renderSection();
  }catch(e){ if(e.status===401){clearSession();renderAuth('login','Sessão expirada. Entre novamente.');} else {renderAuth('blocked');message(formatError(e));} }
}
const callback=restoreFromCallback();
if(callback.error){renderAuth('login',`Não foi possível validar o link: ${callback.error}`);} else if(getSession())startAdmin(); else renderAuth();
