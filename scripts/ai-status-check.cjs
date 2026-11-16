const {request}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const api=await request.newContext({baseURL:'http://localhost:8080'});
 const data={username:'probe'+Date.now().toString(36),password:'probe-password-123'};
 if((await api.post('/api/auth/register',{data})).status()!==200)throw Error('register');
 if((await api.post('/api/auth/login',{data})).status()!==200)throw Error('login');
 const r=await api.post('/chat',{data:{message:'请只回答：连接正常'},timeout:90000});
 const body=await r.json();
 const status={http:r.status(),available:r.status()===200,message:body.message||'',checked_at:new Date().toISOString()};
 if(r.status()===200 && !body.reply?.trim())throw Error('empty AI reply');
 if(r.status()!==200 && (r.status()!==503 || !body.message?.includes('AI 服务')))throw Error('unexpected AI failure: '+r.status());
 fs.writeFileSync('/tmp/jotang-ai-status.json',JSON.stringify(status,null,2));
 console.log(status.available?'PASS: online AI available':'UNAVAILABLE: '+status.message+' (HTTP '+status.http+')');
 await api.dispose();
})().catch(e=>{console.error(e);process.exitCode=1});
