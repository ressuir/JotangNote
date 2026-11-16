import fs from 'node:fs/promises';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const B=new URL('./',import.meta.url).pathname;
const R=B.replace(/course\/materials\/$/,'');
const E=JSON.parse(await fs.readFile(R+'course/evidence/current.json','utf8'));
const P=Presentation.create({slideSize:{width:1280,height:720}});
const font='Noto Sans CJK SC', ink='#172F3B',muted='#536673',accent='#A46332',bg='#FAF9F5';
function tx(s,t,x,y,w,h,size=28,color=ink,bold=false){const z=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});z.text=t;z.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none'};return z;}
function slide(title){const s=P.slides.add();s.background.fill=bg;tx(s,title,62,38,1150,75,44,ink,true);tx(s,String(P.slides.items.length).padStart(2,'0'),1160,664,60,28,18,muted);return s;}
function box(s,t,x,y,w,h){const z=s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:'#EEF2F3',line:{fill:'#90A2AD',width:1.3}});z.text=t;z.text.style={typeface:font,fontSize:25,color:ink,alignment:'center',verticalAlignment:'middle',autoFit:'none'};return z;}
function link(s,a,b,side='right',end='left'){s.shapes.connect(a,b,{kind:'straight',fromSide:side,toSide:end,line:{fill:'#758B97',width:2},tail:{type:'triangle',width:'med',length:'med'}});}
async function im(s,name,x,y,w,h){s.images.add({blob:new Uint8Array(await fs.readFile(R+'Notes/screenshots/'+name)),contentType:'image/png',alt:'JotangNote 真实云端浏览器截图',fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function notes(s,t){s.speakerNotes.textFrame.setText(t+'\n源码：https://github.com/ressuir/JotangNote/tree/course/delivery-20261116\n验证：https://github.com/ressuir/JotangNote/actions/runs/'+E.run_id);}
let s=P.slides.add();s.background.fill=bg;
tx(s,'焦糖笔记',80,190,1100,120,82,ink,true);tx(s,'JotangNote',84,326,1050,70,42,accent);tx(s,'Java 后端课程项目',86,440,1050,55,28,muted);tx(s,'个人笔记管理与 AI 辅助',86,505,1050,55,28,muted);notes(s,'以个人笔记场景串联数据库、缓存、消息队列和用户权限。');
s=slide('项目背景与目标');
tx(s,'学习记录需要一个完整的保存流程',66,145,1140,65,34,accent,true);
tx(s,'浏览器记录想法，登录后管理自己的笔记。',66,240,1100,65,30);
tx(s,'用真实业务练习 Java Web 与中间件协作。',66,332,1100,65,30);
tx(s,'提交、入队、写库和结果确认都能追踪。',66,424,1100,65,30);
tx(s,'范围：纯文本个人笔记；单实例应用',66,552,1100,65,25,muted);notes(s,'项目源于焦糖工作室后端学习实践。只介绍已实现范围，不把附件、协作或高并发写成成果。');
s=slide('系统功能');
tx(s,'账号与笔记',65,155,390,55,32,accent,true);
tx(s,'注册、登录与退出\n笔记创建、详情、修改、删除\n按标题或正文筛选与排序',65,224,510,210,29);
tx(s,'AI 入口',65,467,390,50,32,accent,true);
tx(s,'多轮对话与 get_note 工具\n多轮记忆与本人笔记总结',65,525,510,100,27);
s.images.add({blob:new Uint8Array(await fs.readFile(B+'login-detail.png')),contentType:'image/png',fit:'contain',position:{left:660,top:143,width:485,height:470}});notes(s,'截图来自真实 Chromium。搜索是前端对已加载列表的筛选。AI 已通过真实对话、多轮记忆与工具读取测试。');
s=slide('技术栈与系统架构');
const a=box(s,'浏览器\nHTML / CSS / JS',64,277,225,110),b=box(s,'Spring Boot 4.1.1\nJava 17',405,270,345,125);
const c=box(s,'MySQL 8.4\n用户与笔记',920,150,290,95),d=box(s,'Redis 7.4\n单篇详情缓存',920,290,290,95),e=box(s,'RabbitMQ 3.13\n异步增删改',920,430,290,95),f=box(s,'DeepSeek API\n会话与工具调用',405,500,345,95);
link(s,a,b);link(s,b,c);link(s,b,d);link(s,b,e);link(s,b,f,'bottom','top');tx(s,'MyBatis-Plus 3.5.17 负责数据库映射；Session 与 AI 历史保存在应用内存',66,625,1130,35,22,muted);notes(s,'系统由一个 Spring Boot 应用加三个基础服务组成。静态页面与 API 同源部署。AI get_note 通过服务层检查归属后查询 MySQL。');
s=slide('数据库与核心数据模型');
const u=box(s,'users\n\nid  BIGINT  PK\nusername  VARCHAR(32)  UNIQUE\npassword_hash  VARCHAR(255)\ncreated_at  DATETIME',65,170,478,350);
const n=box(s,'notes\n\nid  BIGINT  PK\nauthor_id  BIGINT  FK / INDEX\ntitle  VARCHAR(200)\ncontent  LONGTEXT\ncreated_at / updated_at',727,170,488,390);
link(s,u,n);tx(s,'1 对 多',555,280,160,50,27,accent,true);tx(s,'utf8mb4 · InnoDB · 作者外键约束 · 用户名唯一约束',66,608,1150,45,25,muted);notes(s,'数据库由 sql/schema.sql 初始化。author_id 关联 users.id，支持按作者查列表。密码保存 BCrypt 哈希，正文为 LONGTEXT。');
s=slide('核心技术实现');
tx(s,'身份与数据归属',66,155,440,50,32,accent,true);tx(s,'Session 提供 userId，BCrypt 校验密码\n接口、缓存和 AI 工具都检查笔记作者',66,218,1120,95,28);
tx(s,'缓存读取',66,343,440,50,32,accent,true);tx(s,'note:userId:noteId，TTL 为 600 秒\n未命中或 Redis 异常时经权限检查读取 MySQL',66,406,1120,95,28);
tx(s,'异步写入',66,530,440,50,32,accent,true);tx(s,'消费者写库后清理缓存，前端查询确认最终结果',66,593,1120,55,28);notes(s,'源码定位：AuthController、NoteController、NoteAccessService、NoteOperationConsumer。缓存策略通过顺序读写测试，不宣称已解决全部并发竞争。');
s=slide('关键业务流程');
const f1=box(s,'用户提交\n标题与正文',65,224,245,115),f2=box(s,'Session 鉴权\n校验数据归属',370,224,245,115),f3=box(s,'RabbitMQ 入队\n返回 HTTP 202',675,224,245,115),f4=box(s,'消费者写库\n并清理缓存',980,224,245,115);link(s,f1,f2);link(s,f2,f3);link(s,f3,f4);
tx(s,'202 表示请求已接收',66,409,1100,60,36,accent,true);tx(s,'前端继续查询列表，匹配实际结果后显示已保存',66,493,1110,70,30);tx(s,'尚未确认时保留待确认状态，允许重新检查',66,591,1110,50,25,muted);notes(s,'新建通过新 ID 与标题正文匹配，更新检查最终内容，删除检查记录消失。没有持久化操作状态接口，轮询超时不表示失败，也不表示落库成功。');
s=slide('系统运行与实际效果');await im(s,'02-notes.png',65,128,1150,445);tx(s,'真实浏览器提交 → RabbitMQ 消费 → MySQL 保存 → 列表显示',66,604,1150,50,27,muted);notes(s,'截图来源为本次云端验证中的真实网页。使用独立测试账号和笔记，未伪造页面数据或拦截接口返回。');
s=slide('实际测试结果');
const vals=[['测试层次','实际检查','结果'],['Maven','上下文、笔记归属、AI 工具鉴权','5 项通过'],['HTTP 与中间件','异步 CRUD、双用户隔离、Redis TTL','通过'],['浏览器','注册登录、创建并显示真实笔记','通过'],['在线 AI','对话、记忆、工具读取、跨用户隔离','通过']];
const t=s.tables.add({rows:5,columns:3,left:65,top:155,width:1150,height:345,columnWidths:[230,650,270],values:vals});
t.borders.assign({fill:'#CFD8DE',width:1});
for(let i=0;i<5;i++)for(let j=0;j<3;j++){const z=t.getCell(i,j);z.fill=i===0?'#E8EDF0':bg;z.text.style={typeface:font,fontSize:25,color:ink,bold:i===0};}
tx(s,'AI 已用随机标识验证真实笔记读取',66,548,1140,55,28,accent,true);tx(s,'未进行压力、消息重投和集群测试',66,610,1140,45,24,muted);notes(s,'数据来自 Surefire XML 与真实 smoke-test.sh。5 项 Maven 测试与外部 AI 端到端测试分别统计。模型正确复述了只保存在笔记正文中的随机标识，其他用户无法读取。');
s=slide('项目成果与后续改进');tx(s,'运行实例',66,156,480,55,34,accent,true);tx(s,'docker compose up --build -d',66,236,1140,65,35);tx(s,'浏览器打开 http://localhost:8080',66,320,1140,55,29);tx(s,'账号、笔记和中间件流程已有真实运行验证',66,415,1140,55,29);tx(s,'后续：消息幂等与死信、操作状态、会话持久化',66,516,1140,55,28,muted);tx(s,'运行在线 AI 时配置 DEEPSEEK_API_KEY',66,602,1140,45,25,muted);notes(s,'完整依赖与配置见 README 和 .env.example。Compose 初始化两张业务表，仅映射本机网页端口。停止使用 docker compose down；保留命名卷即可保留数据。');
await fs.mkdir(B+'slides',{recursive:true});
for(let i=0;i<P.slides.items.length;i++){
 const z=P.slides.items[i];const png=await P.export({slide:z,format:'png',scale:1.2});await fs.writeFile(B+`slides/slide-${i+1}.png`,new Uint8Array(await png.arrayBuffer()));
}
const draft=B+'candidate.pptx';await(await PresentationFile.exportPptx(P)).save(draft);
await fs.copyFile(draft,R+'course/artifacts/焦糖笔记项目介绍.pptx');
console.log('PPTX exported for external validation');
