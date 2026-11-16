from pathlib import Path
import json,subprocess,shutil,zipfile,hashlib,re,os,xml.etree.ElementTree as E
O=Path('course-output'); root=O/'焦糖笔记';root.mkdir(exist_ok=True)
for d in ['项目报告','项目介绍','演示视频','项目源码']:(root/d).mkdir(exist_ok=True)
for f,d in [('焦糖笔记项目报告.docx','项目报告'),('焦糖笔记项目报告.pdf','项目报告'),('焦糖笔记项目介绍.pptx','项目介绍')]:
 p=Path('course/artifacts')/f;assert p.stat().st_size>20000;shutil.copy2(p,root/d/f)
for f in ['焦糖笔记演示.mp4','中文字幕.srt']:shutil.copy2(O/f,root/'演示视频'/f)
# Parse Office packages, relationships and media before delivery.
for f in root.rglob('*.docx'):
 with zipfile.ZipFile(f) as z:
  assert z.testzip() is None
  E.fromstring(z.read('word/document.xml'))
  assert len([x for x in z.namelist() if x.startswith('word/media/')])>=7
for f in root.rglob('*.pptx'):
 with zipfile.ZipFile(f) as z:
  assert z.testzip() is None
  slides=[x for x in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',x)]
  assert len(slides)==10
  for n in slides:E.fromstring(z.read(n))
# Source snapshot is taken from committed files, never from CI secrets or local caches.
archive=O/'source.tar';subprocess.run(['git','archive','--format=tar','-o',str(archive),'HEAD'],check=True)
source=root/'项目源码'/'完整可运行项目';source.mkdir(exist_ok=True)
subprocess.run(['tar','-xf',str(archive),'-C',str(source)],check=True)
shutil.rmtree(source/'course/artifacts',ignore_errors=True)
shutil.rmtree(source/'course/qa',ignore_errors=True)
# Keep the complete genuine commit graph separately from the runnable source snapshot.
subprocess.run(['git','bundle','create',str(source/'Git历史.bundle'),'--all'],check=True)
log=subprocess.check_output(['git','log','--all','--date=iso-strict','--format=%h %ad %s'],text=True)
(source/'提交记录.txt').write_text(log)
for f in source.rglob('*'):
 if f.is_file() and f.suffix in ['.java','.js','.cjs','.properties','.md','.yaml','.yml']:
  t=f.read_text(errors='ignore');assert not re.search(r'sk-[A-Za-z0-9]{25,}',t),f
assert not (source/'.env').exists()
readme='''# 焦糖笔记课程交付

本包包含四项课程成果：项目报告（Word 与 PDF）、10 页可编辑 PowerPoint、真实项目演示视频与中文字幕、完整可运行源码。

## 查看顺序

1. 阅读项目报告了解背景、架构、数据库与测试。
2. 打开项目介绍中的 PPTX，用于课堂讲解。
3. 播放演示视频中的 MP4；视频无语音，中文字幕已嵌入。SRT 可单独修改。
4. 进入项目源码/完整可运行项目，按 README.md 启动实例。

## 运行实例

安装 Docker 与 Docker Compose v2，在完整可运行项目目录执行：

```bash
cp .env.example .env
docker compose up --build -d
docker compose logs -f app
```

看到应用启动完成后访问 http://localhost:8080/，注册新账号开始使用。首次运行需要联网拉取镜像和 Maven 依赖。AI 为可选功能，在 .env 设置自己的 DEEPSEEK_API_KEY 后重新创建 app 容器；密钥不会随课程包分发。

## 测试与源码记录

源码中的 course/evidence 保留真实云端测试摘要；Git历史.bundle 保留真实提交图，可执行 git clone Git历史.bundle JotangNote-history 恢复仓库。当前版本已验证账号与笔记、Redis 缓存、RabbitMQ 异步写入、真实 AI 对话与工具权限隔离。

项目未实现 MQ 幂等与死信队列、持久化操作状态和集群会话，未做压力测试。报告、幻灯片与视频均按这些实际范围说明。
'''
(root/'README.md').write_text(readme,encoding='utf-8')
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();v=json.loads((O/'video-validation.json').read_text())
manifest={'source_commit':head,'verification':json.loads(Path('course/evidence/current.json').read_text()),'video':v,'checks':{'office_packages_parse':True,'pptx_slide_count':10,'docx_images_present':True,'source_git_bundle':True,'no_env_file':True}}
(root/'验收记录.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
sha=[]
for f in sorted(root.rglob('*')):
 if f.is_file():sha.append(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.relative_to(root).as_posix())
(root/'SHA256SUMS.txt').write_text('\n'.join(sha)+'\n')
zipname=O/'焦糖笔记课程交付.zip'
with zipfile.ZipFile(zipname,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(root.rglob('*')):
  if f.is_file():z.write(f,f.relative_to(O))
with zipfile.ZipFile(zipname) as z:assert z.testzip() is None
print(json.dumps(manifest,ensure_ascii=False,indent=2));print('ZIP bytes:',zipname.stat().st_size)
