// Every scene records an actual running application, real API response or captured service log.
// No mocked routes, fabricated UI, screenshots-as-video or synthesized test results.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const OUT=path.resolve('course-output');fs.mkdirSync(OUT,{recursive:true});
const BASE=process.env.BASE_URL||'http://localhost:8080';
const stamp=Date.now().toString(36),user='demo'+stamp,pw='demo-password-123';
const title='Java 后端学习笔记';
const content='今天整理焦糖笔记的后端流程。\n\n1. MySQL 保存用户和笔记。\n2. Redis 缓存单篇笔记，过期时间为 10 分钟。\n3. RabbitMQ 异步处理创建、修改和删除。\n\n每次读取笔记，都需要确认它属于当前登录用户。';
const scenes=[];const requests=[];const cuts=[];let now=()=>0;
async function main(){
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:OUT+'/raw',size:{width:1920,height:1080}},deviceScaleFactor:1});
 const page=await ctx.newPage();
 const start=Date.now(); now=()=>(Date.now()-start)/1000;
 page.on('response',r=>{if(r.url().startsWith(BASE)&&/api\/|\/chat$/.test(r.url()))requests.push(`${r.request().method()} ${new URL(r.url()).pathname} → HTTP ${r.status()}`)});
 page.on('dialog',d=>d.accept());
 async function scene(label,sub,fn,seconds=10){
  const begin=now(); console.log('SCENE '+label+' '+begin.toFixed(2));
  const entry={label,start:begin,subtitle:sub};scenes.push(entry);
  await fn();
  const cutSeconds=cuts.filter(x=>x.start>=begin).reduce((n,x)=>n+x.end-x.start,0);
  await page.waitForTimeout(Math.max(500,(seconds+cutSeconds)*1000-(Date.now()-start-begin*1000)));
  entry.end=now();await page.screenshot({path:OUT+`/scene-${String(scenes.length).padStart(2,'0')}.png`});
 }
 async function open(){await page.goto(BASE,{waitUntil:'networkidle'});}
 async function saved(){await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent==='已保存',null,{timeout:30000});}
 async function slow(selector,text){await page.locator(selector).fill('');await page.locator(selector).pressSequentially(text,{delay:28});}
 async function textFile(name,text){fs.writeFileSync(path.resolve('src/main/resources/static/course-'+name+'.txt'),text); /* served by app separately via evidence server */
  fs.writeFileSync(OUT+'/'+name+'.txt',text);await page.goto('http://localhost:8090/'+name+'.txt');
  await page.evaluate(()=>{document.body.style.cssText='margin:55px;background:#101a20;color:#e5eef2;font:24px/1.65 monospace';document.querySelector('pre').style.whiteSpace='pre-wrap'});
 }
 let noteId;
 try {
  await scene('项目用途','这是焦糖笔记，用来保存个人学习记录。\n接下来演示账号、笔记和 AI 助手的完整流程。',open,9);
  await scene('运行检查','应用已经在云端启动。\n这里是本次启动日志和容器状态，三个依赖均已就绪。',async()=>{
   const log=fs.readFileSync(OUT+'/startup.txt','utf8');await page.goto('http://localhost:8090/startup.txt');await page.evaluate(()=>{document.body.style.cssText='margin:50px;background:#101a20;color:#e5eef2;font:23px/1.6 monospace';document.querySelector('pre').style.whiteSpace='pre-wrap'});assert(log.includes('app'));},11);
  await scene('注册账号','先注册一个测试账号。\n密码由后端进行 BCrypt 哈希处理，数据库不保存明文密码。',async()=>{await open();await page.locator('#registerTab').click();await slow('#usernameInput',user);await page.locator('#passwordInput').fill(pw);await page.locator('#authSubmit').click();await page.waitForFunction(()=>document.querySelector('#authSubmit').textContent.trim()==='登录');},12);
  await scene('登录','登录后，浏览器通过 Cookie 保持 Session。\n后端从会话中读取用户身份。',async()=>{await page.locator('#usernameInput').fill(user);await page.locator('#passwordInput').fill(pw);await page.locator('#authSubmit').click();await page.waitForFunction(()=>document.querySelector('#authOverlay').classList.contains('hidden'));},10);
  await scene('新建笔记','点击新建笔记，输入标题和正文。\n这篇内容会通过真实接口提交到后端。',async()=>{await page.locator('#newNoteButton').click();await slow('#noteTitle',title);await page.locator('#noteContent').fill(content);},12);
  await scene('保存与异步写入','保存接口返回 202，表示操作已经入队。\n前端继续查询，确认 MySQL 出现记录后才显示已保存。',async()=>{await page.locator('#saveNoteButton').click();await saved();noteId=Number(await page.locator('.note-item').first().getAttribute('data-note-id'));assert(noteId>0);},12);
  await scene('刷新查询','刷新页面后，笔记仍然存在。\n数据来自持久化服务，不只是浏览器中的临时内容。',async()=>{await page.reload({waitUntil:'networkidle'});await page.locator('.note-item').filter({hasText:title}).click();await page.waitForFunction(()=>document.querySelector('#noteContent').value.includes('MySQL'));},10);
  await scene('修改笔记','现在补充一段内容并保存。\n消费者更新数据库，同时删除旧的 Redis 缓存。',async()=>{await page.locator('#noteContent').fill(content+'\n\n补充：HTTP 202 只表示已接收，最终结果需要查询确认。');await page.locator('#saveNoteButton').click();await saved();},12);
  await scene('搜索与排序','搜索会筛选当前已加载笔记的标题和正文。\n列表还支持按最近修改或最新创建排序。',async()=>{await page.locator('#searchButton').click();await slow('#noteSearch','Redis');await page.waitForTimeout(1200);assert(await page.locator('.note-item').count()===1);await page.locator('#sortOrder').selectOption('created');},10);
  await scene('详情缓存','连续读取同一篇笔记后，查看 Redis 中的实际缓存。\n键包含用户 ID 与笔记 ID，有效期不超过 600 秒。',async()=>{
   await page.locator('#closeSearchButton').click();await ctx.request.get(BASE+'/api/notes/'+noteId);await ctx.request.get(BASE+'/api/notes/'+noteId);
   const me=await(await ctx.request.get(BASE+'/api/auth/me')).json();const key=`note:${me.id}:${noteId}`;
   const val=execFileSync('docker',['compose','exec','-T','redis','redis-cli','--raw','GET',key],{encoding:'utf8'});
   const ttl=execFileSync('docker',['compose','exec','-T','redis','redis-cli','TTL',key],{encoding:'utf8'}).trim();assert(Number(ttl)>0&&Number(ttl)<=600);
   await textFile('redis',`$ redis-cli GET ${key}\n${JSON.stringify(JSON.parse(val),null,2)}\n\n$ redis-cli TTL ${key}\n${ttl}\n`);},11);
  await scene('用户隔离','另一个用户知道笔记 ID，也无法读取、修改或删除它。\n下面是本次真实 API 请求返回的状态。',async()=>{
   const other=await browser.newContext();const data={username:user+'b',password:pw};await other.request.post(BASE+'/api/auth/register',{data});await other.request.post(BASE+'/api/auth/login',{data});
   let lines=[];for(const method of ['GET','PUT','DELETE']){const r=await other.request.fetch(BASE+'/api/notes/'+noteId,{method,...(method==='PUT'?{data:{title:'forbidden',content:'x'}}:{})});assert.equal(r.status(),404);lines.push(`${method} /api/notes/${noteId} → HTTP ${r.status()}`)}
   await other.close();await textFile('isolation',lines.join('\n\n'));},11);
  await scene('AI 助手','打开 AI 助手，先进行一次普通对话。\n模型请求由 Java 后端发送，密钥不会进入浏览器。',async()=>{
   await open();await page.locator('.note-item').filter({hasText:title}).click();await page.locator('#aiButton').click();await ask('用一句话解释什么是缓存。');},13);
  await scene('多轮记忆','第一轮告诉助手一个临时词，第二轮请它复述。\n后端把之前的消息历史一起发送给模型。',async()=>{await ask('请记住临时词：焦糖书签。只回复已记住。');await ask('只回复我刚才让你记住的临时词。');assert((await page.locator('.message.assistant .message-body').last().textContent()).includes('焦糖书签'));},15);
  await scene('工具读取笔记','请 AI 总结刚才的笔记。\n模型调用 get_note，Java 检查当前用户权限后再返回正文。',async()=>{await ask(`请使用 get_note 工具读取 ID 为 ${noteId} 的笔记，用两句中文总结。`);await page.locator('#chatMessages').evaluate(el=>el.scrollTop=el.scrollHeight);},15);
  await scene('新建会话','点击新会话可以清空当前对话历史。\n历史保存在应用内存中，当前版本尚未持久化。',async()=>{await page.locator('#newChatButton').click();await page.waitForFunction(()=>document.querySelectorAll('.message').length===1);},9);
  await scene('删除笔记','回到编辑区删除笔记。\n确认列表中的记录消失，再检查详情返回 404。',async()=>{await page.locator('#closeChatButton').click();await page.locator('#deleteNoteButton').click();await page.waitForFunction(()=>document.querySelectorAll('.note-item').length===0);const r=await ctx.request.get(BASE+'/api/notes/'+noteId);assert.equal(r.status(),404);},11);
  await scene('实际运行证据','这里是本次消费者输出和浏览器实际请求状态。\n能够对应创建、修改和删除的完整链路。',async()=>{const log=execFileSync('docker',['compose','logs','--no-color','app'],{encoding:'utf8'});const lines=log.split('\n').filter(x=>/MQ received:|MQ created note id=|AI requested tool:/.test(x));assert(lines.some(x=>x.includes('DELETE')));await textFile('runtime',lines.slice(-12).join('\n')+'\n\n'+requests.slice(-14).join('\n'));},12);
  await scene('退出与成果','退出后再次访问笔记接口，会收到 401。\n项目已完成个人笔记、缓存、异步写入与 AI 工具的实际演示。',async()=>{await open();await page.locator('#accountMenuButton').click();await page.locator('#logoutButton').click();await page.waitForFunction(()=>!document.querySelector('#authOverlay').classList.contains('hidden'));const r=await ctx.request.get(BASE+'/api/notes');assert.equal(r.status(),401);},12);
  async function ask(message){await page.locator('#chatInput').fill(message);const wait=page.waitForResponse(r=>r.url().endsWith('/chat')&&r.request().method()==='POST',{timeout:120000});await page.locator('#sendChatButton').click();const waitStart=now();const r=await wait;const waitEnd=now();if(waitEnd-waitStart>4.5)cuts.push({start:waitStart+1.5,end:waitEnd-.8});assert.equal(r.status(),200);const b=await r.json();assert(b.reply?.trim());await page.waitForFunction(t=>[...document.querySelectorAll('.message.assistant .message-body')].some(x=>x.textContent===t),b.reply);}
  fs.writeFileSync(OUT+'/scenes.json',JSON.stringify(scenes,null,2));
  fs.writeFileSync(OUT+'/requests.log',requests.join('\n'));
  fs.writeFileSync(OUT+'/cuts.json',JSON.stringify(cuts,null,2));
  await ctx.close();await page.video().saveAs(OUT+'/raw-demo.webm');
  console.log('PASS video scenes: '+scenes.length+'; recorded '+scenes.at(-1).end.toFixed(2)+' seconds');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
