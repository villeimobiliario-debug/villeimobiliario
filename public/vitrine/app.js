import {config} from '../config.js';
const root=document.getElementById('site');
const params=new URLSearchParams(location.search);
const slug=(params.get('imobiliaria')||'').trim().toLowerCase();
const preview=params.get('preview')==='1';
const mediaUrls=Object.create(null);
const propertyDeepLink=new URLSearchParams(location.search).get('imovel');
let previewToken='';
const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text??'');return n;};
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(c||0)/100);
const types={house:'Casa',apartment:'Apartamento',land:'Terreno',commercial:'Imóvel comercial',rural:'Imóvel rural',other:'Imóvel'};
const purposes={rent:'Aluguel',sale:'Venda',both:'Venda e aluguel'};
const safeColor=c=>/^#[0-9A-Fa-f]{6}$/.test(c||'')?c:'#0E359D';
const photoUrl=path=>path&&mediaUrls[path]||null;
const whatsapp=(number,message)=>{
 const n=String(number||'').replace(/\D/g,'');if(n.length<10||n.length>15)return '';
 return 'https://wa.me/'+((n.length===10||n.length===11)?'55'+n:n)+'?text='+encodeURIComponent(message);
};
const icon=(name)=>{const paths={
 home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 21v-7h6v7"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chat:'<path d="M20 11.5A8 8 0 0 1 8.4 19L3 21l2-5.1A8 8 0 1 1 20 11.5z"/><path d="M8 10h8m-8 3h5"/>',
 pin:'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 bed:'<path d="M3 20V5m18 15V9M3 17h18M5 12h14V9a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/>'
 };return '<svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.home)+'</svg>';};
// Analytics sem cookies: sessão temporária por aba. Não armazena IP, nome ou telefone.
function visitorId(){
 if(preview||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return null;
 const storageKey='ville_site_visitor_'+slug;
 try{
  const previous=JSON.parse(sessionStorage.getItem(storageKey)||'null');
  if(previous?.id&&/^[0-9a-f-]{36}$/i.test(previous.id)&&previous.expires>Date.now())return previous.id;
  const next=crypto.randomUUID();
  sessionStorage.setItem(storageKey,JSON.stringify({id:next,expires:Date.now()+86400000}));
  return next;
 }catch{return crypto.randomUUID();}
}
let ephemeralVisitor=null;
function trackEvent(type,propertyId=null){
 if(preview||document.visibilityState==='prerender')return;
 if(!ephemeralVisitor)ephemeralVisitor=visitorId();
 if(!ephemeralVisitor)return;
 const payload={p_slug:slug,p_event:type,p_visitor:ephemeralVisitor,p_property_id:propertyId};
 // O evento não interfere na navegação caso a rede ou o bloqueador o impeça.
 fetch(config.supabaseUrl+'/rest/v1/rpc/website_track_event',{
  method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},
  body:JSON.stringify(payload),keepalive:true,cache:'no-store'
 }).catch(()=>{});
}
function img(src,alt,cls=''){const n=$('img',cls);n.alt=alt;n.loading='lazy';n.referrerPolicy='no-referrer';n.src=src;return n;}
const unavailable=()=>{root.replaceChildren();const p=$('main','empty');p.append($('h3','','Site não disponível'),$('p','','Este endereço não possui uma vitrine pública ativa no momento.'));root.append(p);document.title='Site indisponível | VILLE';};
async function start(){
 if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)){unavailable();return;}
 let token;
 if(preview){try{const s=JSON.parse(sessionStorage.getItem('ville_agency_session_v1')||'null');token=s?.access_token;}catch{}}
 if(preview&&!token){root.replaceChildren($('main','empty','Faça login e abra a prévia na mesma aba do painel.'));return;}
 previewToken=token||'';
 const endpoint='website_header';
 try{
  const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/'+endpoint,{
   method:'POST',headers:{apikey:config.supabasePublishableKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},
   body:JSON.stringify({p_slug:slug,p_preview:preview}),cache:'no-store'
  });
  if(!response.ok)throw Error('A vitrine não está disponível.');
  const data=await response.json();
  if(!data?.slug){unavailable();return;}
  await loadImages({website:data,properties:[]});
  render({website:data,properties:[]});
  if(!preview)trackEvent('site_visit');
 }catch(e){unavailable();}
}
async function loadImages(data){
 const w=data.website||{},paths=[w.logo_path,w.banner_path,...(Array.isArray(data.properties)?data.properties:[]).flatMap(p=>p.photos||[])].filter(Boolean);
 const unique=[...new Set(paths)];if(!unique.length)return;
 for(let i=0;i<unique.length;i+=20){
  try{
   const response=await fetch(config.supabaseUrl+'/functions/v1/website-media',{
    method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,
      ...(preview?{Authorization:'Bearer '+previewToken}:{})},
    body:JSON.stringify({slug,preview,paths:unique.slice(i,i+20)}),cache:'no-store'
   });
   if(response.ok)Object.assign(mediaUrls,(await response.json()).urls||{});
  }catch{}
 }
}
async function catalogSearch({query='',purpose='',type='',offset=0,propertyId=null}={}){
 const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/website_search_properties',{
  method:'POST',headers:{'Content-Type':'application/json',apikey:config.supabasePublishableKey,
   ...(preview?{Authorization:'Bearer '+previewToken}:{})},
  body:JSON.stringify({p_slug:slug,p_query:query,p_purpose:purpose,p_type:type,p_offset:offset,
   p_limit:12,p_preview:preview,p_property_id:propertyId}),cache:'no-store'
 });
 if(!response.ok)throw Error('Não foi possível consultar os imóveis.');
 const body=await response.json();
 if(!body||!Array.isArray(body.properties))throw Error('A consulta do catálogo não está disponível.');
 return body;
}
function render(data){
 const site=data.website,props=Array.isArray(data.properties)?data.properties:[];

 document.documentElement.style.setProperty('--brand',safeColor(site.primary_color));
 document.documentElement.style.setProperty('--accent',safeColor(site.accent_color));
 document.title=site.name+' | Imóveis para venda e aluguel';
 root.replaceChildren();
 if(preview){root.append($('div','notice',site.published?'PRÉ-VISUALIZAÇÃO DO SITE — As alterações salvas aparecem aqui.':'PRÉ-VISUALIZAÇÃO — Este site ainda não está publicado.'));}
 const header=$('header','header');const headerIn=$('div','container header-inner');
 const logoWrap=$('a','brand');logoWrap.href='#inicio';
 const mark=$('span','brand-mark');const logo=photoUrl(site.logo_path);
 if(logo)mark.append(img(logo,'Logo de '+site.name));else mark.textContent=site.name.slice(0,1).toUpperCase();
 const brandText=$('span','brand-label');brandText.append($('strong','',site.name),$('small','','IMOBILIÁRIA'));logoWrap.append(mark,brandText);
 const nav=$('nav','header-nav');nav.setAttribute('aria-label','Navegação principal');
 for(const [label,dest] of [['Início','#inicio'],['Imóveis','#imoveis'],['Sobre nós','#sobre']]){const a=$('a','',label);a.href=dest;nav.append(a);}
 const contactLink=whatsapp(site.whatsapp,'Olá! Gostaria de mais informações sobre os imóveis.');
 const call=$('a','contact-btn');call.innerHTML=icon('chat')+' Falar com corretor';call.href=contactLink||'#contato';
 if(contactLink){call.target='_blank';call.rel='noopener noreferrer';call.addEventListener('click',()=>trackEvent('whatsapp_click'));}
 headerIn.append(logoWrap,nav,call);header.append(headerIn);root.append(header);
 const hero=$('section','hero');hero.id='inicio';
 const banner=photoUrl(site.banner_path);
 if(banner){hero.classList.add('with-banner');hero.style.backgroundImage='url("'+banner+'")';}
 const heroIn=$('div','container hero-content');heroIn.append($('span','eyebrow','BEM-VINDO À '+site.name.toLocaleUpperCase('pt-BR')),
 $('h1','',site.tagline||'Encontre o imóvel ideal para você.'),
 $('p','','Uma nova forma de descobrir imóveis selecionados para o seu próximo capítulo.'));
 hero.append(heroIn,$('div','hero-deco'));root.append(hero);
 const form=$('form','container search-bar');const filterData=[
  ['Busca','search','text','Bairro, cidade ou nome'],['Finalidade','purpose','select',['Todas','Comprar','Alugar']],
  ['Tipo de imóvel','type','select',['Todos','Casa','Apartamento','Terreno','Comercial','Rural','Outro']]];
 for(const [label,key,kind,content] of filterData){
  const field=$('label','filter');field.append($('span','',label));
  let control;
  if(kind==='select'){control=$('select');for(const optionLabel of content){const opt=$('option','',optionLabel);opt.value=optionLabel;control.append(opt);}}
  else {control=$('input');control.type='search';control.placeholder=content;control.autocomplete='off';}
  control.name=key;control.id='filter-'+key;field.append(control);form.append(field);
 }
 const button=$('button','search-button','Buscar imóveis');button.type='submit';form.append(button);root.append(form);
 const section=$('section','section');section.id='imoveis';const inside=$('div','container');
 const heading=$('div','section-heading');const headingText=$('div');
 headingText.append($('span','eyebrow','SEU PRÓXIMO ENDEREÇO'),$('h2','','Encontre seu novo imóvel'),$('p','','Confira as oportunidades disponíveis para você.'));
 const badge=$('span','results-badge');heading.append(headingText,badge);
 const cards=$('div','cards');inside.append(heading,cards);section.append(inside);root.append(section);
 const typeTranslation={house:'Casa',apartment:'Apartamento',land:'Terreno',commercial:'Comercial',rural:'Rural',other:'Outro'};
 const pagination=$('div','catalog-pagination');inside.append(pagination);
 const codeMap={Casa:'house',Apartamento:'apartment',Terreno:'land',Comercial:'commercial',Rural:'rural',Outro:'other'};
 let requestNo=0;
 const matches=async(page=0)=>{
  const n=++requestNo;
  const query=form.elements.search.value.trim().slice(0,80);
  const purpose=form.elements.purpose.value==='Comprar'?'sale':form.elements.purpose.value==='Alugar'?'rent':'';
  const type=codeMap[form.elements.type.value]||'';
  badge.textContent='Buscando imóveis...';
  cards.replaceChildren($('div','empty','Carregando oportunidades...'));pagination.replaceChildren();
  try{
   const result=await catalogSearch({query,purpose,type,offset:page*12});
   if(n!==requestNo)return;
   await loadImages({website:site,properties:result.properties});
   if(n!==requestNo)return;
   cards.replaceChildren();
   const count=Number(result.total||0);
   badge.textContent=count+' '+(count===1?'imóvel encontrado':'imóveis encontrados');
   if(!result.properties.length){
    const empty=$('div','empty');
    empty.append($('div','property-noimg','⌂'),$('h3','','Nenhum imóvel encontrado'),
     $('p','','Experimente ajustar os filtros para encontrar outras opções.'));
    cards.append(empty);
   }
   for(const p of result.properties)cards.append(card(p,site));
   const totalPages=Math.ceil(count/12);
   if(totalPages>1){
    const prev=$('button','property-more','← Anterior'),next=$('button','property-more','Próxima →');
    prev.type=next.type='button';prev.disabled=page===0;next.disabled=page>=totalPages-1;
    prev.addEventListener('click',()=>{matches(page-1);section.scrollIntoView({behavior:'smooth'});});
    next.addEventListener('click',()=>{matches(page+1);section.scrollIntoView({behavior:'smooth'});});
    pagination.append(prev,$('span','', 'Página '+(page+1)+' de '+totalPages),next);
   }
  }catch(err){
   if(n!==requestNo)return;
   cards.replaceChildren($('div','empty','Não foi possível buscar imóveis agora. Tente novamente.'));
   badge.textContent='Busca indisponível';
  }
 };
 form.addEventListener('submit',e=>{e.preventDefault();matches(0);section.scrollIntoView({behavior:'smooth'});});
 matches(0);
 if(propertyDeepLink&&/^[0-9a-f-]{36}$/i.test(propertyDeepLink)){
  queueMicrotask(async()=>{
   try{
    const result=await catalogSearch({propertyId:propertyDeepLink});
    const property=result.properties[0];
    if(property){await loadImages({website:site,properties:[property]});details(property,site);}
   }catch{}
  });
 }
 const about=$('section','about');about.id='sobre';const aboutGrid=$('div','container about-grid');
 const aboutText=$('div');aboutText.append($('span','eyebrow','QUEM SOMOS'),$('h2','','Encontre seu lugar com quem entende do mercado.'));
 aboutText.append($('p','',site.about||'Atendimento dedicado para ajudar você a encontrar o imóvel que combina com seus planos.'));
 const aboutGraphic=$('div','about-panel');aboutGraphic.append($('span','',site.name.slice(0,20)));
 aboutGrid.append(aboutText,aboutGraphic);about.append(aboutGrid);root.append(about);
 const footer=$('footer','footer');footer.id='contato';const footerMain=$('div','container');
 const upper=$('div','footer-top');const footerName=$('div','brand-label');footerName.append($('strong','',site.name),$('small','','IMOBILIÁRIA'));
 const address=$('div','footer-details');
 if(site.address)address.append($('span','',site.address));
 if(site.phone)address.append($('span','',site.phone));
 if(site.instagram){const insta=$('a','','Instagram');insta.href=site.instagram;insta.target='_blank';insta.rel='noopener noreferrer';address.append(insta);}
 if(contactLink){const w=$('a','','Atendimento pelo WhatsApp');w.href=contactLink;w.target='_blank';w.rel='noopener noreferrer';w.addEventListener('click',()=>trackEvent('whatsapp_click'));address.append(w);}
 upper.append(footerName,address);
 const bottom=$('div','footer-bottom');bottom.append($('span','','© '+new Date().getFullYear()+' '+site.name+' · Todos os direitos reservados.'),$('strong','','Tecnologia VILLE Imobiliário'));
 footerMain.append(upper,bottom);footer.append(footerMain);root.append(footer);
}
function card(p,site){
 const card=$('article','property-card'),media=$('div','property-media'),src=photoUrl(p.photos?.[0]);
 if(src)media.append(img(src,'Imagem do imóvel '+p.title));else media.append($('span','property-noimg','⌂'));
 media.append($('span','purpose-badge',purposes[p.purpose]||'Imóvel'));card.append(media);
 const body=$('div','property-info');body.append($('span','location',(p.neighborhood?p.neighborhood+', ':'')+(p.city||'')),$('h3','',p.title||'Imóvel'));
 const features=$('div','feature-line');
 for(const [value,label] of [[p.bedrooms,'quartos'],[p.bathrooms,'banheiros'],[p.area,'m²']])if(Number(value)>0)features.append($('span','',value+' '+label));body.append(features);
 const bottom=$('div','property-bottom'),price=$('div','price-meta'),displayPrice=p.purpose==='rent'?p.price_rent:p.price_sale;
 price.append($('small','',p.purpose==='rent'?'Aluguel mensal':p.purpose==='both'?'Preço de venda':'Valor de venda'),$('strong','',money(displayPrice)));
 const more=$('button','property-more','Ver detalhes');more.type='button';more.addEventListener('click',()=>details(p,site));bottom.append(price,more);body.append(bottom);card.append(body);return card;
}
function inquiryForm(p,site){
 const section=$('section','inquiry-section');
 section.append($('h3','','Quero receber mais informações'),$('p','','Deixe seu contato para a imobiliária falar com você sobre este imóvel.'));
 const form=$('form','inquiry-form');
 const name=$('input');name.type='text';name.name='full_name';name.placeholder='Seu nome completo';name.required=true;name.maxLength=100;name.autocomplete='name';
 const phone=$('input');phone.type='tel';phone.name='phone';phone.placeholder='Seu WhatsApp com DDD';phone.required=true;phone.maxLength=20;phone.autocomplete='tel';
 const agree=$('label','inquiry-consent'),agreeCheck=$('input');agreeCheck.type='checkbox';agreeCheck.required=true;agree.append(agreeCheck,$('span','','Autorizo esta imobiliária a entrar em contato comigo sobre este imóvel.'));
 const honeypot=$('input');honeypot.name='website';honeypot.autocomplete='off';honeypot.tabIndex=-1;honeypot.setAttribute('aria-hidden','true');honeypot.className='inquiry-trap';
 const submit=$('button','contact-btn','Solicitar contato');submit.type='submit';
 const feedback=$('div','inquiry-feedback');feedback.setAttribute('role','status');
 form.append(name,phone,agree,honeypot,submit,feedback);
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const n=name.value.trim(),tel=phone.value.replace(/\D/g,'');
  if(n.length<2||tel.length<10||tel.length>13){feedback.textContent='Preencha nome e telefone com DDD válidos.';return;}
  submit.disabled=true;feedback.textContent='Enviando solicitação...';
  try{
   const res=await fetch(config.supabaseUrl+'/rest/v1/rpc/website_request_contact',{
    method:'POST',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},
    body:JSON.stringify({p_slug:slug,p_property_id:p.id,p_name:n,p_phone:tel,p_agree:agreeCheck.checked,p_honeypot:honeypot.value})
   });
   const result=await res.json().catch(()=>null);
   if(!res.ok||result!==true)throw Error('Não foi possível registrar o interesse neste momento.');
   feedback.textContent='Recebemos seu interesse! A imobiliária poderá entrar em contato com você.';
   form.reset();submit.textContent='Solicitação enviada';submit.disabled=true;
  }catch(err){feedback.textContent=err.message;submit.disabled=false;}
 });
 section.append(form);return section;
}
function details(p,site){
 const overlay=$('div','modal-backdrop'),modal=$('div','modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 const close=$('button','modal-close','×');close.type='button';close.setAttribute('aria-label','Fechar detalhes do imóvel');
 const dismiss=()=>overlay.remove();close.addEventListener('click',dismiss);overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
 const imagePanel=$('div','modal-image'),photos=(p.photos||[]).map(photoUrl).filter(Boolean);
 const showPhoto=src=>{imagePanel.replaceChildren();if(src)imagePanel.append(img(src,'Foto de '+p.title));else imagePanel.append($('span','property-noimg','⌂'));};
 showPhoto(photos[0]);modal.append(close,imagePanel);
 if(photos.length>1){const thumbs=$('div','more-photos');photos.forEach((src,i)=>{const thumb=$('button',i===0?'selected':'');thumb.type='button';thumb.setAttribute('aria-label','Ver foto '+(i+1));thumb.append(img(src,'Foto '+(i+1)));thumb.addEventListener('click',()=>{showPhoto(src);thumbs.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x===thumb));});thumbs.append(thumb);});modal.append(thumbs);}
 const body=$('div','modal-body');body.append($('span','eyebrow',purposes[p.purpose]||'IMÓVEL'),$('h2','',p.title),$('p','',p.city+(p.neighborhood?', '+p.neighborhood:'')));
 const meta=$('div','detail-meta');for(const [v,label] of [[p.bedrooms,'quartos'],[p.bathrooms,'banheiros'],[p.parking,'vagas'],[p.area,'m²']])if(Number(v)>0)meta.append($('span','',v+' '+label));
 body.append(meta,$('p','',p.description||'Fale com nossa equipe para conhecer mais detalhes.'));
 const bottom=$('div','modal-details-footer');bottom.append($('strong','',money(p.purpose==='rent'?p.price_rent:p.price_sale)));
 const msg='Olá! Tenho interesse no imóvel "'+p.title+'" e gostaria de mais informações.';
 const link=whatsapp(site.whatsapp,msg);if(link){const b=$('a','contact-btn');b.innerHTML=icon('chat')+' Falar sobre este imóvel';b.href=link;b.target='_blank';b.rel='noopener noreferrer';b.addEventListener('click',()=>trackEvent('whatsapp_click',p.id));bottom.append(b);}
 body.append(bottom);
 const share=$('button','property-more','Copiar link deste imóvel');share.type='button';
 share.addEventListener('click',async()=>{
  const url=new URL(location.href);url.searchParams.set('imovel',p.id);
  try{await navigator.clipboard.writeText(url.toString());share.textContent='Link copiado!';}
  catch{share.textContent='Link: '+url.toString();}
 });
 body.append(share,inquiryForm(p,site));
 modal.append(body);overlay.append(modal);document.body.append(overlay);
 if(!preview)trackEvent('property_view',p.id);
 close.focus();
}
start();
