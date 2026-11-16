import {config} from '../config.js';
const root=document.querySelector('#app');
const tokenKey='ville_agency_session_v1';
const appState={session:null,user:null,member:null,tenant:null,subscription:null,section:'dashboard',data:{properties:[],contacts:[],leads:[],visits:[],rental_contracts:[],rent_charges:[],owner_payouts:[],finance_entries:[],property_events:[],documents:[],property_sales:[],staff:[]},feedback:''};
const navigation=[
 ['dashboard','Visão geral'],['properties','Imóveis'],['contacts','Clientes e proprietários'],
 ['leads','CRM de interessados'],['visits','Agenda de visitas'],['sales','Vendas e comissões'],['rentals','Locações e contratos'],
 ['finance','Financeiro e repasses'],['agents','Corretores'],['documents','Documentos'],
 ['reports','Relatórios'],['settings','Configurações']
];
const statuses={available:'Disponível',reserved:'Reservado',rented:'Alugado',sold:'Vendido',inactive:'Inativo',
 new:'Novo',contacted:'Em contato',visit:'Visita',proposal:'Proposta',won:'Concluído',lost:'Perdido',
 scheduled:'Agendada',completed:'Realizada',cancelled:'Cancelada'};
const types={house:'Casa',apartment:'Apartamento',land:'Terreno',commercial:'Comercial',rural:'Rural',other:'Outro'};
// Ícones vetoriais locais: sem dependências externas, fontes ou novas permissões.
const iconPaths={
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 properties:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 contacts:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5M17 15a5 5 0 0 1 4 5"/>',
 leads:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 visits:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18m6 5h2m3 0h2"/>',
 sales:'<path d="m3 17 6-6 4 4 8-8M16 7h5v5"/>',
 rentals:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3M3 5l9-3 9 3"/>',
 finance:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18m-14 7h4"/>',
 agents:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 documents:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
 reports:'<path d="M4 20V11m5 9V4m5 16v-7m5 7V8M2 21h20"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.5 1.1-1.5 2.6-1.8-.7a8 8 0 0 1-1.9 1.1l-.3 2h-3l-.3-2a8 8 0 0 1-1.9-1.1l-1.8.7L7 16.2 8.5 15a9 9 0 0 1 0-2l-1.5-1.2L8.5 9l1.8.7a8 8 0 0 1 1.9-1.1l.3-2h3l.3 2a8 8 0 0 1 1.9 1.1l1.8-.7L21 11.8 19.5 13a8 8 0 0 1-.1 2z" transform="translate(-1 -2)"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="M7 17 17 7M8 7h9v9"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 shield:'<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 sparkle:'<path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17z"/>'
};
function uiIcon(key,size=20){
 const body=iconPaths[key]||iconPaths.dashboard;
 return '<svg aria-hidden="true" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
}
function iconElement(key,cls=''){
 const node=document.createElement('span');node.className=cls;node.innerHTML=uiIcon(key);return node;
}
function switchTo(section){
 appState.section=section;renderSection();
 root.querySelector('.shell')?.classList.remove('menu-open');
 root.querySelector('#mobile-menu')?.setAttribute('aria-expanded','false');
}
const esc=(v)=>String(v??'');
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=esc(text);return e;};
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const moneyInput=c=>c==null?'':(Number(c)/100).toFixed(2).replace('.',',');
const day=x=>{
 if(!x)return '—';
 const match=String(x).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(match)return match[3]+'/'+match[2]+'/'+match[1];
 return new Date(x).toLocaleDateString('pt-BR');
};
const localDate=()=>{
 const d=new Date(),pad=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
};
const localDateTimeValue=x=>{
 if(!x)return '';
 const d=new Date(x),pad=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
};
const dateTime=x=>x?new Date(x).toLocaleString('pt-BR'):'—';
const toCents=(v,optional=false)=>{
 const t=String(v??'').trim();
 if(optional&&!t)return null;
 if(!/^\d+([,.]\d{1,2})?$/.test(t))throw Error('Use o formato 1500,00 para os valores.');
 const [units,dec='']=t.replace(',','.').split('.');
 const n=Number(units)*100+Number(dec.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<0||n>100000000000)throw Error('Valor fora do limite permitido.');
 return n;
};
function saveSession(v){appState.session=v;if(v)sessionStorage.setItem(tokenKey,JSON.stringify(v));else sessionStorage.removeItem(tokenKey);}
try{appState.session=JSON.parse(sessionStorage.getItem(tokenKey)||'null');}catch{saveSession(null);}
async function request(url,{method='GET',data,auth=true,prefer}={}){
 const h={'apikey':config.supabasePublishableKey};
 if(data!==undefined)h['Content-Type']='application/json';
 if(auth){
  if(!appState.session?.access_token)throw Error('Entre com seu e-mail e senha.');
  if(Date.now()>=(appState.session.expires_at||0)-60000){
    const body={refresh_token:appState.session.refresh_token};
    const refreshed=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',data:body,auth:false});
    saveSession({access_token:refreshed.access_token,refresh_token:refreshed.refresh_token,
      expires_at:Date.now()+Number(refreshed.expires_in||3600)*1000});
  }
  h.Authorization='Bearer '+appState.session.access_token;
 }
 if(prefer)h.Prefer=prefer;
 const res=await fetch(config.supabaseUrl+url,{method,headers:h,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
 let result;const raw=await res.text();
 try{result=raw?JSON.parse(raw):null;}catch{result=null;}
 if(!res.ok){const err=new Error(result?.message||result?.error_description||result?.error||'Falha na solicitação ('+res.status+').');err.status=res.status;throw err;}
 return result;
}
const qs=v=>encodeURIComponent(String(v));
async function list(table,columns='*',more=''){
 const id=appState.tenant.id;
 return request('/rest/v1/'+table+'?select='+columns+'&tenant_id=eq.'+qs(id)+(more?'&'+more:''));
}
async function mutate(table,values,id){
 const p='/rest/v1/'+table+(id?'?id=eq.'+qs(id)+'&tenant_id=eq.'+qs(appState.tenant.id):'');
 const response=await request(p,{method:id?'PATCH':'POST',data:id?values:{...values,tenant_id:appState.tenant.id},prefer:'return=representation'});
 if(!Array.isArray(response)||response.length!==1)throw Error('Não foi possível confirmar o registro. Atualize os dados antes de tentar novamente.');
 return response[0];
}
function loginScreen(mode='login',info=''){
 const registration=mode==='signup',claim=mode==='claim',recover=mode==='recover';
 root.innerHTML=`<div class="login-wrap"><aside class="login-side"><div class="logo">VILLE<i>.</i><small>IMOBILIÁRIO</small></div>
 <div><h1>Sua imobiliária.<br>Seu próximo nível.</h1><p>Imóveis, clientes, oportunidades e visitas organizados em um único lugar.</p></div>
 <small>Gestão inteligente para o mercado imobiliário</small></aside>
 <main class="login-main"><section class="login-card"><span class="eyebrow">VILLE • ÁREA DA IMOBILIÁRIA</span>
 <h2 id="auth-title"></h2><p class="subtext" id="auth-subtitle"></p><div id="auth-note"></div>
 <form id="auth-form" class="form-grid">
 <label class="field wide" id="auth-email-field">E-mail<input type="email" name="email" autocomplete="email" required></label>
 <label class="field wide" id="auth-password-field">Senha<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
 <label class="field wide" id="auth-slug-field" hidden>Identificador da imobiliária<input type="text" name="slug" placeholder="Ex.: costa-imoveis" autocomplete="off"></label>
 <div class="wide" style="grid-column:1/-1"><button class="primary" type="submit" id="submit-auth">Entrar</button></div>
 </form><div style="margin-top:20px;display:flex;gap:16px;flex-wrap:wrap" id="auth-links"></div>
 <p class="helper" style="margin-top:23px">Acesso com autenticação e dados exclusivos da sua imobiliária.</p>
 </section></main></div>`;
 const title={login:'Acessar minha imobiliária',signup:'Criar minha senha',claim:'Vincular imobiliária',recover:'Recuperar senha'};
 const desc={login:'Entre com seu e-mail e senha para acessar sua área de gestão.',
 signup:'Use o mesmo e-mail informado no cadastro da imobiliária e confirme-o na sua caixa de entrada.',
 claim:'Sua conta está autenticada. Informe o identificador da imobiliária cadastrada com este e-mail.',
 recover:'Enviaremos um link para redefinir sua senha.'};
 root.querySelector('#auth-title').textContent=title[mode];
 root.querySelector('#auth-subtitle').textContent=desc[mode];
 const slugField=root.querySelector('#auth-slug-field');slugField.hidden=!claim;
 const emailField=root.querySelector('#auth-email-field'),passField=root.querySelector('#auth-password-field');
 emailField.hidden=claim;passField.hidden=claim||recover;
 emailField.querySelector('input').required=!claim;
 passField.querySelector('input').required=!claim&&!recover;
 slugField.querySelector('input').required=claim;
 if(registration)passField.querySelector('input').minLength=12;
 const actions={login:'Entrar no painel',signup:'Criar acesso',claim:'Vincular e entrar',recover:'Enviar recuperação'};
 root.querySelector('#submit-auth').textContent=actions[mode];
 const links=root.querySelector('#auth-links');
 const addLink=(name,label)=>{const b=el('button','mini-link',label);b.type='button';b.addEventListener('click',()=>loginScreen(name));links.append(b);};
 if(mode!=='login')addLink('login','Voltar ao login');
 if(mode==='login'){addLink('signup','Primeiro acesso');addLink('recover','Esqueci minha senha');}
 if(mode==='claim')addLink('signup','Criar outra conta');
 if(info)showAuthNote(info,false);
 root.querySelector('#auth-form').addEventListener('submit',async e=>{
  e.preventDefault();const submit=root.querySelector('#submit-auth');submit.disabled=true;
  const f=new FormData(e.currentTarget);
  try{
   const email=esc(f.get('email')).trim().toLowerCase(),password=esc(f.get('password'));
   if(mode==='login'){
    const s=await request('/auth/v1/token?grant_type=password',{method:'POST',data:{email,password},auth:false});
    saveSession({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+s.expires_in*1000});
    await bootstrap();
   }else if(mode==='signup'){
    if(password.length<12)throw Error('Escolha uma senha de pelo menos 12 caracteres.');
    await request('/auth/v1/signup?redirect_to='+qs(location.origin+'/painel/'),{method:'POST',data:{email,password},auth:false});
    loginScreen('login','Solicitação enviada. Confirme seu e-mail para ativar a conta antes de entrar.');
   }else if(mode==='recover'){
    await request('/auth/v1/recover?redirect_to='+qs(location.origin+'/painel/'),{method:'POST',data:{email},auth:false});
    loginScreen('login','Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
   }else{
    const slug=esc(f.get('slug')).trim().toLowerCase();
    await request('/rest/v1/rpc/claim_tenant_owner',{method:'POST',data:{p_slug:slug}});
    await bootstrap();
   }
  }catch(err){showAuthNote(err.message,true);}finally{submit.disabled=false;}
 });
}
function showAuthNote(v,isError){const parent=root.querySelector('#auth-note');if(!parent)return;parent.replaceChildren(el('div','notice'+(isError?' error':''),v));}
async function bootstrap(){
 root.innerHTML='<div class="loading-screen">Validando acesso à imobiliária...</div>';
 try{
  const me=await request('/auth/v1/user');
  if(!me?.email_confirmed_at)throw Error('Confirme seu e-mail antes de continuar.');
  appState.user=me;
  const members=await request('/rest/v1/tenant_members?select=tenant_id,role&user_id=eq.'+qs(me.id)+'&limit=20');
  if(!members.length){loginScreen('claim');return;}
  const tenantIds=members.map(x=>x.tenant_id);
  const tenants=await request('/rest/v1/tenants?select=id,name,slug,state,contact_email&id=in.('+tenantIds.map(qs).join(',')+')');
  const enabled=tenants.find(t=>t.state==='enabled'&&members.some(m=>m.tenant_id===t.id));
  if(!enabled){showAccessDenied('Sua imobiliária está suspensa. Fale com o suporte VILLE.');return;}
  appState.tenant=enabled;
  appState.member=members.find(m=>m.tenant_id===enabled.id);
  const subs=await request('/rest/v1/subscriptions?select=status,trial_ends_at,next_due_on,paid_until,grace_days&tenant_id=eq.'+qs(enabled.id)+'&limit=1');
  appState.subscription=subs[0]||null;
  if(!allowedBySubscription(appState.subscription)){showAccessDenied('O acesso está restrito por vencimento ou suspensão da assinatura. Fale com a VILLE.');return;}
  await reloadData();renderShell();
 }catch(e){if(e.status===401){saveSession(null);loginScreen('login','Sua sessão expirou. Entre novamente.');}
 else{loginScreen('login');showAuthNote(e.message,true);}}
}
function allowedBySubscription(s){
 if(!s||s.status==='suspended'||s.status==='cancelled')return false;
 const today=new Date(), grace=Number(s.grace_days||0);
 const dateLimit=x=>{if(!x)return false;const d=new Date(x);d.setUTCDate(d.getUTCDate()+grace);return today<=d;};
 if(s.status==='trial')return dateLimit(s.trial_ends_at);
 if(s.status==='active'||s.status==='past_due')return (s.paid_until&&new Date(s.paid_until+'T23:59:59Z')>=today)||dateLimit(s.next_due_on+'T23:59:59Z');
 return false;
}
function showAccessDenied(text){
 root.replaceChildren();
 const box=el('div','login-main');box.style.minHeight='100vh';
 const card=el('section','login-card');
 card.append(el('span','eyebrow','VILLE • ACESSO RESTRITO'),el('h2','','Acesso temporariamente indisponível'),el('p','subtext',text));
 const b=el('button','secondary','Sair');b.addEventListener('click',logout);card.append(b);box.append(card);root.append(box);
}
async function reloadData(){
 const tables=['properties','contacts','leads','visits','rental_contracts','rent_charges','owner_payouts','finance_entries','property_events','documents','property_sales'];
 const entries=await Promise.all(tables.map(n=>list(n,'*','order=created_at.desc&limit=500')));
 tables.forEach((n,i)=>{appState.data[n]=entries[i];});
 if(['owner','manager'].includes(appState.member.role)){
  appState.data.staff=await request('/rest/v1/rpc/agency_staff_list',{method:'POST',data:{p_tenant_id:appState.tenant.id}});
 }else appState.data.staff=[];
}
async function logout(){saveSession(null);appState.tenant=null;loginScreen();}
function renderShell(){
 root.innerHTML=`<div class="shell">
 <aside class="sidebar" id="agency-sidebar">
  <div class="brand-block"><span class="brand-mark">V</span><div class="brand-words"><strong>VILLE<span>.</span></strong><small>IMOBILIÁRIO</small></div></div>
  <div class="workspace-chip"><span class="workspace-symbol">${uiIcon('properties',17)}</span><div><small>ESPAÇO DE TRABALHO</small><strong>Gestão imobiliária</strong></div></div>
  <div class="nav-title">MENU PRINCIPAL</div><nav class="nav" id="nav" aria-label="Módulos da imobiliária"></nav>
  <div class="side-bottom">
   <div class="sidebar-access"><span class="sidebar-access-icon">${uiIcon('shield',19)}</span><div><strong id="side-status">Acesso protegido</strong><small>Seu espaço exclusivo VILLE</small></div></div>
   <button type="button" id="logout" class="logout-button">${uiIcon('logout',18)}<span>Sair da plataforma</span></button>
  </div>
 </aside>
 <div class="sidebar-overlay" id="sidebar-overlay"></div>
 <div class="main">
  <header class="topbar">
   <div class="topbar-leading"><button class="mobile-menu" id="mobile-menu" aria-label="Abrir menu de navegação" aria-controls="agency-sidebar" aria-expanded="false" type="button">${uiIcon('menu',21)}</button>
    <div class="top-tenant"><div class="top-breadcrumb"><span>VILLE Imobiliário</span>${uiIcon('chevron',13)}<strong>Minha gestão</strong></div><strong class="tenant-display" id="top-name"></strong></div></div>
   <div class="top-actions"><span class="plan-pill"><span class="pill-pulse"></span><span id="top-plan"></span></span>
    <div class="top-user"><span class="top-avatar" id="top-avatar">V</span><div class="top-user-copy"><strong id="top-role"></strong><small>Conta da imobiliária</small></div></div>
   </div>
  </header>
  <main class="content" id="content" tabindex="-1"></main>
 </div></div>`;
 const role=({owner:'Proprietário',manager:'Gestor',agent:'Corretor'})[appState.member.role]||'Equipe';
 const trial=appState.subscription?.status==='trial';
 root.querySelector('#top-name').textContent=appState.tenant.name;
 root.querySelector('#top-role').textContent=role;
 root.querySelector('#top-avatar').textContent=appState.tenant.name.slice(0,1).toLocaleUpperCase('pt-BR')||'V';
 root.querySelector('#top-plan').textContent=trial?'Período de teste':appState.subscription?.status==='active'?'Plano ativo':'Minha assinatura';
 root.querySelector('#side-status').textContent=trial?'Teste gratuito em andamento':'Ambiente protegido';
 const nav=root.querySelector('#nav');
 const groups={dashboard:'PAINEL',properties:'GESTÃO DE IMÓVEIS',contacts:'GESTÃO DE IMÓVEIS',leads:'GESTÃO DE IMÓVEIS',visits:'GESTÃO DE IMÓVEIS',sales:'NEGÓCIOS E FINANÇAS',rentals:'NEGÓCIOS E FINANÇAS',finance:'NEGÓCIOS E FINANÇAS',agents:'ADMINISTRAÇÃO',documents:'ADMINISTRAÇÃO',reports:'ADMINISTRAÇÃO',settings:'ADMINISTRAÇÃO'};
 let last='';
 navigation.forEach(([key,label])=>{
  if(groups[key]!==last){if(last)nav.append(el('div','nav-group-label',groups[key]));last=groups[key];}
  const btn=el('button','nav-item');btn.type='button';btn.dataset.section=key;
  btn.append(iconElement(key,'nav-icon'),el('span','nav-label',label));
  btn.addEventListener('click',()=>switchTo(key));nav.append(btn);
 });
 root.querySelector('#logout').addEventListener('click',logout);
 const menu=root.querySelector('#mobile-menu');
 const closeMenu=()=>{root.querySelector('.shell').classList.remove('menu-open');menu.setAttribute('aria-expanded','false');};
 menu.addEventListener('click',()=>{const opened=root.querySelector('.shell').classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(opened));});
 root.querySelector('#sidebar-overlay').addEventListener('click',closeMenu);
 renderSection();
}
function sectionHeading(title,subtitle,onAdd){
 const head=el('div','page-title'),titles=el('div','page-title-copy');
 titles.append(el('span','eyebrow','PAINEL DA IMOBILIÁRIA'),el('h1','',title),el('p','',subtitle));head.append(titles);
 if(onAdd){const b=el('button','primary');b.append(iconElement('plus','button-icon'),document.createTextNode(' Novo registro'));b.addEventListener('click',onAdd);head.append(b);}
 return head;
}
function panel(title,sub){
 const p=el('section','panel'),heading=el('div','panel-heading');
 const text=el('div','panel-heading-copy');text.append(el('h2','',title));
 if(sub)text.append(el('p','',sub));
 heading.append(text);p.append(heading);return p;
}
function rowsTable(headers,rows,renderCells){
 const wrap=el('div','table-wrap'),table=el('table','data-table'),thead=el('thead'),hrow=el('tr'),tbody=el('tbody');
 for(const h of headers)hrow.append(el('th','',h));
 thead.append(hrow);table.append(thead);
 if(headers.length<=3)wrap.classList.add('compact-table');
 if(!rows.length){
  const tr=el('tr'),td=el('td','empty');
  td.colSpan=headers.length;
  const state=el('div','empty-state');
  const msg=headers.includes('Imóvel')?['Ainda não há registros','Cadastre o primeiro imóvel para começar a organizar sua operação.']:
    headers.includes('Data')?['Agenda tranquila por aqui','As próximas visitas aparecerão neste espaço.']:
    ['Nada por aqui ainda','Os registros vão aparecer conforme você utilizar este módulo.'];
  state.append(iconElement(headers.includes('Data')?'visits':headers.includes('Imóvel')?'properties':'dashboard','empty-state-icon'),
   el('strong','',msg[0]),el('span','',msg[1]));
  td.append(state);tr.append(td);tbody.append(tr);
 }
 for(const r of rows){
  const tr=el('tr');for(const entry of renderCells(r)){
   const td=el('td');if(entry&&typeof entry==='object'&&entry.status){td.append(el('span','status'+(entry.ok?' ok':entry.warn?' warn':''),entry.status));}
   else if(entry&&typeof entry==='object'&&entry.actions){const box=el('div','table-actions');for(const [label,fn] of entry.actions){const b=el('button','tiny',label);b.addEventListener('click',fn);box.append(b);}td.append(box);}
   else td.textContent=esc(entry);
   tr.append(td);
  }
  tbody.append(tr);
 }
 table.append(tbody);wrap.append(table);return wrap;
}
function currentSummary(){
 const {properties,contacts,leads,visits}=appState.data;
 const available=properties.filter(p=>p.status==='available').length;
 const active=leads.filter(l=>!['won','lost'].includes(l.stage)).length;
 const upcoming=visits.filter(v=>v.status==='scheduled'&&new Date(v.scheduled_at)>=new Date()).length;
 return {available,active,upcoming};
}
function dashboard(){
 const content=el('div','dashboard-page');
 const summary=currentSummary(),canManage=['owner','manager'].includes(appState.member.role);
 content.append(sectionHeading('Visão geral','Acompanhe sua operação de forma simples e inteligente.'));
 const hero=el('section','dashboard-hero');
 const heroCopy=el('div','hero-copy'),chip=el('span','hero-chip');
 chip.append(iconElement('sparkle'),document.createTextNode(' SUA CENTRAL DE GESTÃO'));
 heroCopy.append(chip,el('h2','','Tudo o que sua imobiliária precisa, em um só lugar.'));
 heroCopy.append(el('p','','Acompanhe seus imóveis, organize oportunidades e mantenha o dia a dia sob controle.'));
 const heroActions=el('div','hero-actions');
 const newProperty=el('button','hero-primary');
 newProperty.append(iconElement(canManage?'plus':'properties'),document.createTextNode(canManage?' Cadastrar imóvel':'Ver meus imóveis'));
 newProperty.addEventListener('click',()=>canManage?openForm('properties'):switchTo('properties'));
 const agenda=el('button','hero-secondary');agenda.append(iconElement('visits'),document.createTextNode(' Ver agenda'));
 agenda.addEventListener('click',()=>switchTo('visits'));
 heroActions.append(newProperty,agenda);heroCopy.append(heroActions);
 const artwork=el('div','hero-artwork');
 artwork.setAttribute('aria-hidden','true');
 const heroTile=el('div','hero-tile');
 const tileIcon=iconElement('properties','hero-tile-icon');
 const tileMain=el('div','hero-tile-text');
 tileMain.append(el('small','','PORTFÓLIO ATUAL'),el('strong','',appState.data.properties.length),el('span','','imóveis cadastrados'));
 heroTile.append(tileIcon,tileMain);
 const orbit=el('div','hero-orbit');
 orbit.append(el('span','hero-orbit-dot'),iconElement('sales','hero-orbit-icon'));
 artwork.append(orbit,heroTile);
 hero.append(heroCopy,artwork);content.append(hero);
 const stats=[
  {label:'Imóveis cadastrados',value:appState.data.properties.length,foot:'Total no seu portfólio',icon:'properties',color:'blue'},
  {label:'Imóveis disponíveis',value:summary.available,foot:'Prontos para negociar',icon:'check',color:'teal'},
  {label:'Oportunidades abertas',value:summary.active,foot:'Clientes em atendimento',icon:'leads',color:'coral'},
  {label:'Visitas agendadas',value:summary.upcoming,foot:'Próximos compromissos',icon:'visits',color:'violet'}
 ];
 const cards=el('div','grid4');
 for(const stat of stats){
  const card=el('section','stat stat-'+stat.color);
  const top=el('div','stat-head');
  top.append(el('span','stat-label',stat.label),iconElement(stat.icon,'stat-icon'));
  card.append(top,el('strong','stat-value',stat.value));
  const bottom=el('div','stat-bottom');
  bottom.append(el('span','stat-indicator'),el('small','stat-foot',stat.foot));
  card.append(bottom);cards.append(card);
 }
 content.append(cards);
 if(appState.subscription?.status==='trial'){
  const trial=el('div','trial-strip');
  trial.append(iconElement('clock','trial-icon'),el('span','', 'Seu período gratuito está em andamento. Termina em '+day(appState.subscription.trial_ends_at)+'.'));
  trial.append(el('span','trial-tag','TESTE GRATUITO'));content.append(trial);
 }
 const quick=el('div','quick-section');
 const quickHead=el('div','quick-heading');quickHead.append(el('h2','','Acesso rápido'),el('p','','O que você deseja fazer agora?'));quick.append(quickHead);
 const actions=el('div','quick-grid');
 const entries=[
  ['properties','Imóveis','Gerencie seu portfólio de propriedades.'],
  ['contacts','Clientes','Organize novos clientes e proprietários.'],
  ['visits','Agenda','Acompanhe e organize suas visitas.']
 ];
 for(const [key,label,description] of entries){
  const button=el('button','quick-card');
  button.append(iconElement(key,'quick-icon'));
  const body=el('div','quick-copy');body.append(el('strong','',label),el('small','',description));
  button.append(body,iconElement('arrow','quick-arrow'));
  button.addEventListener('click',()=>switchTo(key));actions.append(button);
 }
 quick.append(actions);content.append(quick);
 const two=el('div','two dashboard-lists'),recent=panel('Imóveis recentes','Últimos imóveis adicionados ao seu portfólio'),
       upcomingPanel=panel('Próximas visitas','Compromissos organizados por data');
 const recentRows=appState.data.properties.slice(0,6);
 recent.append(rowsTable(['Imóvel','Cidade','Situação'],recentRows,p=>[p.title,p.city,{status:statuses[p.status]||p.status,ok:p.status==='available'}]));
 const visits=appState.data.visits.filter(v=>v.status==='scheduled'&&new Date(v.scheduled_at)>=new Date()).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,6);
 upcomingPanel.append(rowsTable(['Data','Imóvel','Cliente'],visits,v=>[dateTime(v.scheduled_at),propertyName(v.property_id),contactName(v.contact_id)]));
 const recentFooter=el('button','panel-link');recentFooter.append(document.createTextNode('Ver todos os imóveis '),iconElement('arrow'));
 recentFooter.addEventListener('click',()=>switchTo('properties'));recent.append(recentFooter);
 const visitFooter=el('button','panel-link');visitFooter.append(document.createTextNode('Abrir agenda '),iconElement('arrow'));
 visitFooter.addEventListener('click',()=>switchTo('visits'));upcomingPanel.append(visitFooter);
 two.append(recent,upcomingPanel);content.append(two);
 const alerts=buildAlerts(),alertPanel=panel('Central de alertas','Avisos sobre vencimentos, contratos e visitas.');
 alertPanel.classList.add('dashboard-alerts');
 const alertTitle=alertPanel.querySelector('h2');if(alertTitle)alertTitle.prepend(iconElement('bell','panel-title-icon'));
 if(alerts.length)alerts.slice(0,8).forEach(message=>{const item=el('div','alert-banner');item.append(iconElement('bell'),el('span','',message));alertPanel.append(item);});
 else {const allGood=el('div','all-clear');allGood.append(iconElement('check','all-clear-icon'));
  const clearText=el('div');clearText.append(el('strong','','Nenhum alerta pendente'),el('span','','Quando houver prazos ou compromissos próximos, eles aparecerão aqui.'));
  allGood.append(clearText);alertPanel.append(allGood);}
 content.append(alertPanel);
 return content;
}
function propertyName(id){return appState.data.properties.find(x=>x.id===id)?.title||'—';}
function contactName(id){return appState.data.contacts.find(x=>x.id===id)?.full_name||'—';}
function listScreen(kind){
 const meta={
  properties:['Imóveis','Cadastre e organize propriedades para venda e locação.'],
  contacts:['Clientes e proprietários','Centralize seus contatos e relacionamentos.'],
  leads:['CRM de interessados','Acompanhe cada oportunidade até a conclusão.'],
  visits:['Agenda de visitas','Organize visitas de clientes aos imóveis.']
 };
 const [title,sub]=meta[kind],content=el('div');
 const writable=kind!=='properties'||['owner','manager'].includes(appState.member.role);
 content.append(sectionHeading(title,sub,writable?()=>openForm(kind):null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 const bar=el('div','toolbar'),search=el('input','search');search.placeholder='Pesquisar registros...';search.type='search';bar.append(search);
 const refresh=el('button','secondary','Atualizar');refresh.addEventListener('click',async()=>{refresh.disabled=true;try{await reloadData();renderSection();}catch(e){appState.feedback=e.message;renderSection();}});
 bar.append(refresh);content.append(bar);
 const p=panel('Registros cadastrados','Os dados são exclusivos da sua imobiliária.'),holder=el('div');
 p.append(holder);content.append(p);
 function draw(){
  const term=search.value.trim().toLocaleLowerCase('pt-BR');
  const data=appState.data[kind].filter(r=>Object.values(r).some(v=>typeof v==='string'&&v.toLocaleLowerCase('pt-BR').includes(term)));
  const action=r=>({actions:kind==='properties'?[['Editar',()=>openForm(kind,r)],['Histórico',()=>showHistory(r)]]:[['Editar',()=>openForm(kind,r)]]});
  if(kind==='properties')holder.replaceChildren(rowsTable(['Imóvel','Tipo','Finalidade','Localização','Preço','Situação','Ações'],data,r=>[
   r.title,types[r.property_type],r.purpose==='both'?'Venda e aluguel':r.purpose==='rent'?'Aluguel':'Venda',r.city,
   r.purpose==='rent'?money(r.rental_price_cents):money(r.sale_price_cents),{status:statuses[r.status],ok:r.status==='available'}, writable?action(r):'—']));
  if(kind==='contacts')holder.replaceChildren(rowsTable(['Nome','Perfil','Contato','Cadastro','Ações'],data,r=>[
   r.full_name,({lead:'Interessado',buyer:'Comprador',tenant:'Locatário',owner:'Proprietário',other:'Outro'})[r.kind]||r.kind,
   r.phone||r.email||'—',day(r.created_at),action(r)]));
  if(kind==='leads')holder.replaceChildren(rowsTable(['Cliente','Imóvel','Etapa','Origem','Cadastro','Ações'],data,r=>[
   contactName(r.contact_id),propertyName(r.property_id),{status:statuses[r.stage],ok:r.stage==='won'},r.source,day(r.created_at),action(r)]));
  if(kind==='visits')holder.replaceChildren(rowsTable(['Data','Cliente','Imóvel','Situação','Ações'],data,r=>[
   dateTime(r.scheduled_at),contactName(r.contact_id),propertyName(r.property_id),
   {status:statuses[r.status],ok:r.status==='completed',warn:r.status==='cancelled'},action(r)]));
 }
 search.addEventListener('input',draw);draw();return content;
}
function inputField(f,value){
 const label=el('label','field'+(f.wide?' wide':''));
 label.append(el('span','',f.label));
 const input=document.createElement(f.kind==='select'?'select':f.kind==='textarea'?'textarea':'input');
 input.name=f.key;
 if(f.kind==='select'){for(const [v,t] of f.options){const option=el('option','',t);option.value=v;input.append(option);}}
 else if(f.kind==='textarea'){input.rows=3;}
 else {input.type=f.kind||'text';input.maxLength=f.max||250;}
 input.required=Boolean(f.required);
 if(f.placeholder)input.placeholder=f.placeholder;
 if(f.readonly)input.disabled=true;
 input.value=value==null?'':String(value);
 label.append(input);
 return label;
}
function schema(kind,row){
 const contactOptions=[['','Selecione um contato'],...appState.data.contacts.map(x=>[x.id,x.full_name])];
 const propertyOptions=[['','Selecione um imóvel'],...appState.data.properties.map(x=>[x.id,x.title])];
 if(kind==='properties')return [
  {key:'title',label:'Título do imóvel',required:true,wide:true},
  {key:'property_type',label:'Tipo do imóvel',kind:'select',options:Object.entries(types)},
  {key:'purpose',label:'Finalidade',kind:'select',options:[['sale','Venda'],['rent','Aluguel'],['both','Venda e aluguel']]},
  {key:'city',label:'Cidade',required:true},
  {key:'neighborhood',label:'Bairro'},
  {key:'sale_price',label:'Valor de venda (R$)',placeholder:'Ex.: 250000,00'},
  {key:'rental_price',label:'Aluguel mensal (R$)',placeholder:'Ex.: 1500,00'},
  {key:'bedrooms',label:'Quartos',kind:'number'},
  {key:'bathrooms',label:'Banheiros',kind:'number'},
  {key:'parking_spaces',label:'Vagas',kind:'number'},
  {key:'area_m2',label:'Área (m²)',kind:'number'},
  {key:'status',label:'Situação',kind:'select',options:Object.entries(statuses).filter(([k])=>['available','reserved','rented','sold','inactive'].includes(k))},
  {key:'description',label:'Descrição',kind:'textarea',wide:true}
 ];
 if(kind==='contacts')return [
  {key:'full_name',label:'Nome completo',required:true,wide:true},
  {key:'kind',label:'Perfil',kind:'select',options:[['lead','Interessado'],['buyer','Comprador'],['tenant','Locatário'],['owner','Proprietário'],['other','Outro']]},
  {key:'phone',label:'Telefone ou WhatsApp'},
  {key:'email',label:'E-mail',kind:'email'},
  {key:'notes',label:'Observações',kind:'textarea',wide:true}
 ];
 if(kind==='leads')return [
  {key:'contact_id',label:'Cliente ou interessado',kind:'select',options:contactOptions,required:true,wide:true},
  {key:'property_id',label:'Imóvel',kind:'select',options:propertyOptions,wide:true},
  {key:'stage',label:'Etapa da negociação',kind:'select',options:[['new','Novo'],['contacted','Em contato'],['visit','Visita'],['proposal','Proposta'],['won','Concluído'],['lost','Perdido']]},
  {key:'source',label:'Origem',kind:'select',options:[['manual','Manual'],['site','Site'],['whatsapp','WhatsApp'],['other','Outro']]},
  {key:'notes',label:'Observações',kind:'textarea',wide:true}
 ];
 return [
  {key:'contact_id',label:'Cliente',kind:'select',options:contactOptions,required:true,wide:true},
  {key:'property_id',label:'Imóvel',kind:'select',options:propertyOptions,required:true,wide:true},
  {key:'scheduled_at',label:'Data e horário da visita',kind:'datetime-local',required:true,wide:true},
  {key:'status',label:'Situação',kind:'select',options:[['scheduled','Agendada'],['completed','Realizada'],['cancelled','Cancelada']]},
  {key:'notes',label:'Observações',kind:'textarea',wide:true}
 ];
}
function openForm(kind,row=null){
 if(kind==='properties'&&!['owner','manager'].includes(appState.member.role))return;
 if(kind==='leads'&&!appState.data.contacts.length){appState.feedback='Cadastre primeiro um cliente em Clientes e proprietários.';appState.section='contacts';renderSection();return;}
 if(kind==='visits'&&(!appState.data.contacts.length||!appState.data.properties.length)){
  appState.feedback='Para agendar uma visita, cadastre antes um cliente e um imóvel.';appState.section=appState.data.contacts.length?'properties':'contacts';renderSection();return;
 }
 const labels={properties:'imóvel',contacts:'contato',leads:'oportunidade',visits:'visita'};
 const overlay=el('div','overlay'),dialog=el('div','dialog');
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 const h=el('header'),headline=el('div');
 headline.append(el('h2','',(row?'Editar ':'Cadastrar ')+labels[kind]),el('p','helper','Informações disponíveis somente para esta imobiliária.'));
 const close=el('button','close','×');close.setAttribute('aria-label','Fechar');close.type='button';
 const dismiss=()=>overlay.remove();close.addEventListener('click',dismiss);
 h.append(headline,close);dialog.append(h);
 const form=el('form'),grid=el('div','form-grid'),errors=el('div');
 const fields=schema(kind,row),defaults={property_type:'house',purpose:'sale',status:kind==='properties'?'available':'scheduled',
 bedrooms:0,bathrooms:0,parking_spaces:0,kind:'lead',stage:'new',source:'manual'};
 for(const field of fields){
  let value=row?.[field.key]??defaults[field.key]??'';
  if(field.key==='sale_price')value=moneyInput(row?.sale_price_cents);
  if(field.key==='rental_price')value=moneyInput(row?.rental_price_cents);
  if(field.key==='scheduled_at'&&value)value=localDateTimeValue(value);
  grid.append(inputField(field,value));
 }
 const footer=el('div','dialog-footer'),cancel=el('button','secondary','Cancelar'),save=el('button','primary',row?'Salvar alterações':'Cadastrar');
 cancel.type='button';cancel.addEventListener('click',dismiss);save.type='submit';
 footer.append(cancel,save);form.append(grid,errors,footer);dialog.append(form);overlay.append(dialog);
 overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});document.body.append(overlay);
 form.addEventListener('submit',async e=>{
  e.preventDefault();save.disabled=true;errors.replaceChildren();
  const fd=new FormData(form),data=Object.fromEntries(fd.entries());
  try{
   if(kind==='properties'){
    data.sale_price_cents=toCents(data.sale_price,true);
    data.rental_price_cents=toCents(data.rental_price,true);
    delete data.sale_price;delete data.rental_price;
    if((data.purpose==='sale'||data.purpose==='both')&&data.sale_price_cents==null)throw Error('Informe o valor de venda.');
    if((data.purpose==='rent'||data.purpose==='both')&&data.rental_price_cents==null)throw Error('Informe o valor mensal do aluguel.');
    for(const key of ['bedrooms','bathrooms','parking_spaces'])data[key]=Number(data[key]||0);
    data.area_m2=data.area_m2?Number(data.area_m2):null;
   }
   if(kind==='leads'&&!data.property_id)data.property_id=null;
   if(kind==='visits')data.scheduled_at=new Date(data.scheduled_at).toISOString();
   for(const k of Object.keys(data))if(data[k]==='')data[k]=null;
   // O banco confirma a persistencia e valida a imobiliaria pela politica RLS.
   await mutate(kind,data,row?.id);
   dismiss();
   appState.feedback=labels[kind][0].toUpperCase()+labels[kind].slice(1)+(row?' atualizado':' cadastrado')+' com sucesso.';
   try{await reloadData();}catch{appState.feedback+=' O registro foi salvo, mas a lista não pôde ser atualizada. Clique em Atualizar.';}
   renderSection();
  }catch(err){errors.replaceChildren(el('div','notice error',err.message));}
  finally{save.disabled=false;}
 });
 grid.querySelector('input,select,textarea')?.focus();
}
function future(section){
 const descriptions={
  rentals:['Locações e contratos','Contratos, cobranças recorrentes, vencimentos, reajustes e histórico de cada locação.'],
  finance:['Financeiro e repasses','Receitas, despesas, valores a receber, inadimplência e repasses aos proprietários.'],
  agents:['Corretores','Perfis de corretores, permissões e desempenho por negociação.'],
  documents:['Documentos','Arquivos e contratos vinculados aos clientes e imóveis.'],
  reports:['Relatórios','Resultados financeiros, vendas, locações e produtividade da equipe.'],
  settings:['Configurações','Dados da imobiliária, identidade visual, acessos e assinatura VILLE.']
 };
 const [title,desc]=descriptions[section];
 const div=el('div');div.append(sectionHeading(title,'Expansão planejada da gestão.'));
 const panel=el('section','panel future');
 panel.append(el('span','eyebrow','PRÓXIMO MÓDULO'),el('h2','',title),el('p','',desc),
  el('p','', 'Esta área ainda está em desenvolvimento. Nenhum registro é criado ou alterado enquanto a funcionalidade não estiver pronta.'));
 div.append(panel);return div;
}

function showHistory(property){
 const overlay=el('div','overlay'),dialog=el('div','dialog');
 const head=el('header'),title=el('div');
 title.append(el('h2','','Histórico do imóvel'),el('p','helper',property.title));
 const close=el('button','close','×');close.type='button';close.addEventListener('click',()=>overlay.remove());
 head.append(title,close);dialog.append(head);
 const events=appState.data.property_events.filter(e=>e.property_id===property.id);
 const panelHistory=el('div');
 if(!events.length)panelHistory.append(el('p','helper','Ainda não há alterações registradas.'));
 for(const event of events){
  const box=el('section','history-item');
  box.append(el('strong','',event.action==='created'?'Imóvel cadastrado':'Situação ou preço atualizado'));
  box.append(el('small','',dateTime(event.created_at)));
  const details=event.details||{};
  const description=Object.entries(details).map(([k,v])=>{
    const label={status:'Situação',before_status:'Situação anterior',after_status:'Nova situação',
     before_sale_cents:'Venda anterior',after_sale_cents:'Nova venda',
     before_rent_cents:'Aluguel anterior',after_rent_cents:'Novo aluguel'}[k]||k;
    const value=k.includes('cents')?money(v):statuses[v]||v;
    return label+': '+value;
  }).join(' · ');
  box.append(el('p','helper',description||'Registro de alteração'));
  panelHistory.append(box);
 }
 dialog.append(panelHistory);overlay.append(dialog);
 overlay.addEventListener('click',ev=>{if(ev.target===overlay)overlay.remove();});
 document.body.append(overlay);
}
function buildAlerts(){
 const result=[],today=new Date(),monthMs=86400000;
 for(const charge of appState.data.rent_charges){
  if(charge.status==='open'&&new Date(charge.due_on+'T23:59:59')<today)
   result.push('Aluguel vencido em '+day(charge.due_on)+': '+money(charge.amount_cents)+' — '+propertyName(appState.data.rental_contracts.find(c=>c.id===charge.contract_id)?.property_id));
 }
 for(const c of appState.data.rental_contracts){
  if(c.status!=='active')continue;
  const days=(new Date(c.end_on+'T23:59:59')-today)/monthMs;
  if(days>=0&&days<=30)result.push('Contrato próximo do fim: '+propertyName(c.property_id)+' — '+day(c.end_on));
 }
 for(const visit of appState.data.visits){
  if(visit.status!=='scheduled')continue;
  const diff=(new Date(visit.scheduled_at)-today)/monthMs;
  if(diff>=0&&diff<=1)result.push('Visita nas próximas 24 horas: '+propertyName(visit.property_id)+' — '+dateTime(visit.scheduled_at));
 }
 return result;
}
function futurePanel(title,description){
 const p=panel(title,description);return p;
}
function dialogForm(title,fields,saveLabel,onSave,description=''){
 const overlay=el('div','overlay'),dialog=el('div','dialog');
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 const h=el('header'),intro=el('div');
 intro.append(el('h2','',title),el('p','helper',description));
 const close=el('button','close','×');close.type='button';
 const dismiss=()=>overlay.remove();
 close.addEventListener('click',dismiss);h.append(intro,close);dialog.append(h);
 const form=el('form'),grid=el('div','form-grid'),feedback=el('div');
 for(const f of fields)grid.append(inputField(f,f.value??''));
 const bottom=el('div','dialog-footer'),cancel=el('button','secondary','Cancelar'),submit=el('button','primary',saveLabel);
 cancel.type='button';cancel.addEventListener('click',dismiss);submit.type='submit';
 bottom.append(cancel,submit);form.append(grid,feedback,bottom);dialog.append(form);
 overlay.append(dialog);document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  submit.disabled=true;feedback.replaceChildren();
  try{
   await onSave(Object.fromEntries(new FormData(form).entries()),grid);
   dismiss();
   try{await reloadData();appState.feedback='Operação concluída e registrada com sucesso.';}
   catch{appState.feedback='Operação salva. Não foi possível atualizar a lista agora.';}
   renderSection();
  }catch(err){feedback.replaceChildren(el('p','notice error',err.message));}
  finally{submit.disabled=false;}
 });
 grid.querySelector('input,select,textarea')?.focus();
}
const contactOptions=filter=>[['','Selecione'],...appState.data.contacts.filter(filter||(()=>true)).map(x=>[x.id,x.full_name])];
const propertyOptions=()=>[['','Selecione'],...appState.data.properties.map(x=>[x.id,x.title])];
function rentalContractDialog(){
 if(!appState.data.properties.length||appState.data.contacts.length<2){
  appState.feedback='Cadastre primeiro um imóvel e pelo menos dois contatos (locatário e proprietário).';
  appState.section=appState.data.properties.length?'contacts':'properties';renderSection();return;
 }
 dialogForm('Cadastrar contrato de locação',[
  {key:'property_id',label:'Imóvel',kind:'select',options:propertyOptions(),required:true,wide:true},
  {key:'tenant_contact_id',label:'Locatário',kind:'select',options:contactOptions(),required:true},
  {key:'owner_contact_id',label:'Proprietário',kind:'select',options:contactOptions(),required:true},
  {key:'start_on',label:'Início',kind:'date',required:true},
  {key:'end_on',label:'Fim',kind:'date',required:true},
  {key:'monthly_rent',label:'Aluguel mensal (R$)',required:true,placeholder:'1500,00'},
  {key:'administration_fee_percent',label:'Administração (%)',kind:'number',value:'10',required:true},
  {key:'due_day',label:'Dia do vencimento',kind:'number',value:'10',required:true},
  {key:'status',label:'Situação',kind:'select',options:[['draft','Rascunho'],['active','Ativo']],wide:true},
  {key:'notes',label:'Observações',kind:'textarea',wide:true}
 ],'Salvar contrato',async v=>{
  if(v.tenant_contact_id===v.owner_contact_id)throw Error('Locatário e proprietário devem ser pessoas distintas.');
  if(v.end_on<v.start_on)throw Error('A data final não pode ser anterior ao início.');
  const pct=Number(v.administration_fee_percent);
  if(!Number.isFinite(pct)||pct<0||pct>100)throw Error('Taxa de administração inválida.');
  const daynum=Number(v.due_day);
  if(!Number.isInteger(daynum)||daynum<1||daynum>28)throw Error('Dia de vencimento entre 1 e 28.');
  await mutate('rental_contracts',{property_id:v.property_id,tenant_contact_id:v.tenant_contact_id,
   owner_contact_id:v.owner_contact_id,start_on:v.start_on,end_on:v.end_on,
   monthly_rent_cents:toCents(v.monthly_rent),administration_fee_percent:pct,due_day:daynum,
   status:v.status,notes:v.notes||null});
 },'Ao ativar, o sistema gera até 12 mensalidades dentro do prazo do contrato.');
}
function activateContract(contract){
 if(contract.status!=='draft')return;
 if(!window.confirm('Ativar contrato e gerar mensalidades automaticamente?'))return;
 asyncOperation(async()=>{
  await mutate('rental_contracts',{status:'active'},contract.id);
 },'Contrato ativado.');
}
function markChargePaid(charge){
 if(charge.status!=='open')return;
 if(!window.confirm('Confirmar recebimento de '+money(charge.amount_cents)+'? Esta ação gerará o repasse ao proprietário e não poderá ser desfeita por esta tela.'))return;
 asyncOperation(async()=>{await mutate('rent_charges',{status:'paid',paid_on:localDate()},charge.id);},'Aluguel confirmado como recebido. Repasse calculado automaticamente.');
}
function markPayoutPaid(payout){
 if(payout.status!=='pending')return;
 if(!window.confirm('O valor de '+money(payout.net_cents)+' já foi realmente repassado ao proprietário?'))return;
 asyncOperation(async()=>{await mutate('owner_payouts',{status:'paid',paid_on:localDate()},payout.id);},'Repasse marcado como pago.');
}
async function asyncOperation(fn,ok){
 try{await fn();appState.feedback=ok;try{await reloadData();}catch{appState.feedback+=' Atualize a página para ver os dados.';}renderSection();}
 catch(err){appState.feedback='Não foi possível concluir: '+err.message;renderSection();}
}
function rentalScreen(){
 const content=el('div'),canEdit=['owner','manager'].includes(appState.member.role);
 content.append(sectionHeading('Locações e contratos','Acompanhe contratos e recebimentos mensais.',canEdit?rentalContractDialog:null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 const contracts=panel('Contratos registrados','Até 12 mensalidades geradas automaticamente na ativação.');
 contracts.append(rowsTable(['Imóvel','Locatário','Proprietário','Aluguel','Vigência','Situação','Ações'],appState.data.rental_contracts,c=>[
  propertyName(c.property_id),contactName(c.tenant_contact_id),contactName(c.owner_contact_id),money(c.monthly_rent_cents),
  day(c.start_on)+' até '+day(c.end_on),{status:({draft:'Rascunho',active:'Ativo',ended:'Finalizado',cancelled:'Cancelado'})[c.status],ok:c.status==='active'},
  canEdit&&c.status==='draft'?{actions:[['Ativar',()=>activateContract(c)]]}:'—'
 ]));content.append(contracts);
 const charges=panel('Cobranças de aluguel','Marque como recebido somente após confirmar o pagamento.');
 charges.style.marginTop='18px';
 charges.append(rowsTable(['Imóvel','Vencimento','Valor','Situação','Ações'],appState.data.rent_charges,c=>[
  propertyName(appState.data.rental_contracts.find(r=>r.id===c.contract_id)?.property_id),
  day(c.due_on),money(c.amount_cents),
  {status:c.status==='paid'?'Recebido':c.status==='cancelled'?'Cancelado':'A receber',ok:c.status==='paid',warn:c.status==='open'&&new Date(c.due_on)<new Date()},
  canEdit&&c.status==='open'?{actions:[['Confirmar pagamento',()=>markChargePaid(c)]]}:'—'
 ]));content.append(charges);return content;
}
function financialEntryDialog(){
 dialogForm('Novo lançamento financeiro',[
  {key:'direction',label:'Tipo',kind:'select',options:[['expense','Despesa'],['income','Receita']]},
  {key:'category',label:'Categoria',required:true,placeholder:'Ex.: manutenção'},
  {key:'description',label:'Descrição',required:true,wide:true},
  {key:'amount',label:'Valor (R$)',required:true,placeholder:'Ex.: 250,00'},
  {key:'occurred_on',label:'Data',kind:'date',value:localDate(),required:true}
 ],'Registrar lançamento',async v=>{
  await mutate('finance_entries',{direction:v.direction,category:v.category.trim(),
   description:v.description.trim(),amount_cents:toCents(v.amount),occurred_on:v.occurred_on});
 },'Lançamentos manuais não devem duplicar os aluguéis registrados no módulo de locações.');
}

function saleDialog(){
 const available=appState.data.properties.filter(x=>x.status!=='sold');
 if(!available.length||!appState.data.contacts.length){
  appState.feedback='Cadastre ao menos um imóvel disponível e um comprador antes de registrar a venda.';
  appState.section=available.length?'contacts':'properties';renderSection();return;
 }
 dialogForm('Registrar venda concluída',[
  {key:'property_id',label:'Imóvel vendido',kind:'select',wide:true,required:true,
    options:[['','Selecione'],...available.map(p=>[p.id,p.title])]},
  {key:'buyer_contact_id',label:'Comprador',kind:'select',wide:true,required:true,options:contactOptions()},
  {key:'agent_user_id',label:'Corretor responsável (opcional)',kind:'select',wide:true,
   options:[['','Não informado'],...appState.data.staff.map(a=>[a.user_id,a.email])]},
  {key:'sold_on',label:'Data da venda',kind:'date',required:true,value:localDate()},
  {key:'sale_price',label:'Valor da venda (R$)',required:true,placeholder:'250000,00'},
  {key:'commission_percent',label:'Comissão (%)',kind:'number',required:true,value:'5'},
  {key:'notes',label:'Observações',kind:'textarea',wide:true}
 ],'Registrar venda',async v=>{
  const percent=Number(v.commission_percent);
  if(!Number.isFinite(percent)||percent<0||percent>100)throw Error('Comissão deve estar entre 0% e 100%.');
  await mutate('property_sales',{property_id:v.property_id,buyer_contact_id:v.buyer_contact_id,
    agent_user_id:v.agent_user_id||null,sold_on:v.sold_on,
    sale_price_cents:toCents(v.sale_price),commission_percent:percent,
    notes:v.notes||null});
 },'Ao salvar, a venda será registrada e o imóvel passará para Vendido. A comissão é calculada, não paga automaticamente.');
}
function salesScreen(){
 const manager=['owner','manager'].includes(appState.member.role),content=el('div');
 content.append(sectionHeading('Vendas e comissões','Histórico de vendas concluídas e valores de comissão.',manager?saleDialog:null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 const sales=appState.data.property_sales;
 const volume=sales.reduce((s,x)=>s+Number(x.sale_price_cents),0);
 const commission=sales.reduce((s,x)=>s+Number(x.commission_cents),0);
 const stats=el('div','grid4');
 for(const [title,value] of [['Vendas registradas',sales.length],['Volume total vendido',money(volume)],['Comissões calculadas',money(commission)]]){
  const card=el('div','stat');card.append(el('span','',title),el('strong','',value));stats.append(card);
 }
 content.append(stats);
 const p=panel('Histórico de vendas','A venda registrada atualiza automaticamente a situação do imóvel.');p.style.marginTop='17px';
 p.append(rowsTable(['Imóvel','Comprador','Corretor','Valor','Comissão','Data'],sales,s=>[
  propertyName(s.property_id),contactName(s.buyer_contact_id),
  appState.data.staff.find(a=>a.user_id===s.agent_user_id)?.email||'Não informado',
  money(s.sale_price_cents),money(s.commission_cents),day(s.sold_on)]));
 content.append(p);
 content.append(el('p','tip','O volume de vendas não equivale à receita da imobiliária. Comissões são valores calculados, sem comprovação de recebimento.'));
 return content;
}

function financeScreen(){
 const canEdit=['owner','manager'].includes(appState.member.role);
 const content=el('div');content.append(sectionHeading('Financeiro e repasses','Acompanhe recebimentos, lançamentos e valores dos proprietários.',canEdit?financialEntryDialog:null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 if(!canEdit){content.append(el('div','alert-banner','Acesso financeiro exclusivo de proprietários e gestores.'));return content;}
 const rentalReceived=appState.data.rent_charges.filter(c=>c.status==='paid').reduce((s,c)=>s+Number(c.amount_cents),0);
 const manualIncome=appState.data.finance_entries.filter(e=>e.direction==='income').reduce((s,e)=>s+Number(e.amount_cents),0);
 const manualExpense=appState.data.finance_entries.filter(e=>e.direction==='expense').reduce((s,e)=>s+Number(e.amount_cents),0);
 const toReceive=appState.data.rent_charges.filter(c=>c.status==='open').reduce((s,c)=>s+Number(c.amount_cents),0);
 const toPayout=appState.data.owner_payouts.filter(p=>p.status==='pending').reduce((s,p)=>s+Number(p.net_cents),0);
 const cards=el('div','grid4');
 for(const [label,value] of [['Recebimentos registrados',rentalReceived+manualIncome],['Despesas registradas',manualExpense],['Aluguéis a receber',toReceive],['Repasses pendentes',toPayout]]){
  const c=el('div','stat');c.append(el('span','',label),el('strong','',money(value)),el('small','','Valores históricos cadastrados'));cards.append(c);
 }
 content.append(cards);
 const entries=panel('Lançamentos financeiros','Receitas e despesas manuais');
 entries.style.marginTop='17px';
 entries.append(rowsTable(['Data','Tipo','Categoria','Descrição','Valor'],appState.data.finance_entries,r=>[
  day(r.occurred_on),r.direction==='income'?'Receita':'Despesa',r.category,r.description,money(r.amount_cents)
 ]));content.append(entries);
 const payout=panel('Repasses aos proprietários','Gerados automaticamente após o recebimento de um aluguel.');payout.style.marginTop='17px';
 payout.append(rowsTable(['Proprietário','Bruto','Administração','Líquido','Situação','Ação'],appState.data.owner_payouts,r=>[
  contactName(r.owner_contact_id),money(r.gross_cents),money(r.administration_fee_cents),money(r.net_cents),
  {status:r.status==='paid'?'Pago':'Pendente',ok:r.status==='paid'},
  r.status==='pending'?{actions:[['Confirmar repasse',()=>markPayoutPaid(r)]]}:'—'
 ]));content.append(payout);
 content.append(el('p','tip','Este módulo registra movimentações e repasses; não faz transferências bancárias, Pix nem conciliação automática.'));
 return content;
}
function staffDialog(){
 dialogForm('Adicionar membro da equipe',[
  {key:'email',label:'E-mail da conta já confirmada',kind:'email',required:true,wide:true},
  {key:'role',label:'Permissão',kind:'select',options:[['agent','Corretor'],['manager','Gestor']],wide:true}
 ],'Vincular conta',async v=>{
  await request('/rest/v1/rpc/agency_assign_staff',{method:'POST',
   data:{p_tenant_id:appState.tenant.id,p_email:v.email.trim().toLowerCase(),p_role:v.role}});
 },'O profissional deve antes criar a conta no VILLE e confirmar seu e-mail.');
}
function removeStaff(member){
 if(!window.confirm('Remover o acesso de '+member.email+'?'))return;
 asyncOperation(async()=>await request('/rest/v1/rpc/agency_remove_staff',{method:'POST',
  data:{p_tenant_id:appState.tenant.id,p_user_id:member.user_id}}),'Acesso do colaborador removido.');
}
function agentsScreen(){
 const owner=appState.member.role==='owner',manager=appState.member.role==='manager';
 const content=el('div');
 content.append(sectionHeading('Corretores e equipe','Gerencie quem pode acessar os dados da imobiliária.',owner?staffDialog:null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 if(!owner&&!manager){content.append(el('div','alert-banner','Somente proprietários e gestores podem consultar a equipe.'));return content;}
 const p=panel('Profissionais vinculados','Proprietário e gestor têm acesso financeiro; corretores acessam imóveis, CRM e visitas.');
 p.append(rowsTable(['E-mail','Função','Vinculado em','Ações'],appState.data.staff,r=>[
  r.email,({owner:'Proprietário',manager:'Gestor',agent:'Corretor'})[r.role]||r.role,
  day(r.created_at),owner&&r.role!=='owner'?{actions:[['Remover',()=>removeStaff(r)]]}:'—'
 ]));content.append(p);
 content.append(el('p','tip','Para adicionar um profissional, ele deve primeiro se cadastrar na página de acesso e confirmar o e-mail. Cada pessoa usa sua própria senha.'));
 return content;
}
function documentsScreen(){
 const content=el('div'),manager=['owner','manager'].includes(appState.member.role);
 content.append(sectionHeading('Documentos','Arquivos privados vinculados aos imóveis e clientes.',manager?openDocumentDialog:null));
 if(appState.feedback){content.append(el('div','notice',appState.feedback));appState.feedback='';}
 if(!manager){content.append(el('div','alert-banner','Documentos disponíveis somente para proprietários e gestores.'));return content;}
 const p=panel('Arquivos da imobiliária','PDF, JPG, PNG ou WEBP, até 10 MB. Acesso autenticado.');
 p.append(rowsTable(['Documento','Imóvel','Cliente','Data','Ação'],appState.data.documents,d=>[
  d.title,propertyName(d.property_id),contactName(d.contact_id),day(d.created_at),
  {actions:[['Abrir',()=>openDocument(d)]]}
 ]));content.append(p);return content;
}
function openDocumentDialog(){
 const overlay=el('div','overlay'),dialog=el('div','dialog'),head=el('header'),intro=el('div');
 intro.append(el('h2','','Adicionar documento'),el('p','helper','Arquivo privado em armazenamento protegido.'));
 const close=el('button','close','×');close.type='button';close.addEventListener('click',()=>overlay.remove());
 head.append(intro,close);dialog.append(head);
 const form=el('form'),grid=el('div','form-grid');
 grid.append(inputField({key:'title',label:'Nome do documento',required:true,wide:true},''));
 grid.append(inputField({key:'property_id',label:'Imóvel (opcional)',kind:'select',options:[['','Nenhum'],...propertyOptions().slice(1)]},''));
 grid.append(inputField({key:'contact_id',label:'Cliente (opcional)',kind:'select',options:[['','Nenhum'],...contactOptions().slice(1)]},''));
 const fileLabel=el('label','field wide');fileLabel.append(el('span','','Arquivo'));
 const file=document.createElement('input');file.type='file';file.name='file';file.required=true;file.accept='.pdf,.png,.jpg,.jpeg,.webp';
 fileLabel.append(file);grid.append(fileLabel);
 const feedback=el('div'),footer=el('div','dialog-footer'),cancel=el('button','secondary','Cancelar'),save=el('button','primary','Enviar documento');
 cancel.type='button';cancel.addEventListener('click',()=>overlay.remove());save.type='submit';footer.append(cancel,save);
 form.append(grid,feedback,footer);dialog.append(form);overlay.append(dialog);document.body.append(overlay);
 form.addEventListener('submit',async e=>{
  e.preventDefault();save.disabled=true;feedback.replaceChildren();
  try{
   const f=new FormData(form),picked=file.files?.[0];
   if(!picked)throw Error('Selecione um arquivo.');
   if(picked.size>10485760||picked.size<1)throw Error('Arquivo deve ter até 10 MB.');
   const types=['application/pdf','image/jpeg','image/png','image/webp'];
   if(!types.includes(picked.type))throw Error('Formato não permitido. Use PDF ou imagem.');
   const path=appState.tenant.id+'/'+crypto.randomUUID()+'-'+picked.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100);
   const url=config.supabaseUrl+'/storage/v1/object/ville-agency-docs/'+path.split('/').map(encodeURIComponent).join('/');
   const response=await fetch(url,{method:'POST',headers:{
    apikey:config.supabasePublishableKey,Authorization:'Bearer '+appState.session.access_token,
    'Content-Type':picked.type,'x-upsert':'false'},body:picked});
   if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.message||result.error||'Não foi possível enviar o arquivo.');}
   try{
    await mutate('documents',{title:esc(f.get('title')).trim(),storage_path:path,mime_type:picked.type,
     bytes:picked.size,property_id:f.get('property_id')||null,contact_id:f.get('contact_id')||null});
   }catch(e){throw Error('Arquivo enviado, mas não foi possível registrar o documento. Informe o suporte para revisar: '+e.message);}
   overlay.remove();appState.feedback='Documento enviado e registrado com sucesso.';
   await reloadData();renderSection();
  }catch(err){feedback.replaceChildren(el('div','notice error',err.message));}
  finally{save.disabled=false;}
 });
}
async function openDocument(doc){
 const link=el('a','notice','Preparando link seguro...');
 link.style.display='block';link.style.margin='14px 0';
 const area=root.querySelector('#content');
 area.prepend(link);
 try{
  const signed=await request('/storage/v1/object/sign/ville-agency-docs/'+doc.storage_path.split('/').map(encodeURIComponent).join('/'),
   {method:'POST',data:{expiresIn:60}});
  if(!signed?.signedURL)throw Error('O servidor não gerou o acesso temporário.');
  link.href=config.supabaseUrl+'/storage/v1'+signed.signedURL;
  link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='Abrir "'+doc.title+'" — link válido por 60 segundos';
 }catch(err){link.className='notice error';link.textContent='Não foi possível abrir o documento: '+err.message;}
}
function reportsScreen(){
 const content=el('div');content.append(sectionHeading('Relatórios','Indicadores reais da operação da imobiliária.'));
 const manager=['owner','manager'].includes(appState.member.role);
 const properties=appState.data.properties,leads=appState.data.leads,visits=appState.data.visits;
 const cards=el('div','grid4');
 const numbers=[
  ['Imóveis disponíveis',properties.filter(x=>x.status==='available').length],
  ['Vendas registradas',appState.data.property_sales.length],
  ['Locações registradas',properties.filter(x=>x.status==='rented').length],
  ['Visitas realizadas',visits.filter(x=>x.status==='completed').length]
 ];
 for(const [title,num] of numbers){const c=el('div','stat');c.append(el('span','',title),el('strong','',num));cards.append(c);}
 content.append(cards);
 const p=panel('Funil de atendimento','Distribuição atual das oportunidades.');p.style.marginTop='17px';
 const stages=[['new','Novo'],['contacted','Em contato'],['visit','Visita'],['proposal','Proposta'],['won','Concluído'],['lost','Perdido']];
 for(const [k,title] of stages){
  const line=el('div','summary-line');
  line.append(el('span','',title),el('strong','',leads.filter(l=>l.stage===k).length));p.append(line);
 }
 content.append(p);
 if(manager){
  const performance=panel('Atividade da equipe','Contagem de registros por criador; vendas vinculadas ao corretor.');
  performance.style.marginTop='17px';
  performance.append(rowsTable(['Profissional','CRM registrados','Visitas cadastradas','Vendas atribuídas','Comissões calculadas'],
   appState.data.staff,member=>{
    const sales=appState.data.property_sales.filter(x=>x.agent_user_id===member.user_id);
    return [member.email,
     appState.data.leads.filter(x=>x.created_by===member.user_id).length,
     appState.data.visits.filter(x=>x.created_by===member.user_id).length,
     sales.length,money(sales.reduce((sum,x)=>sum+Number(x.commission_cents),0))];
   }));
  content.append(performance);
 }
 if(manager){
  const totalIncome=appState.data.finance_entries.filter(x=>x.direction==='income').reduce((s,x)=>s+Number(x.amount_cents),0)
   +appState.data.rent_charges.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount_cents),0);
  const totalExpenses=appState.data.finance_entries.filter(x=>x.direction==='expense').reduce((s,x)=>s+Number(x.amount_cents),0);
  const fi=panel('Resumo financeiro','Valores históricos registrados, sem considerar tributos ou competência.');fi.style.marginTop='17px';
  fi.append(el('p','','Receitas registradas: '+money(totalIncome)));
  fi.append(el('p','','Despesas registradas: '+money(totalExpenses)));
  fi.append(el('strong','','Saldo operacional simples: '+money(totalIncome-totalExpenses)));
  content.append(fi);
 }
 return content;
}
function settingsScreen(){
 const content=el('div');content.append(sectionHeading('Configurações','Dados básicos e acesso à conta.'));
 const p=panel('Imobiliária','Informações cadastradas pela VILLE.');
 for(const [k,v] of [['Nome',appState.tenant.name],['Identificador',appState.tenant.slug],
 ['E-mail de acesso',appState.user.email],['Sua permissão',appState.member.role],
 ['Assinatura',appState.subscription?.status||'—'],['Fim do período gratuito',day(appState.subscription?.trial_ends_at)]]){
  const row=el('div','summary-line');row.append(el('span','',k),el('strong','',v));p.append(row);
 }
 content.append(p);content.append(el('p','tip','Alterações cadastrais e de faturamento são tratadas pela administração VILLE.'));
 return content;
}

function renderSection(){
 if(!root.querySelector('#content'))return;
 root.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===appState.section));
 const area=root.querySelector('#content');
 area.replaceChildren(appState.section==='dashboard'?dashboard():
  ['properties','contacts','leads','visits'].includes(appState.section)?listScreen(appState.section):
  appState.section==='sales'?salesScreen():
  appState.section==='rentals'?rentalScreen():
  appState.section==='finance'?financeScreen():
  appState.section==='agents'?agentsScreen():
  appState.section==='documents'?documentsScreen():
  appState.section==='reports'?reportsScreen():
  appState.section==='settings'?settingsScreen():future(appState.section));
}

function passwordResetScreen(){
 root.innerHTML=`<div class="login-wrap"><aside class="login-side"><div class="logo">VILLE<i>.</i><small>IMOBILIÁRIO</small></div>
 <div><h1>Seu acesso.<br>Sua segurança.</h1><p>Defina uma nova senha para continuar usando a gestão da imobiliária.</p></div>
 <small>Área de acesso protegida</small></aside><main class="login-main"><section class="login-card">
 <span class="eyebrow">VILLE • RECUPERAÇÃO</span><h2>Definir nova senha</h2>
 <p class="subtext">Escolha uma nova senha com pelo menos 12 caracteres.</p>
 <div id="reset-feedback"></div><form id="reset-password-form" class="form-grid">
 <label class="field wide">Nova senha<input name="password" type="password" minlength="12" autocomplete="new-password" required></label>
 <label class="field wide">Confirmar senha<input name="confirm" type="password" minlength="12" autocomplete="new-password" required></label>
 <div class="wide" style="grid-column:1/-1"><button class="primary" type="submit">Salvar nova senha</button></div>
 </form></section></main></div>`;
 const form=root.querySelector('#reset-password-form');
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=form.querySelector('button[type="submit"]');btn.disabled=true;
  const data=new FormData(form),password=esc(data.get('password'));
  const feedback=root.querySelector('#reset-feedback');feedback.replaceChildren();
  try{
   if(password.length<12)throw Error('Use pelo menos 12 caracteres.');
   if(password!==esc(data.get('confirm')))throw Error('As duas senhas precisam ser iguais.');
   await request('/auth/v1/user',{method:'PUT',data:{password}});
   saveSession({...appState.session,recovery:false});
   await bootstrap();
  }catch(err){feedback.replaceChildren(el('div','notice error',err.message));}
  finally{btn.disabled=false;}
 });
}

function recoverSessionFromUrl(){
 const params=new URLSearchParams(location.hash.slice(1));
 if(!params.has('access_token')||!params.has('refresh_token'))return false;
 saveSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token'),
  expires_at:Date.now()+Number(params.get('expires_in')||3600)*1000,recovery:params.get('type')==='recovery'});
 history.replaceState(null,'',location.pathname);
 return true;
}
const recovered=recoverSessionFromUrl();
if(recovered&&appState.session?.recovery){
 passwordResetScreen();
}else if(appState.session?.access_token){bootstrap();}else{loginScreen();}
