"use strict";
/**
 * VILLE Imobiliário — painel administrativo.
 * Apenas a chave PUBLICÁVEL é utilizada no navegador. O RLS é a autoridade.
 * Não usar service_role ou credenciais secretas nesta aplicação.
 */
const SUPABASE_URL = "https://yawwgscylcrqqbzqvfoc.supabase.co";
const PUBLIC_KEY = "sb_publishable_pJ-ekNDIq8zmLsAYr7AMHg_vmpJA4Dr";
const ALLOWED_SETUP_EMAIL = "villeimobiliario@gmail.com";
const AUTH_ENDPOINT = SUPABASE_URL + "/auth/v1";
const REST_ENDPOINT = SUPABASE_URL + "/rest/v1";
const SESSION_KEY = "ville_admin_session_v1";
let currentSession = null;
let authMode = "login";
let cache = {tenants:[], subscriptions:[], invoices:[], payments:[], plans:[], settings:null};
const $ = (id) => document.getElementById(id);
const hide = (id, yes=true) => $(id).classList.toggle("hidden",yes);
const text = (id,value) => {$(id).textContent = value ?? "—";};
const cash = (cents) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(cents)||0)/100);
const date = (value) => value ? new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(String(value).slice(0,10) + "T12:00:00Z")) : "—";
function notice(id,message,error=false){
  text(id,message);
  $(id).classList.toggle("error",error);
  hide(id,!message);
}
function setSession(session){
  currentSession=session;
  if(session) sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}
