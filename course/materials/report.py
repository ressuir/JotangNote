from pathlib import Path
import json
from docx import Document
from docx.shared import Cm,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
B=Path(__file__).parent; R=B.parent.parent
E=json.loads((R/'course/evidence/current.json').read_text())
D=Document(); S=D.sections[0]
S.page_width=Cm(21);S.page_height=Cm(29.7)
S.top_margin=Cm(2.15);S.bottom_margin=Cm(2.0);S.left_margin=Cm(2.4);S.right_margin=Cm(2.4)
S.header_distance=Cm(.9);S.footer_distance=Cm(.9);S.different_first_page_header_footer=True
for n in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption']:
 st=D.styles[n];st.font.name='Noto Serif CJK SC';st._element.rPr.rFonts.set(qn('w:eastAsia'),'Noto Serif CJK SC');st.font.color.rgb=RGBColor(0,0,0)
st=D.styles['Normal'];st.font.size=Pt(10.5);st.paragraph_format.line_spacing=Pt(16);st.paragraph_format.space_after=Pt(6)
for n,size in [('Title',27),('Heading 1',18),('Heading 2',13),('Heading 3',11),('Caption',9)]:
 D.styles[n].font.size=Pt(size)
 D.styles[n].paragraph_format.space_before=Pt(8)
 D.styles[n].paragraph_format.space_after=Pt(8)
D.styles['Heading 1'].paragraph_format.keep_with_next=True
D.styles['Heading 2'].paragraph_format.keep_with_next=True
for st in D.styles:
 if st.type == 1:
  z=OxmlElement('w:snapToGrid');z.set(qn('w:val'),'0');st.element.get_or_add_pPr().append(z)
hp=S.header.paragraphs[0];hp.text='焦糖笔记 JotangNote  项目报告';hp.style='Caption'
f=S.footer.paragraphs[0];f.alignment=WD_ALIGN_PARAGRAPH.CENTER
f.add_run('第 ');fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');f._p.append(fld);f.add_run(' 页')
D.core_properties.title='焦糖笔记项目报告';D.core_properties.subject='Java 后端课程项目';D.core_properties.author='';D.core_properties.keywords='JotangNote Spring Boot MySQL Redis RabbitMQ'
def p(t):
 z=D.add_paragraph(t);z.paragraph_format.first_line_indent=Cm(.74);return z
def h(t,l=1):return D.add_heading(t,l)
def page(t):
 z=h(t);z.paragraph_format.page_break_before=True
def pic(path,caption,width=16):
 z=D.add_paragraph();z.alignment=WD_ALIGN_PARAGRAPH.CENTER;z.paragraph_format.line_spacing=1;z.paragraph_format.space_after=Pt(1);z.add_run().add_picture(str(path),width=Cm(width));z.paragraph_format.keep_with_next=True
 z=D.add_paragraph(caption,'Caption');z.alignment=WD_ALIGN_PARAGRAPH.CENTER

def table(headers,rows,widths=None):
 t=D.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 if widths:
  for c,w in zip(t.columns,widths):c.width=Cm(w)
 for c,x in zip(t.rows[0].cells,headers):c.text=x
 for row in rows:
  for c,x in zip(t.add_row().cells,row):c.text=str(x)
 for i,row in enumerate(t.rows):
  for j,c in enumerate(row.cells):
   if widths:c.width=Cm(widths[j])
   c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   tcPr=c._tc.get_or_add_tcPr(); borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    z=OxmlElement('w:'+edge);z.set(qn('w:val'),'single');z.set(qn('w:sz'),'5');z.set(qn('w:color'),'D9D9D9');borders.append(z)
   tcPr.append(borders)
   sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E6EDF2' if i==0 else ('F7F8F9' if i%2==0 else 'FFFFFF'));tcPr.append(sh)
   for z in c.paragraphs:
    z.paragraph_format.space_before=Pt(4);z.paragraph_format.space_after=Pt(4);z.paragraph_format.line_spacing=1.15
    for r in z.runs:r.font.size=Pt(9);r.bold=i==0
  if i==0:
   q=OxmlElement('w:tblHeader');row._tr.get_or_add_trPr().append(q)
 D.add_paragraph().paragraph_format.space_after=Pt(0)
