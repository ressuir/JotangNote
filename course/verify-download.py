"""Verify the actual downloaded release ZIP, independent of packaging paths."""
from pathlib import Path
import zipfile,hashlib,subprocess,tempfile,json,xml.etree.ElementTree as E,re
p=Path('download/JotangNote-course-delivery.zip');out=Path('download/unpacked');out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(p)as z:
 assert z.testzip() is None
 for n in z.namelist():assert not n.startswith('/') and '..' not in Path(n).parts
 z.extractall(out)
r=out/'焦糖笔记';required=['项目报告/焦糖笔记项目报告.docx','项目报告/焦糖笔记项目报告.pdf','项目介绍/焦糖笔记项目介绍.pptx','演示视频/焦糖笔记演示.mp4','演示视频/中文字幕.srt','项目源码/完整可运行项目/compose.yaml','项目源码/完整可运行项目/sql/schema.sql','README.md']
assert all((r/x).is_file()for x in required)
n=0
for line in (r/'SHA256SUMS.txt').read_text().splitlines():
 sha,path=line.split('  ',1);assert hashlib.sha256((r/path).read_bytes()).hexdigest()==sha,path;n+=1
source=r/'项目源码/完整可运行项目';hist=Path(tempfile.mkdtemp(prefix='jotang-history-'))
subprocess.run(['git','clone','--quiet',str((source/'Git历史.bundle').resolve()),str(hist/'repo')],check=True)
head=subprocess.check_output(['git','-C',str(hist/'repo'),'rev-parse','HEAD'],text=True).strip()
m=json.loads((r/'验收记录.json').read_text());assert head==m['source_commit']
video=r/'演示视频/焦糖笔记演示.mp4';data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
v=next(x for x in data['streams']if x['codec_type']=='video');duration=float(data['format']['duration'])
assert (v['width'],v['height'],v['codec_name'])==(1920,1080,'h264') and 180<duration<240
assert not any(x['codec_type']=='audio'for x in data['streams'])
info=subprocess.check_output(['pdfinfo',str(r/'项目报告/焦糖笔记项目报告.pdf')],text=True)
assert re.search(r'Pages:\s+16\b',info)
with zipfile.ZipFile(r/'项目介绍/焦糖笔记项目介绍.pptx') as z:assert len([n for n in z.namelist()if re.match(r'ppt/slides/slide\d+\.xml$',n)])==10
srt=(r/'演示视频/中文字幕.srt').read_text(encoding='utf-8-sig');cues=re.findall(r'\d+\n(\d\d:\d\d:\d\d,\d\d\d) --> (\d\d:\d\d:\d\d,\d\d\d)\n(.*?)(?=\n\n|\Z)',srt,re.S);assert len(cues)==18
subprocess.run(['docker','compose','-f',str(source/'compose.yaml'),'config','--quiet'],check=True)
print(json.dumps({'downloaded_zip_bytes':p.stat().st_size,'checksums_verified':n,'required_deliverables_present':True,'git_bundle_restored_commit':head,'video_seconds':duration,'video_resolution':'1920x1080','video_codec':'h264','audio_streams':0,'srt_cues':len(cues)},ensure_ascii=False,indent=2))
