import {config} from '../public/config.js';

const supabase=config.supabaseUrl;
const key=config.supabasePublishableKey;
const slugPattern=/^[a-z0-9][a-z0-9-]{1,62}$/;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function rpc(name,data={}){
 try{
  const res=await fetch(supabase+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify(data),cache:'no-store'
  });
  if(!res.ok)return null;
  return await res.json();
 }catch{return null;}
}
const txt=(text,status=200,type='text/plain; charset=utf-8',cache='no-store')=>new Response(text,{
 status,headers:{'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff'}
});
const propertyPrice=p=>{
 const amount=Number(p.purpose==='rent'?p.price_rent:p.price_sale);
 return Number.isFinite(amount)&&amount>0?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(amount/100):'';
};
async function imageRedirect(url){
 const slug=url.searchParams.get('imobiliaria')||'',id=url.searchParams.get('imovel');
 if(!slugPattern.test(slug))return txt('Não encontrado',404);
 const site=await rpc('website_header',{p_slug:slug,p_preview:false});
 if(!site)return txt('Não encontrado',404);
 let path=site.banner_path;
 if(id){
  if(!uuidPattern.test(id))return txt('Não encontrado',404);
  const catalog=await rpc('website_search_properties',{p_slug:slug,p_property_id:id,p_limit:1});
  if(!catalog?.properties?.[0])return txt('Não encontrado',404);
  path=catalog.properties[0].photos?.[0]||site.banner_path;
 }
 if(!path)return txt('Nenhuma imagem',404);
 try{
  const result=await fetch(supabase+'/functions/v1/website-media',{
   method:'POST',headers:{apikey:key,'Content-Type':'application/json'},
   body:JSON.stringify({slug,preview:false,paths:[path]}),cache:'no-store'
  });
  if(!result.ok)return txt('Imagem não disponível',404);
  const data=await result.json(),target=data.urls?.[path];
  if(!target||!target.startsWith(supabase+'/storage/v1/object/sign/'))return txt('Imagem não disponível',404);
  return new Response(null,{status:302,headers:{Location:target,'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
 }catch{return txt('Imagem indisponível',503);}
}
async function sitemap(url){
 const items=await rpc('website_sitemap');
 if(!Array.isArray(items))return txt('Serviço temporariamente indisponível',503);
 const urls=new Set();
 for(const entry of items){
  if(!slugPattern.test(entry.slug||''))continue;
  const base=url.origin+'/vitrine/?imobiliaria='+encodeURIComponent(entry.slug);
  urls.add(base);
  if(entry.property_id&&uuidPattern.test(entry.property_id))urls.add(base+'&imovel='+entry.property_id);
 }
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  [...urls].map(link=>'<url><loc>'+escapeHtml(link)+'</loc></url>').join('\n')+'\n</urlset>';
 return txt(xml,200,'application/xml; charset=utf-8','public,max-age=600');
}
async function storefrontHtml(request,env,url){
 const origin=await env.ASSETS.fetch(new URL('/vitrine/',request.url));
 if(!origin.ok)return origin;
 if(url.searchParams.has('preview')){
  const headers=new Headers(origin.headers);headers.set('X-Robots-Tag','noindex, nofollow');headers.set('Cache-Control','no-store');
  return new Response(origin.body,{status:origin.status,headers});
 }
 const slug=url.searchParams.get('imobiliaria')||'';
 if(!slugPattern.test(slug)){
  const headers=new Headers(origin.headers);headers.set('X-Robots-Tag','noindex, nofollow');
  return new Response(origin.body,{status:origin.status,headers});
 }
 const website=await rpc('website_header',{p_slug:slug,p_preview:false});
 if(!website)return txt('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Site indisponível</title><body>Este site não está disponível.</body></html>',404,'text/html; charset=utf-8');
 const id=url.searchParams.get('imovel');
 let property=null;
 if(id){
  if(!uuidPattern.test(id))return txt('Imóvel não encontrado',404);
  const data=await rpc('website_search_properties',{p_slug:slug,p_property_id:id,p_limit:1});
  property=data?.properties?.[0]||null;
  if(!property)return txt('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Imóvel indisponível</title><body>Este imóvel não está disponível.</body></html>',404,'text/html; charset=utf-8');
 }
 const title=property?property.title+' | '+website.name:website.name+' | Imóveis para venda e aluguel';
 const desc=property?
  [property.purpose==='rent'?'Aluguel':'Venda',property.city,property.neighborhood,propertyPrice(property),property.description].filter(Boolean).join(' · ').slice(0,180):
  (website.about||website.tagline||'Encontre seu imóvel com a nossa imobiliária.').slice(0,170);
 const canonical=url.origin+'/vitrine/?imobiliaria='+encodeURIComponent(slug)+(property?'&imovel='+encodeURIComponent(property.id):'');
 const image=property?(property.photos?.length>0||website.banner_path):website.banner_path;
 const ogImage=image?url.origin+'/vitrine/compartilhar-imagem?imobiliaria='+encodeURIComponent(slug)+(property?'&imovel='+encodeURIComponent(property.id):''):'';
 const head=[
  '<meta name="robots" content="index,follow,max-image-preview:large">',
  '<link rel="canonical" href="'+escapeHtml(canonical)+'">',
  '<meta property="og:type" content="website">',
  '<meta property="og:locale" content="pt_BR">',
  '<meta property="og:site_name" content="'+escapeHtml(website.name)+'">',
  '<meta property="og:title" content="'+escapeHtml(title)+'">',
  '<meta property="og:description" content="'+escapeHtml(desc)+'">',
  '<meta property="og:url" content="'+escapeHtml(canonical)+'">',
  '<meta name="twitter:card" content="'+(ogImage?'summary_large_image':'summary')+'">',
  '<meta name="twitter:title" content="'+escapeHtml(title)+'">',
  '<meta name="twitter:description" content="'+escapeHtml(desc)+'">',
  ...(ogImage?['<meta property="og:image" content="'+escapeHtml(ogImage)+'">','<meta name="twitter:image" content="'+escapeHtml(ogImage)+'">']:[])
 ].join('\n');
 let html=await origin.text();
 html=html.replace(/<title>[^<]*<\/title>/i,'<title>'+escapeHtml(title)+'</title>');
 html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+escapeHtml(desc)+'">');
 html=html.replace('</head>',head+'\n</head>');
 const headers=new Headers(origin.headers);
 headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store');
 headers.set('X-Robots-Tag','index, follow');headers.delete('Content-Length');headers.delete('ETag');
 return new Response(html,{status:200,headers});
}
export default{
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='HEAD')return env.ASSETS.fetch(request);
  if(url.pathname==='/sitemap.xml')return sitemap(url);
  if(url.pathname==='/robots.txt'){
   return txt('User-agent: *\nDisallow: /painel/\nDisallow: /vitrine/?imobiliaria=*&preview=1\nAllow: /vitrine/\nSitemap: '+url.origin+'/sitemap.xml\n',200,'text/plain; charset=utf-8','public,max-age=3600');
  }
  if(url.pathname==='/vitrine/compartilhar-imagem')return imageRedirect(url);
  if(url.pathname==='/vitrine/'||url.pathname==='/vitrine')return storefrontHtml(request,env,url);
  return env.ASSETS.fetch(request);
 }
};