def code(t):
 for line in t.strip().splitlines():
  z=D.add_paragraph();z.paragraph_format.space_after=Pt(1);z.paragraph_format.line_spacing=1.05
  r=z.add_run(line);r.font.name='DejaVu Sans Mono';r.font.size=Pt(8.5)
# Cover
D.add_paragraph('\n\n\n')
z=D.add_paragraph('焦糖笔记项目报告','Title');z.alignment=WD_ALIGN_PARAGRAPH.CENTER
z=D.add_paragraph('JotangNote','Subtitle');z.alignment=WD_ALIGN_PARAGRAPH.CENTER
D.add_paragraph('\n')
z=D.add_paragraph('基于 Java 的个人笔记管理与 AI 辅助系统');z.alignment=WD_ALIGN_PARAGRAPH.CENTER
D.add_paragraph('\n\n\n')
for s in ['课程项目报告','2026 年 11 月']:
 z=D.add_paragraph(s);z.alignment=WD_ALIGN_PARAGRAPH.CENTER
page('摘要与目录')
p('焦糖笔记面向个人学习记录场景，提供网页端账号登录、笔记管理和 AI 辅助入口。系统采用 Java 17 与 Spring Boot，将笔记保存在 MySQL 中，通过 Redis 缓存单篇笔记，并用 RabbitMQ 异步处理写操作。项目重点是把身份校验、数据归属、缓存失效和异步结果确认连接成能够实际运行的业务流程。')
p('本次云端验证通过了应用启动、笔记完整增删改查、跨用户访问隔离和缓存检查。AI 对话及 get_note 工具已在代码中实现；在线 AI 已通过普通对话、多轮记忆、读取笔记工具和跨用户隔离的真实接口测试。报告分别说明业务功能、代码实现和实际测试结果。')
p('关键词：Spring Boot；MySQL；Redis；RabbitMQ；Session；工具调用')
h('内容目录',2)
for t in ['1 项目背景与开发目的','2 项目需求分析','3 系统总体设计','4 技术选型及原因','5 系统架构与业务流程','6 数据库设计','7 核心功能及实现过程','8 关键技术实现','9 系统测试','10 项目成果与总结','参考资料与源码定位']:
 D.add_paragraph(t)
page('1 项目背景与开发目的')
h('1.1 项目背景',2)
p('学习 Java Web 时，单独写一个接口比较容易，但用户登录后如何保持身份、数据修改后缓存如何更新、异步请求什么时候算完成，需要在完整业务里才能看清楚。焦糖笔记以个人笔记为载体，把这些问题放在同一个小型应用中实现。')
p('项目最初来自焦糖工作室后端招新实践。仓库保留了启蒙篇、入门篇和进阶篇学习记录，开发过程先从命令行和 /hello 接口开始，再加入数据库、用户系统、中间件和 AI 工具。课程交付在原有功能基础上补齐运行包装、配置说明和验证证据。')
h('1.2 开发目的',2)
p('应用侧的目标是让用户在浏览器中创建和维护自己的文字笔记。用户登录后可以查看列表、按标题或正文进行本地筛选、修改笔记和删除笔记；编辑区显示保存状态，减少把尚未落库的请求误认为已保存的情况。')
p('工程侧的目标是完成一条可追踪的请求链路。前端只负责提交内容，后端从 Session 获取身份；数据库保存最终数据；Redis 提供可失效的读取副本；RabbitMQ 将写入请求交给消费者。AI 工具复用同一个笔记权限服务，避免在扩展功能中绕开访问控制。')
h('1.3 项目范围',2)
p('项目采用单个 Spring Boot 应用，配套一个静态网页和三个基础服务，适合个人学习及课程演示。正文为纯文本，尚未提供附件、评论、多人协作或持久化 AI 会话。系统没有做负载测试，本报告不据此推断并发能力，也不将课程运行配置作为生产部署方案。')
page('2 项目需求分析')
h('2.1 功能需求',2)
table(['模块','具体需求','实现边界'],[
 ['用户','注册、登录、当前用户查询、退出','用户名唯一；Session 保持身份'],
 ['笔记','创建、列表、详情、修改、删除','只能操作当前用户的数据'],
 ['编辑体验','搜索、排序、字数和保存状态','搜索在已加载列表中执行'],
 ['缓存','缓存单篇详情并设置有效期','更新和删除后清理对应键'],
 ['异步处理','提交写入消息并确认结果','202 只代表入队，前端继续查询'],
 ['AI 助手','多轮对话、清空会话、读取指定笔记','依赖外部 API；工具仍需鉴权']],[2.2,7.1,6.8])
