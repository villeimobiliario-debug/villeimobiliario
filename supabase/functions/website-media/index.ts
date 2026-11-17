// VILLE private media gateway. Never return service-role credentials or unverified storage paths.
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type','Cache-Control':'no-store'};
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8'}});}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({error:'Método inválido'},405);
 const supabaseUrl=Deno.env.get('SUPABASE_URL')||'';
 const anonKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!supabaseUrl||!anonKey||!serviceKey)return response({error:'Gateway indisponível'},503);
 try{
  const raw=await req.text();if(raw.length>12000)return response({error:'Requisição grande demais'},413);
  const input=JSON.parse(raw),slug=String(input.slug||''),preview=input.preview===true;
  if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)||!Array.isArray(input.paths)||input.paths.length>24)return response({error:'Entrada inválida'},400);
  const unique=[...new Set(input.paths)];
  if(unique.some(p=>typeof p!=='string'||p.length>260||!/^[-a-z0-9/._]+$/i.test(p)||p.includes('..')))return response({error:'Caminho inválido'},400);
  const bearer=preview?req.headers.get('Authorization'):('Bearer '+anonKey);
  if(preview&&(!bearer||!bearer.startsWith('Bearer ')))return response({error:'É necessário entrar no painel'},401);
  const result={};
  for(const path of unique){
   const check=await fetch(supabaseUrl+'/rest/v1/rpc/'+(preview?'website_media_preview':'website_media_public'),{
    method:'POST',headers:{'apikey':anonKey,'Authorization':bearer,'Content-Type':'application/json'},
    body:JSON.stringify({p_slug:slug,p_path:path})
   });
   if(!check.ok||await check.json()!==true)continue;
   const signed=await fetch(supabaseUrl+'/storage/v1/object/sign/ville-public-media/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',headers:{'apikey':serviceKey,'Authorization':'Bearer '+serviceKey,'Content-Type':'application/json'},
    body:JSON.stringify({expiresIn:120})
   });
   if(!signed.ok)continue;
   const json=await signed.json();
   const url=json.signedURL||json.signedUrl;
   if(typeof url==='string')result[path]=new URL(url,supabaseUrl+'/storage/v1/').toString();
  }
  return response({urls:result});
 }catch{return response({error:'Não foi possível carregar as imagens'},400);}
});