function restoreSession(){
  try{return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");}
  catch{return null;}
}
async function authRequest(path,method="POST",body=null,token=null){
  let response;
  try{
    response=await fetch(AUTH_ENDPOINT+path,{
      method,
      headers:{"apikey":PUBLIC_KEY,"Content-Type":"application/json",...(token?{"Authorization":"Bearer "+token}:{})},
      body:body?JSON.stringify(body):undefined,
      cache:"no-store"
    });
  }catch{throw new Error("Falha de conexão com a autenticação. Tente novamente.");}
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok) throw new Error(payload.msg || payload.error_description || payload.message || "Não foi possível concluir a operação.");
  return payload;
}
async function refreshSession(){
  const refresh=currentSession?.refresh_token;
  if(!refresh) throw new Error("Sua sessão expirou. Entre novamente.");
  const updated=await authRequest("/token?grant_type=refresh_token","POST",{refresh_token:refresh});
  if(!updated.access_token) throw new Error("Não foi possível renovar sua sessão.");
  setSession(updated);
  return updated;
}
async function accessToken(){
  if(!currentSession?.access_token) throw new Error("Acesso não autenticado.");
  const exp=Number(currentSession.expires_at || 0);
  if(exp && Date.now()/1000 > exp-90) await refreshSession();
  return currentSession.access_token;
}
async function query(table,select="*",order=null,limit=500){
  const url=new URL(REST_ENDPOINT+"/"+table);
  url.searchParams.set("select",select);
  if(order) url.searchParams.set("order",order);
  url.searchParams.set("limit",String(limit));
  const request=async(token)=>{
    let response;
    try{response=await fetch(url.toString(),{headers:{"apikey":PUBLIC_KEY,"Authorization":"Bearer "+token,"Accept":"application/json"},cache:"no-store"});}
    catch{throw new Error("Não foi possível conectar ao banco de dados.");}
    if(response.status===401) return {retry:true};
    if(!response.ok) throw new Error("Falha ao consultar "+table+" (HTTP "+response.status+").");
    return {data:await response.json()};
  };
  let result=await request(await accessToken());
  if(result.retry){await refreshSession(); result=await request(await accessToken());}
  if(result.retry) throw new Error("Sessão inválida. Entre novamente.");
  return result.data;
}
function showAuth(message="",error=false){
  hide("app-screen",true);
  hide("auth-screen",false);
  setMode("login");
  notice("auth-notice",message,error);
}
function setMode(mode){
  authMode=mode;
  const settings={
    login:["Acesse sua conta","Entre para acompanhar sua plataforma VILLE.","Entrar na plataforma"],
    setup:["Primeiro acesso","Crie sua senha para o e-mail administrador autorizado.","Criar acesso"],
    reset:["Recuperar acesso","Informe o e-mail cadastrado para receber um link de recuperação.","Enviar link"],
    password:["Definir nova senha","Escolha uma nova senha para a sua conta.","Salvar nova senha"]
  }[mode];
  text("auth-title",settings[0]);text("auth-description",settings[1]);text("auth-submit",settings[2]);
  const passwordRequired=mode!=="reset";
  hide("password",!passwordRequired);hide("password-label",!passwordRequired);
  $("password").required=passwordRequired;
  $("password").autocomplete=mode==="login"?"current-password":"new-password";
  hide("email",mode==="password");
  const label=$('email').previousElementSibling;
  label.style.display=mode==="password"?"none":"";
  $("email").required=mode!=="password";
  document.querySelector(".auth-links").style.display=mode==="password"?"none":"flex";
  notice("auth-notice","");
  if(mode==="setup") $("email").value=ALLOWED_SETUP_EMAIL;
}
async function loadDashboard(){
  // A configuração privada só é visível aos administradores pelo RLS.
  const rows=await query("platform_settings","trial_days,grace_days,pix_key,pix_recipient");
  if(rows.length!==1) throw new Error("Esta conta não possui permissão administrativa. Acesso negado.");
  cache.settings=rows[0];
  const responses=await Promise.all([
    query("tenants","id,name,slug,state,created_at","created_at.desc"),
    query("subscription_plans","id,name,monthly_price_cents,active"),
    query("subscriptions","tenant_id,plan_id,status,trial_ends_at,next_due_on,paid_until"),
    query("invoices","id,tenant_id,due_on,amount_cents,status"),
    query("payments","id,tenant_id,invoice_id,amount_cents,state,submitted_at","submitted_at.desc")
  ]);
  [cache.tenants,cache.plans,cache.subscriptions,cache.invoices,cache.payments]=responses;
  render();
  notice("data-notice","");
}
function emptyRow(tbody,cols,message){
  const row=document.createElement("tr");
  const cell=document.createElement("td");
  cell.colSpan=cols;
  cell.className="empty-cell";
  cell.textContent=message;
  row.appendChild(cell);
  tbody.appendChild(row);
}
function makeCell(row,value){
  const cell=document.createElement("td");
  cell.textContent=String(value??"—");
  row.appendChild(cell);
  return cell;
}
function makeBadge(row,value){
  const names={trial:"Em teste",active:"Ativa",past_due:"Vencida",suspended:"Suspensa",cancelled:"Cancelada",enabled:"Ativa",disabled:"Desativada",open:"Aberta",paid:"Paga",void:"Cancelada",submitted:"Em análise",approved:"Aprovado",rejected:"Rejeitado"};
  const td=document.createElement("td");
  const span=document.createElement("span");
  span.className="pill "+(value||"");
  span.textContent=names[value]||value||"—";
  td.appendChild(span);
  row.appendChild(td);
}
function paintTable(id,items,columns,fn){
  const body=$(id);
  body.replaceChildren();
  if(!items.length){emptyRow(body,columns,"Nenhum registro encontrado.");return;}
  items.forEach(item=>{const row=document.createElement("tr");fn(row,item);body.appendChild(row);});
}
function render(){
  const t=cache.tenants,s=cache.subscriptions,inv=cache.invoices,p=cache.payments,plans=cache.plans;
  const nameById=new Map(t.map(x=>[x.id,x.name]));
  const planById=new Map(plans.map(x=>[x.id,x]));
  text("stat-tenants",String(t.length));
  text("stat-active",String(s.filter(x=>x.status==="active").length));
  text("stat-trial",String(s.filter(x=>x.status==="trial").length));
  text("stat-open",String(inv.filter(x=>x.status==="open").length));
  text("stat-received",cash(inv.filter(x=>x.status==="paid").reduce((total,x)=>total+Number(x.amount_cents||0),0)));
  const mrr=s.filter(x=>x.status==="active").reduce((sum,x)=>sum+Number(planById.get(x.plan_id)?.monthly_price_cents||0),0);
  text("stat-mrr",cash(mrr));
  paintTable("recent-tenants",t.slice(0,5),3,(row,x)=>{makeCell(row,x.name);makeCell(row,date(x.created_at));makeBadge(row,x.state);});
  paintTable("all-tenants",t,4,(row,x)=>{makeCell(row,x.name);makeCell(row,x.slug);makeCell(row,date(x.created_at));makeBadge(row,x.state);});
  paintTable("all-subscriptions",s,4,(row,x)=>{makeCell(row,nameById.get(x.tenant_id)||"—");makeCell(row,planById.get(x.plan_id)?.name||"—");makeBadge(row,x.status);makeCell(row,date(x.next_due_on||x.trial_ends_at));});
  paintTable("all-payments",p,4,(row,x)=>{makeCell(row,nameById.get(x.tenant_id)||"—");makeCell(row,cash(x.amount_cents));makeBadge(row,x.state);makeCell(row,date(x.submitted_at));});
  const due=$("due-list");
  due.replaceChildren();
  const alerts=s.filter(x=>x.next_due_on || x.trial_ends_at).map(x=>({name:nameById.get(x.tenant_id)||"Imobiliária",due:x.next_due_on||x.trial_ends_at})).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4);
  if(!alerts.length){const p=document.createElement("p");p.className="muted";p.textContent="Nenhum vencimento cadastrado.";due.appendChild(p);}
  alerts.forEach(x=>{const div=document.createElement("div");div.className="due-item";const name=document.createElement("strong");name.textContent=x.name;const when=document.createElement("span");when.textContent=date(x.due);div.append(name,when);due.appendChild(div);});
  text("setting-trial",cache.settings.trial_days+" dias");
  text("setting-grace",cache.settings.grace_days+" dias");
  text("setting-pix",cache.settings.pix_key?"Sim":"Não");
}
function page(name){
  for(const item of document.querySelectorAll(".page"))item.classList.toggle("hidden",item.id!=="page-"+name);
  for(const item of document.querySelectorAll("[data-page]"))item.classList.toggle("active",item.dataset.page===name);
  text("page-title",({dashboard:"Visão geral",tenants:"Imobiliárias",subscriptions:"Assinaturas",payments:"Pagamentos",settings:"Configurações"})[name]);
}
async function openDashboard(){
  await loadDashboard();
  text("sidebar-email",ALLOWED_SETUP_EMAIL);
  hide("auth-screen",true);
  hide("app-screen",false);
  page("dashboard");
}
async function handleAuth(event){
  event.preventDefault();
  const button=$("auth-submit");
  const email=$("email").value.trim().toLowerCase();
  const password=$("password").value;
  button.disabled=true;
  notice("auth-notice","");
  try{
    if(authMode==="setup"){
      if(email!==ALLOWED_SETUP_EMAIL)throw new Error("O primeiro acesso é exclusivo para o e-mail administrador autorizado.");
      if(password.length<10)throw new Error("A senha deve ter no mínimo 10 caracteres.");
      await authRequest("/signup?redirect_to="+encodeURIComponent(location.origin+"/"),"POST",{email,password});
      setMode("login");
      notice("auth-notice","Se o cadastro for permitido, você receberá um e-mail para confirmar sua conta. Confirme antes de entrar.");
    } else if(authMode==="reset"){
      await authRequest("/recover?redirect_to="+encodeURIComponent(location.origin+"/"),"POST",{email});
      notice("auth-notice","Se o endereço estiver cadastrado, enviaremos um link de recuperação.");
    } else if(authMode==="password"){
      if(password.length<10)throw new Error("A nova senha deve ter ao menos 10 caracteres.");
      const token=await accessToken();
      await authRequest("/user","PUT",{password},token);
      setMode("login");
      notice("auth-notice","Senha atualizada. Entre novamente.");
      setSession(null);
    } else {
      const session=await authRequest("/token?grant_type=password","POST",{email,password});
      setSession(session);
      try{await openDashboard();}
      catch(e){setSession(null);throw e;}
    }
  }catch(error){notice("auth-notice",error.message||"Não foi possível continuar.",true);}
  finally{button.disabled=false;}
}
async function bootstrap(){
  $("auth-form").addEventListener("submit",handleAuth);
  $("setup-btn").addEventListener("click",()=>setMode("setup"));
  $("forgot-btn").addEventListener("click",()=>setMode("reset"));
  document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.page)));
  document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>page(b.dataset.go)));
  $("refresh-btn").addEventListener("click",async()=>{
    $("refresh-btn").disabled=true;
    try{await loadDashboard();}catch(e){notice("data-notice",e.message,true);}
    finally{$("refresh-btn").disabled=false;}
  });
  $("signout-btn").addEventListener("click",async()=>{
    try{if(currentSession?.access_token)await authRequest("/logout","POST",{},currentSession.access_token);}catch{}
    setSession(null);showAuth("Sessão encerrada.");
  });
  // Supabase may return session tokens after the user confirms their email.
  const params=new URLSearchParams(location.hash.startsWith("#")?location.hash.slice(1):"");
  if(params.get("access_token") && params.get("refresh_token")){
    setSession({
      access_token:params.get("access_token"),
      refresh_token:params.get("refresh_token"),
      expires_at:Math.floor(Date.now()/1000)+Number(params.get("expires_in")||3600),
      token_type:"bearer"
    });
    history.replaceState(null,"",location.pathname);
    if(params.get("type")==="recovery"){setMode("password");notice("auth-notice","Digite sua nova senha.");return;}
  }
  if(params.get("error_description")){history.replaceState(null,"",location.pathname);showAuth("Não foi possível confirmar o link de acesso. Solicite outro.",true);return;}
  currentSession=currentSession || restoreSession();
  if(currentSession){
    try{await openDashboard();return;}
    catch(error){setSession(null);showAuth(error.message,true);return;}
  }
  showAuth();
}
document.addEventListener("DOMContentLoaded",bootstrap);