h('2.2 数据与权限需求',2)
p('笔记包含标题、正文和作者。作者 ID 必须由后端从登录会话取出，不能相信请求体中的 authorId。匿名请求应被拒绝；用户即使知道别人的笔记 ID，也不能读取、更新或删除它。不存在和不属于当前用户的笔记统一返回 404，减少对其他用户数据的暴露。')
p('注册用户名为 2 至 32 个无空白字符，密码由后端检查 UTF-8 字节长度为 8 至 72。笔记标题不能为空且不超过 200 个 Java 字符，正文不能为空引用且长度不超过 100000。数据库的唯一键和外键继续承担数据约束。')
h('2.3 可运行与可验证需求',2)
p('运行实例应能从空白环境初始化数据库，通过统一命令启动依赖，并能使用真实请求验证主要功能。外部 AI 未配置或凭证失效时，应向用户说明原因，账号和笔记功能仍应正常使用。验证时同时检查 HTTP 状态、查询结果及 Redis 实际键值，不能只观察网页提示。')
page('3 系统总体设计')
p('系统采用浏览器与后端分工的结构。Spring Boot 同时提供静态页面和 REST 接口，浏览器通过同源 fetch 发送 JSON 请求，并自动携带会话 Cookie，因此不需要另外部署前端构建服务。')
p('后端按 Controller、Service、Mapper 和 MQ 消费者划分职责。Controller 处理请求与登录状态，NoteAccessService 统一校验数据归属，Mapper 负责 MySQL 持久化，消费者负责执行排队的写入。Redis 和 AI 接口是附加能力，数据库中的笔记仍是最终数据来源。')
pic(B/'architecture.png','图 3-1 系统总体结构')
h('3.1 模块之间的数据关系',2)
p('注册和登录直接访问 users 表。笔记列表经作者条件查询 notes 表，详情查询先尝试当前用户的缓存。写入请求先放入 note.operations 队列，再由监听器写入 MySQL。AI 对话历史存放在应用内存，调用 get_note 时通过 NoteAccessService 查询数据库，不允许模型直接连接数据库。')
h('3.2 部署设计',2)
p('交付版本增加多阶段 Dockerfile，构建阶段使用 Maven 和 JDK 17，运行阶段只保留 JRE 与应用 JAR。Compose 定义 app、mysql、redis 和 rabbitmq，等待基础服务健康后启动应用。数据库、缓存和队列数据分别使用命名卷；宿主机只映射 127.0.0.1 的网页端口。')
page('4 技术选型及原因')
table(['技术','版本或配置','在项目中的作用与选择原因'],[
 ['Java','17','提供实体、Record、分支表达式和服务端运行环境'],
 ['Spring Boot','4.1.1','统一 Web MVC、配置注入和应用启动，减少手工装配'],
 ['MyBatis-Plus','3.5.17','BaseMapper 提供基础 CRUD，实体字段映射数据库列'],
 ['MySQL','Compose 8.4','关系表适合表达用户和笔记归属，支持唯一键与外键'],
 ['Redis','Compose 7.4','用字符串保存 JSON 详情；TTL 控制缓存有效期'],
 ['RabbitMQ','Compose 3.13','Spring AMQP 负责生产和监听，实现请求与写入解耦'],
 ['Session 与 BCrypt','Spring 组件','会话保持登录身份；密码保存为单向哈希'],
 ['HTML CSS JavaScript','原生静态资源','页面由后端直接提供，同源调用接口，启动步骤少'],
 ['DeepSeek API','模型名可配置','通过 HTTP 调用模型，使用 get_note 获取业务数据'],
 ['GitHub Actions','Ubuntu Runner','在独立云端环境构建、测试并保留运行证据']],[3.3,3.3,9.5])
