import {config} from '../config.js';
const root=document.querySelector('#app');
const tokenKey='ville_agency_session_v1';
const appState={session:null,user:null,member:null,tenant:null,subscription:null,section:'dashboard',data:{properties:[],contacts:[],leads:[],visits:[]},feedback:''};
const navigation=[
 ['dashboard','Visão geral'],['properties','Imóveis'],['contacts','Clientes e proprietários'],
 ['leads','CRM de interessados'],['visits','Agenda de visitas'],['rentals','Locações e contratos'],
 ['finance','Financeiro e repasses'],['agents','Corretores'],['documents','Documentos'],
 ['reports','Relatórios'],['settings','Configurações']
];
const statuses={available:'Disponível',reserved:'Reservado',rented:'Alugado',sold:'Vendido',inactive:'Inativo',
 new:'Novo',contacted:'Em contato',visit:'Visita',proposal:'Proposta',won:'Concluído',lost:'Perdido',
 scheduled:'Agendada',completed:'Realizada',cancelled:'Cancelada'};
const types={house:'Casa',apartment:'Apartamento',land:'Terreno',commercial:'Comercial',rural:'Rural',other:'Outro'};
const esc=(v)=>String(v??'');
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=esc(text);return e;};
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const moneyInput=c=>c==null?'':(Number(c)/100).toFixed(2).replace('.',',');
const day=x=>x?new Date(x).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
const dateTime=x=>x?new Date(x).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'—';
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
 const entries=await Promise.all(['properties','contacts','leads','visits'].map(n=>list(n,'*','order=created_at.desc&limit=500')));
 ['properties','contacts','leads','visits'].forEach((n,i)=>{appState.data[n]=entries[i];});
}
async function logout(){saveSession(null);appState.tenant=null;loginScreen();}
function renderShell(){
 root.innerHTML=`<div class="shell"><aside class="sidebar"><div class="logo">VILLE<i>.</i><small>IMOBILIÁRIO</small></div>
 <div class="nav-title">GESTÃO DA IMOBILIÁRIA</div><nav class="nav" id="nav"></nav>
 <div class="side-bottom"><button type="button" id="logout">Sair da conta</button></div></aside>
 <div class="main"><header class="topbar"><div style="display:flex;gap:14px;align-items:center"><button class="mobile-menu" id="mobile-menu" type="button">☰</button><div class="top-tenant"><strong id="top-name"></strong><small>Área de gestão • VILLE Imobiliário</small></div></div><div><strong id="top-role"></strong></div></header>
 <main class="content" id="content"></main></div></div>`;
 root.querySelector('#top-name').textContent=appState.tenant.name;
 root.querySelector('#top-role').textContent=({owner:'Proprietário',manager:'Gestor',agent:'Corretor'})[appState.member.role]||'Equipe';
 const nav=root.querySelector('#nav');
 navigation.forEach(([key,label])=>{const b=el('button','',label);b.type='button';b.dataset.section=key;b.addEventListener('click',()=>{appState.section=key;renderSection();root.querySelector('.shell').classList.remove('menu-open');});nav.append(b);});
 root.querySelector('#logout').addEventListener('click',logout);
 root.querySelector('#mobile-menu').addEventListener('click',()=>root.querySelector('.shell').classList.toggle('menu-open'));
 renderSection();
}
function sectionHeading(title,subtitle,onAdd){
 const head=el('div','page-title'),titles=el('div');
 titles.append(el('span','eyebrow','PAINEL DA IMOBILIÁRIA'),el('h1','',title),el('p','',subtitle));head.append(titles);
 if(onAdd){const b=el('button','primary','+ Novo registro');b.addEventListener('click',onAdd);head.append(b);}
 return head;
}
function panel(title,sub){const p=el('section','panel');p.append(el('h2','',title));if(sub)p.append(el('p','',sub));return p;}
function rowsTable(headers,rows,renderCells){
 const wrap=el('div','table-wrap'),table=el('table','data-table'),thead=el('thead'),hrow=el('tr'),tbody=el('tbody');
 for(const h of headers)hrow.append(el('th','',h));
 thead.append(hrow);table.append(thead);
 if(!rows.length){const tr=el('tr'),td=el('td','empty','Nenhum registro encontrado.');td.colSpan=headers.length;tr.append(td);tbody.append(tr);}
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
 const content=el('div');
 content.append(sectionHeading('Visão geral','Tudo o que importa para a operação da sua imobiliária.'));
 const {available,active,upcoming}=currentSummary();
 const stats=[
 ['Imóveis cadastrados',appState.data.properties.length,'Seu portfólio completo'],
 ['Imóveis disponíveis',available,'Prontos para negociação'],
 ['Oportunidades abertas',active,'Em acompanhamento'],
 ['Visitas agendadas',upcoming,'Próximas visitas']
 ];
 const g=el('div','grid4');for(const [title,num,foot] of stats){const c=el('section','stat');c.append(el('span','',title),el('strong','',num),el('small','',foot));g.append(c);}content.append(g);
 if(appState.subscription?.status==='trial')content.append(el('p','tip','Seu período gratuito está em andamento. Fim previsto: '+day(appState.subscription.trial_ends_at)+'.'));
 const two=el('div','two'),left=panel('Imóveis recentes','Últimos imóveis inseridos no sistema'),right=panel('Próximas visitas','Compromissos organizados por data');
 left.append(rowsTable(['Imóvel','Cidade','Situação'],appState.data.properties.slice(0,6),p=>[p.title,p.city,{status:statuses[p.status]||p.status,ok:p.status==='available'}]));
 const visits=appState.data.visits.filter(v=>v.status==='scheduled'&&new Date(v.scheduled_at)>=new Date()).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,6);
 right.append(rowsTable(['Data','Imóvel','Cliente'],visits,v=>[dateTime(v.scheduled_at),propertyName(v.property_id),contactName(v.contact_id)]));
 two.append(left,right);content.append(two);
 content.append(el('p','tip','Dashboard conectado ao Supabase. Os indicadores mostram exclusivamente dados cadastrados para esta imobiliária.'));
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
  const action=r=>({actions:[['Editar',()=>openForm(kind,r)]]});
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
  if(field.key==='scheduled_at'&&value)value=new Date(value).toISOString().slice(0,16);
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
function renderSection(){
 if(!root.querySelector('#content'))return;
 root.querySelectorAll('[data-section]').forEach(x=>x.classList.toggle('active',x.dataset.section===appState.section));
 const area=root.querySelector('#content');
 area.replaceChildren(appState.section==='dashboard'?dashboard():
  ['properties','contacts','leads','visits'].includes(appState.section)?listScreen(appState.section):future(appState.section));
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
 loginScreen('login','Seu link foi recebido. Por segurança, abra o formulário de recuperação no painel administrativo para definir uma nova senha.');
}else if(appState.session?.access_token){bootstrap();}else{loginScreen();}
