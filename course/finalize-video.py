from pathlib import Path
import json,subprocess,re
O=Path('course-output'); scenes=json.loads((O/'scenes.json').read_text());cuts=json.loads((O/'cuts.json').read_text())
D=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(O/'raw-demo.webm')]))
# Remove long model-loading intervals. All remaining frames come from the real recording.
def mapped(t): return t-sum(max(0,min(t,c['end'])-c['start']) for c in cuts)
def stamp(t):
 m=round(t*1000);return f'{m//3600000:02}:{m//60000%60:02}:{m//1000%60:02},{m%1000:03}'
def at(t):
 c=round(t*100);return f'{c//360000:01}:{c//6000%60:02}:{c//100%60:02}.{c%100:02}'
srt=[];ass=['[Script Info]','ScriptType: v4.00+','PlayResX: 1920','PlayResY: 1080','WrapStyle: 0','','[V4+ Styles]','Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding','Style: Default,Noto Sans CJK SC,35,&H00FFFFFF,&H00FFFFFF,&H00101010,&H60000000,0,0,0,0,100,100,0,0,1,1.5,0,2,90,90,25,1','','[Events]','Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
for i,s in enumerate(scenes,1):
 a=mapped(s['start']);b=mapped(s['end']);srt +=[str(i),stamp(a)+' --> '+stamp(b),s['subtitle'],'']
 text=s['subtitle'].replace('\n','\\N');ass.append(f'Dialogue: 0,{at(a)},{at(b)},Default,,0,0,0,,{text}')
(O/'中文字幕.srt').write_text('\n'.join(srt),encoding='utf-8-sig');(O/'subtitles.ass').write_text('\n'.join(ass),encoding='utf-8')
segments=[];last=0
for c in sorted(cuts,key=lambda x:x['start']):
 if c['start']>last:segments.append((last,c['start']))
 last=c['end']
segments.append((last,min(D,scenes[-1]['end']+.15)))
filters=[]
for i,(a,b) in enumerate(segments):filters.append(f'[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]')
filters.append(''.join(f'[v{i}]'for i in range(len(segments)))+f'concat=n={len(segments)}:v=1:a=0[cut]')
filters.append('[cut]scale=1706:960,pad=1920:1080:107:0:color=0x101820,ass=course-output/subtitles.ass[v]')
subprocess.run(['ffmpeg','-hide_banner','-y','-i',str(O/'raw-demo.webm'),'-filter_complex',';'.join(filters),'-map','[v]','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',str(O/'焦糖笔记演示.mp4')],check=True)
p=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(O/'焦糖笔记演示.mp4')]))
v=next(s for s in p['streams'] if s['codec_type']=='video');duration=float(p['format']['duration'])
assert v['codec_name']=='h264' and (v['width'],v['height'])==(1920,1080)
assert 180<=duration<=240,duration
assert all(mapped(s['end'])>mapped(s['start'])for s in scenes)
for i,s in enumerate(scenes):
 t=(mapped(s['start'])+mapped(s['end']))/2
 subprocess.run(['ffmpeg','-loglevel','error','-y','-ss',str(t),'-i',str(O/'焦糖笔记演示.mp4'),'-frames:v','1','-vf','scale=960:540',str(O/f'qa-{i+1:02}.png')],check=True)
quality={'video':{'duration_seconds':duration,'width':v['width'],'height':v['height'],'codec':v['codec_name'],'audio_streams':sum(s['codec_type']=='audio'for s in p['streams'])},'subtitle_scenes':len(scenes),'cut_wait_seconds':sum(c['end']-c['start']for c in cuts),'scene_timeline':[dict(title=s['label'],start=mapped(s['start']),end=mapped(s['end']))for s in scenes]}
(O/'video-validation.json').write_text(json.dumps(quality,ensure_ascii=False,indent=2))
print(json.dumps(quality,ensure_ascii=False,indent=2))