h('4.1 选型中的取舍',2)
p('对这个规模的项目，使用一个后端应用比拆成多个业务服务更容易理解和排查。保留 Redis 与 RabbitMQ 是为了练习缓存和异步处理，它们也增加了配置与故障处理成本。项目没有比较不同方案的性能，因此只能根据实现复杂度和学习目标说明选型，不能声称这些组件使小规模应用必然更快。')
p('鉴权采用服务端 Session，代码清楚地把 userId 与浏览器会话联系起来。它需要服务端维护状态，当前会话没有迁移到 Redis，也没有集群共享。项目仅引入 Spring Security 的 crypto 组件用于 BCrypt，并未采用完整的 Spring Security 登录过滤链或 JWT。')
page('5 系统架构与业务流程')
h('5.1 写操作流程',2)
pic(B/'write-flow.png','图 5-1 笔记异步写入与前端确认流程')
p('用户提交标题和正文后，Controller 检查登录与字段合法性。修改或删除还要先确认目标属于当前用户。消息携带操作类型、笔记 ID、标题、正文和 userId，生产者用 RabbitTemplate 发送 JSON，接口返回 202 Accepted。')
p('消费者通过 @RabbitListener 订阅持久化队列 note.operations，按 CREATE、UPDATE、DELETE 执行 Mapper 操作。更新和删除分支再次核对作者，写库后删除缓存。前端收到 202 后轮询列表，匹配新建记录或更新后的内容；删除则确认记录消失。只有观察到实际结果，页面才显示已保存或删除完成。')
h('5.2 读操作流程',2)
p('GET /api/notes 使用 author_id 条件返回当前用户列表。详情接口使用 note:userId:noteId 作为缓存键；命中后还检查缓存对象的 authorId。未命中时经 NoteAccessService 查询 MySQL，确认归属后再缓存 10 分钟。Redis 异常会回退到数据库读取。')
h('5.3 AI 工具流程',2)
p('ChatController 将用户 ID 与 Session ID 组合成会话标识。ChatService 累积消息历史，并把 get_note 的名称和参数结构交给模型。模型返回工具调用后，Java 解析 noteId 并执行带身份约束的查询，把工具结果写回历史后再次请求模型。单轮模型交互最多循环 5 次，以防止工具调用持续循环。')
page('6 数据库设计')
p('项目使用 jotang_note 数据库，字符集为 utf8mb4，表引擎为 InnoDB。users 与 notes 通过外键建立一对多关系，一名用户可以有多篇笔记，每篇笔记只有一个作者。初始化脚本为 sql/schema.sql，不包含测试账号或真实用户数据。')
pic(B/'database.png','图 6-1 用户与笔记数据关系',14.3)
table(['表','字段','类型与约束'],[
 ['users','id / username','BIGINT 自增主键 / VARCHAR(32) 唯一非空'],
 ['users','password_hash / created_at','VARCHAR(255) 非空 / DATETIME 默认当前时间'],
 ['notes','id / author_id','BIGINT 自增主键 / BIGINT 外键与普通索引'],
 ['notes','title / content','VARCHAR(200) / LONGTEXT，均非空'],
 ['notes','created_at / updated_at','DATETIME；后者随数据库更新自动刷新']],[2.1,5.4,8.6])
