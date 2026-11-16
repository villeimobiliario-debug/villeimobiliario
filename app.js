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
async function rpc(name,params){
  const endpoint=REST_ENDPOINT+"/rpc/"+encodeURIComponent(name);
  const request=async(token)=>{
    let response;
    try{
      response=await fetch(endpoint,{
        method:"POST",cache:"no-store",
        headers:{"apikey":PUBLIC_KEY,"Authorization":"Bearer "+token,
          "Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(params)
      });
    }catch{throw new Error("Falha de conexão com o banco. Verifique sua internet.");}
    let payload=null;
    try{payload=await response.json();}catch{}
    if(response.status===401)return {retry:true};
    if(!response.ok){
      if(response.status===403)throw new Error("Você não possui permissão para executar esta operação.");
      if(payload?.code==="23505")throw new Error("Já existe um cadastro com esse identificador ou nome de plano.");
      throw new Error(payload?.message||"Não foi possível concluir a operação.");
    }
    return {data:payload};
  };
  let r=await request(await accessToken());
  if(r.retry){await refreshSession();r=await request(await accessToken());}
  if(r.retry)throw new Error("Sua sessão expirou. Entre novamente.");
  return r.data;
}
function slugify(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
}
function parseBrlToCents(value){
  const v=String(value||"").trim();
  if(!/^\d+([,.]\d{1,2})?$/.test(v))throw new Error("Informe um preço válido, como 197,00.");
  const [whole,frac=""]=v.replace(",",".").split(".");
  const cents=Number(whole)*100+Number((frac+"00").slice(0,2));
  if(!Number.isSafeInteger(cents)||cents<0||cents>100000000)throw new Error("Valor fora do limite permitido.");
  return cents;
}
const T_MODAL="tenant-modal",P_MODAL="plan-modal";
function showModal(id){
  hide(id,false);
  document.body.style.overflow="hidden";
  (id===T_MODAL?$("tenant-name"):$("plan-name")).focus();
}
function closeModal(id){
  hide(id,true);
  document.body.style.overflow="";
}
function formatContact(value){
  return String(value||"").trim();
}
function openCreateTenant(){
  $("tenant-form").reset();
  $("tenant-edit-id").value="";
  $("tenant-slug").disabled=false;
  hide("tenant-plan-field",false);
  $("tenant-plan").required=true;
  $("tenant-form-notice").classList.add("hidden");
  text("tenant-modal-title","Cadastrar imobiliária");
  text("save-tenant-btn","Cadastrar e iniciar teste");
  updatePlanOptions();
  if(!cache.plans.some(x=>x.active)){
    closeModal(T_MODAL);showModal(P_MODAL);
    notice("plan-form-notice","Crie primeiro um plano para vincular a nova imobiliária.");
    return;
  }
  showModal(T_MODAL);
}
function openEditTenant(id){
  const t=cache.tenants.find(x=>x.id===id);
  if(!t)throw new Error("Imobiliária não encontrada.");
  $("tenant-form").reset();
  $("tenant-edit-id").value=id;
  $("tenant-name").value=t.name||"";
  $("tenant-slug").value=t.slug||"";
  $("tenant-slug").disabled=true;
  $("tenant-contact-name").value=t.contact_name||"";
  $("tenant-contact-email").value=t.contact_email||"";
  $("tenant-contact-phone").value=t.contact_phone||"";
  hide("tenant-plan-field",true);
  $("tenant-plan").required=false;
  text("tenant-modal-title","Editar imobiliária");
  text("save-tenant-btn","Salvar alterações");
  notice("tenant-form-notice","");
  showModal(T_MODAL);
}
function updatePlanOptions(){
  const select=$("tenant-plan");
  const prior=select.value;
  select.replaceChildren();
  const first=document.createElement("option");
  first.value="";first.textContent="Selecione um plano";select.appendChild(first);
  cache.plans.filter(x=>x.active).forEach(p=>{
    const option=document.createElement("option");
    option.value=p.id;
    option.textContent=p.name+" — "+cash(p.monthly_price_cents)+"/mês";
    select.appendChild(option);
  });
  if([...select.options].some(x=>x.value===prior))select.value=prior;
}
async function savePlan(event){
  event.preventDefault();
  const btn=$("save-plan-btn");
  btn.disabled=true;
  notice("plan-form-notice","");
  try{
    const name=$("plan-name").value.trim();
    const cents=parseBrlToCents($("plan-price").value);
    if(name.length<2)throw new Error("Informe o nome do plano.");
    await rpc("admin_create_plan",{p_name:name,p_price_cents:cents});
    await loadDashboard();
    $("plan-form").reset();
    closeModal(P_MODAL);
    notice("data-notice","Plano criado. Já é possível cadastrar uma imobiliária.");
  }catch(e){notice("plan-form-notice",e.message,true);}
  finally{btn.disabled=false;}
}
async function saveTenant(event){
  event.preventDefault();
  const btn=$("save-tenant-btn");
  btn.disabled=true;
  notice("tenant-form-notice","");
  try{
    const id=$("tenant-edit-id").value;
    const name=formatContact($("tenant-name").value);
    const contactName=formatContact($("tenant-contact-name").value);
    const contactEmail=formatContact($("tenant-contact-email").value).toLowerCase();
    const contactPhone=formatContact($("tenant-contact-phone").value);
    if(name.length<2||contactName.length<2||!contactEmail)throw new Error("Preencha os campos obrigatórios.");
    const common={p_name:name,p_contact_name:contactName,p_contact_email:contactEmail,p_contact_phone:contactPhone};
    if(id)await rpc("admin_update_tenant",{p_tenant_id:id,...common});
    else{
      const slug=$("tenant-slug").value.trim();
      const plan=$("tenant-plan").value;
      if(!slug||!plan)throw new Error("Informe o identificador e escolha um plano.");
      await rpc("admin_create_tenant",{...common,p_slug:slug,p_plan_id:plan});
    }
    closeModal(T_MODAL);
    await loadDashboard();
    notice("data-notice",id?"Dados da imobiliária atualizados.":"Imobiliária cadastrada com 7 dias de teste. O login do responsável será criado na próxima etapa.");
    page("tenants");
  }catch(e){notice("tenant-form-notice",e.message,true);}
  finally{btn.disabled=false;}
}
async function changeTenantState(id){
  const tenant=cache.tenants.find(x=>x.id===id);
  if(!tenant)return;
  const disabling=tenant.state==="enabled";
  const description=disabling
    ?"Deseja suspender "+tenant.name+"? O status da assinatura será marcado como suspenso. Nenhum dado será excluído."
    :"Deseja reativar "+tenant.name+"? A situação da assinatura será recalculada, sem gerar novos dias de teste.";
  if(!window.confirm(description))return;
  try{
    await rpc("admin_set_tenant_state",{p_tenant_id:id,p_state:disabling?"disabled":"enabled"});
    await loadDashboard();
    notice("data-notice",disabling?"Imobiliária suspensa.":"Imobiliária reativada.");
    page("tenants");
  }catch(e){notice("data-notice",e.message,true);}
}
function renderTenants(){
  const queryText=$("tenant-search").value.trim().toLocaleLowerCase("pt-BR");
  const filter=$("tenant-filter").value;
  const result=cache.tenants.filter(t=>
    (filter==="all"||t.state===filter) &&
    [t.name,t.slug,t.contact_name,t.contact_email,t.contact_phone].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(queryText))
  );
  const body=$("all-tenants");
  body.replaceChildren();
  if(!result.length){emptyRow(body,6,"Nenhuma imobiliária encontrada.");return;}
  result.forEach(t=>{
    const tr=document.createElement("tr");
    const name=document.createElement("td");
    const strong=document.createElement("strong");strong.className="tenant-name-cell";strong.textContent=t.name;
    const slug=document.createElement("small");slug.className="tenant-slug";slug.textContent=t.slug;
    name.append(strong,slug);tr.appendChild(name);
    makeCell(tr,t.contact_name||"—");
    const contact=document.createElement("td");contact.className="tenant-contact";
    const mail=document.createElement("span");mail.textContent=t.contact_email||"—";
    const phone=document.createElement("small");phone.textContent=t.contact_phone||"";
    contact.append(mail,phone);tr.appendChild(contact);
    makeBadge(tr,t.state);
    makeCell(tr,date(t.created_at));
    const actions=document.createElement("td");
    const edit=document.createElement("button");edit.type="button";edit.className="tenant-action";edit.textContent="Editar";
    edit.addEventListener("click",()=>openEditTenant(t.id));
    const toggle=document.createElement("button");toggle.type="button";
    toggle.className="tenant-action"+(t.state==="enabled"?" danger":"");
    toggle.textContent=t.state==="enabled"?"Suspender":"Reativar";
    toggle.addEventListener("click",()=>changeTenantState(t.id));
    actions.append(edit,toggle);tr.appendChild(actions);body.appendChild(tr);
  });
}
function setupTenants(){
  $("add-plan-btn").addEventListener("click",()=>{notice("plan-form-notice","");$("plan-form").reset();showModal(P_MODAL);});
  $("add-tenant-btn").addEventListener("click",openCreateTenant);
  $("tenant-name").addEventListener("input",()=>{
    if(!$("tenant-edit-id").value && !$("tenant-slug").dataset.manuallyChanged)
      $("tenant-slug").value=slugify($("tenant-name").value);
  });
  $("tenant-slug").addEventListener("input",()=>{
    $("tenant-slug").dataset.manuallyChanged="true";
  });
  $("close-tenant-modal").addEventListener("click",()=>closeModal(T_MODAL));
  $("cancel-tenant-btn").addEventListener("click",()=>closeModal(T_MODAL));
  $("close-plan-modal").addEventListener("click",()=>closeModal(P_MODAL));
  $("cancel-plan-btn").addEventListener("click",()=>closeModal(P_MODAL));
  $("tenant-form").addEventListener("submit",saveTenant);
  $("plan-form").addEventListener("submit",savePlan);
  $("tenant-search").addEventListener("input",renderTenants);
  $("tenant-filter").addEventListener("change",renderTenants);
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape") [T_MODAL,P_MODAL].forEach(id=>{if(!$(id).classList.contains("hidden"))closeModal(id);});
  });
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
    query("tenants","id,name,slug,state,created_at,contact_name,contact_email,contact_phone","created_at.desc"),
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
  renderTenants();\n  updatePlanOptions();
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
  $("auth-form").addEventListener("submit",handleAuth);\n  setupTenants();
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