p('uk_users_username 防止重复用户名，即使两个注册请求同时通过查询，也由数据库约束兜底，后端捕获 DuplicateKeyException 后返回 409。idx_notes_author_id 支持按作者查询，fk_notes_author 限制笔记作者必须存在。应用未实现用户删除功能，因此没有定义级联删除业务。')
p('脚本使用 CREATE TABLE IF NOT EXISTS，只适合新建实例的初始化，不会自动迁移旧表。已有数据库需要先备份并比较表结构，不能通过重复执行脚本假设字段已经更新。Compose 仅在 MySQL 数据卷首次初始化时运行该脚本。')
page('7 核心功能及实现过程')
h('7.1 注册与登录',2)
p('注册接口先去除用户名首尾空白，检查长度、空白字符和密码字节数，再查询重名用户。密码经 BCryptPasswordEncoder.encode 处理，users 表只保存 password_hash。登录时调用 matches 校验，成功后 changeSessionId 更新会话 ID，再写入 userId，降低会话固定风险。退出接口销毁 Session。')
pic(B/'login-detail.png','图 7-1 云端 Chromium 中的真实登录与注册页面',6.2)
h('7.2 笔记归属检查',2)
p('NoteAccessService.findOwned 的返回条件同时要求笔记存在以及 authorId 等于当前用户 ID。网页不能通过隐藏按钮完成安全控制，API 和消息消费者也分别检查身份。创建时使用 Session 中的用户 ID 赋值作者，忽略客户端可能提交的作者字段。')
code('''Note note = noteMapper.selectById(noteId);
return note != null && userId.equals(note.getAuthorId())
        ? note : null;''')
p('该服务同时供详情接口、更新与删除的前置检查以及 AI get_note 使用。把检查集中在服务中，可以减少不同入口各自实现权限规则而出现遗漏的机会。')
page('7 核心功能及实现过程 续')
h('7.3 网页笔记编辑',2)
p('页面左侧列出当前账号的笔记，右侧提供标题和正文编辑。保存按钮提交 CREATE 或 UPDATE 请求；删除按钮要求确认。搜索匹配已加载笔记的标题和正文，排序可选择最近修改或最新创建。字数和未保存状态由前端根据当前编辑内容更新。')
pic(R/'Notes/screenshots/02-notes.png','图 7-2 经浏览器提交并由消息队列写入的笔记')
h('7.4 保存状态与异常处理',2)
p('前端维护 baseline、dirty 和 pendingOperation。未保存修改离开编辑区前会提示确认。请求入队后，页面按逐步增加的间隔查询列表，最多轮询 10 次；若还没有匹配结果，显示已入队待确认，并提供重新检查按钮。这样的状态比收到 202 立即显示成功更准确。')
p('加载失败时可重试。接口返回 401 后页面恢复登录状态。笔记标题和列表文本在插入 HTML 前进行转义，AI 回复使用 textContent 呈现，避免把用户内容直接作为可执行标签解释。项目仍需补充完整的生产安全防护和更系统的异常规范。')
page('8 关键技术实现')
h('8.1 Redis 缓存及降级',2)
p('缓存值是单篇 Note 的 JSON，键格式为 note:userId:noteId。键中带用户身份，命中后仍比较缓存对象作者，避免将缓存当成可信的权限结论。缓存未命中时查询 MySQL，只有允许读取的笔记才会被缓存。')
code('''String key = "note:" + userId + ":" + id;
redisTemplate.opsForValue().set(
    key, jsonMapper.writeValueAsString(note),
    Duration.ofMinutes(10));''')
p('数据库更新或删除完成后，消费者删除相同格式的键。缓存读写捕获异常，读接口可以继续走数据库。当前失效策略在普通顺序请求下通过了测试；它没有通过锁或版本号解决并发读写竞争，也没有为大规模空查询、热点过期提供专门策略。')
h('8.2 RabbitMQ 异步处理',2)
p('RabbitConfig 声明持久化队列，NoteOperationMessage 使用 Java Record 表达消息数据。消费者收到 JSON 后反序列化，并根据操作类型处理。数据库成功写入和 HTTP 请求被接受属于不同时间点，需要通过后续查询区分。')
code('''rabbitTemplate.convertAndSend(
    RabbitConfig.NOTE_QUEUE,
    jsonMapper.writeValueAsString(message));
return ResponseEntity.accepted()
    .body(Map.of("message", "create operation queued"));''')
p('当前实现没有完整的发布确认、业务幂等标识、死信队列及操作状态表。队列持久化也不等于整个业务具备不丢不重的保证。后续若用于长期服务，应先补齐消息重复消费和写库后异常重试的处理，而不是仅依靠前端轮询。')
page('8 关键技术实现 续')
h('8.3 AI 多轮历史与工具调用',2)
p('ChatService 使用 ConcurrentHashMap 保存不同会话的消息列表，并对同一个历史列表加锁。每轮先加入用户消息，再保存模型的 assistant 消息；工具调用中，assistant tool_calls 与 Java 返回的 tool 消息也都进入上下文。DELETE /chat 删除当前会话的历史。')
p('get_note 工具只接受 noteId，真正执行时另外传入已登录的 userId。模型返回的参数不能决定身份，查询仍走 NoteAccessService.findOwned。跨用户或不存在的笔记返回错误 JSON，模型只能根据允许得到的数据生成回答。该调用链既有模拟模型的单元测试，也有真实模型调用验证。在线测试先创建含随机标识的笔记，再要求模型读取正文；模型准确复述了提问中未给出的标识，第二个账号无法获取该标识。')
pic(R/'Notes/screenshots/05-ai-live.png','图 8-1 真实模型回复与读取笔记校验结果')
h('8.4 外部服务配置与故障提示',2)
p('交付版本通过 DEEPSEEK_API_KEY、DEEPSEEK_BASE_URL 和 DEEPSEEK_MODEL 设置凭证、地址和模型。密钥只进入服务端环境，不发送到前端。未配置、鉴权失败、余额不足或限流时，接口返回 503 和中文提示；其他连接或响应异常返回 502，避免向用户暴露上游异常详情。')
p('联调时曾遇到外部密钥失效，服务端已补充中文配置提示。更新凭证后，真实对话、多轮历史和 get_note 均验证通过。AI 历史只在内存中保存，重启后丢失，也尚未增加容量上限和自动过期。')
page('9 系统测试')
h('9.1 测试环境与方法',2)
p('测试在 GitHub Actions Ubuntu Runner 中进行，使用 JDK 17、真实 MySQL 8.4、Redis 7.4 和 RabbitMQ 3.13。流水线从 sql/schema.sql 初始化数据库后执行 Maven verify，启动打包 JAR，再运行 HTTP 冒烟脚本及 Chromium 浏览器自动化。每次测试创建独立临时账号与笔记，不使用个人笔记。')
p(f"本轮验证运行编号为 {E['run_id']}，对应提交为 {E['commit'][:12]}。Maven 的 Surefire XML 记录 {E['tests']['tests']} 项测试，失败 {E['tests']['failures']} 项，错误 {E['tests']['errors']} 项，跳过 {E['tests']['skipped']} 项。测试范围包括应用上下文启动、笔记归属检查以及 AI 工具对当前用户身份的使用。")
table(['测试场景','检查方法','实际结果'],[
 ['匿名访问','GET /api/notes','401，符合预期'],
 ['双用户注册登录','真实 HTTP 请求和 Cookie','均为 200'],
 ['创建笔记','202 后轮询列表','数据库记录实际出现'],
 ['跨用户读取修改删除','用户 B 请求用户 A 的 ID','均为 404，列表中无泄露'],
 ['Redis 缓存','连续读取后 redis-cli 检查','JSON ID 正确，TTL 为 600 秒'],
 ['更新与缓存失效','PUT 后轮询详情','返回修改后的标题与正文'],
 ['删除与缓存失效','DELETE 后查询并检查键','详情 404，Redis 键不存在'],
 ['浏览器操作','Chromium 注册登录及创建','真实页面与数据均完成'],
 ['在线 AI','普通对话、记忆、工具读取、权限隔离','均通过真实 API 测试']],[3.8,6.3,6.0])
p('NoteAccessServiceTest 中的 3 个测试检查本人、他人以及缺失身份或记录；ChatServiceTest 通过模拟模型请求 get_note，断言服务查询携带的是当前用户 ID。模拟模型测试证明的是工具分发和鉴权逻辑，不代表外部模型请求成功。')
page('9 系统测试 续')
h('9.2 运行证据',2)
pic(R/'Notes/screenshots/04-verified-ci-log.png','图 9-1 从实际 HTTP 与 RabbitMQ 日志生成的运行证据',15.5)
p('图中记录了 HTTP 冒烟断言和消息消费者输出。测试不仅检查接口接受请求，还等待异步数据出现、更新和消失，并用 redis-cli 直接核对缓存。运行记录和原始摘要保存在源码 course/evidence 中，便于按运行编号复查。')
h('9.3 AI 与测试边界',2)
p('本次真实在线测试通过了普通对话、随机词的多轮记忆、模型调用 get_note 读取数据库中的随机标识，以及跨用户读取拒绝。浏览器实际调用 POST /chat 并得到 HTTP 200 与非空回复。临时标识只存在于笔记正文中，未在读取问题中提供，因此可以验证模型确实取得了工具返回的数据。')
p('本次未进行压力测试、消息重复投递、数据库宕机恢复、缓存竞争和集群 Session 测试，也未声称覆盖所有异常。接口和浏览器流程通过说明当前测试条件下的主要功能可用，不能代替生产环境稳定性评估。')
page('10 项目成果与总结')
h('10.1 已完成成果',2)
p('项目已经形成能够独立运行的网页笔记应用。用户注册登录后可以管理自己的笔记，权限规则覆盖普通 HTTP 接口和 AI 工具入口。MySQL、Redis 与 RabbitMQ 各自承担持久化、详情缓存和异步写入，前端通过后续查询确认写入结果。')
p('交付版本补充 Compose、多阶段 Dockerfile、示例环境变量和数据库初始化方式。课程材料包含项目报告、可编辑课堂幻灯片和带中文字幕的真实操作演示。源码继续保留 Git 提交记录，运行证据可以对应到具体云端验证。')
h('10.2 实现过程中的认识',2)
p('这次实现中，最需要区分的是请求完成和业务完成。RabbitMQ 接口的 202 只说明请求已被接收，如果网页立即显示保存成功，用户可能误以为笔记已经进入数据库。让前端核对真实结果后，接口语义和用户看到的状态才能保持一致。')
p('另一个重点是不要把鉴权只放在页面入口。详情缓存、消息消费者和 AI 工具都会接触笔记，因此需要逐层传递当前用户身份。缓存键包含 userId、消费者再次检查作者、工具复用权限服务，这些具体检查比单纯隐藏界面按钮更可靠。')
h('10.3 后续改进',2)
p('后续应先补齐消息幂等与死信处理、持久化操作状态、并发缓存一致性，以及会话历史的容量与生命周期管理。需要长期部署时，还应完善 HTTPS、CSRF 防护、登录限流和数据库迁移。部署时需要提供有效 AI 凭证；后续可增加上游超时重试和会话容量管理。')
page('参考资料与源码定位')
for t in ['项目仓库：https://github.com/ressuir/JotangNote','运行证据：course/evidence/current.json 与 jotang-smoke.log','数据库定义：sql/schema.sql；实体：entity/User.java 与 Note.java','鉴权与笔记：controller/AuthController.java、NoteController.java、service/NoteAccessService.java','消息队列：mq/RabbitConfig.java、NoteOperationConsumer.java','AI 工具：ai/ChatService.java、ModelClient.java；浏览器：static/app.js','DeepSeek Chat Completions 官方文档：https://api-docs.deepseek.com/api/create-chat-completion/']:
 z=D.add_paragraph(t);z.paragraph_format.space_after=Pt(3)
 for r in z.runs:r.font.size=Pt(8)
OUT=R/'course/artifacts';OUT.mkdir(exist_ok=True)
for root in [D._element,D.styles.element]:
 for el in list(root.iter(qn('w:pBdr'))):el.getparent().remove(el)
D.save(OUT/'焦糖笔记项目报告.docx')
print('DOCX created')
