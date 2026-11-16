import urllib.request,urllib.error,http.cookiejar,json,time,subprocess,os
base=os.environ.get('BASE_URL','http://localhost:8080')
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,path,method='GET',data=None):
 req=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers={'Content-Type':'application/json'},method=method)
 try:
  r=c.open(req,timeout=15);s=r.status;b=r.read().decode()
 except urllib.error.HTTPError as e:s=e.code;b=e.read().decode()
 return s,json.loads(b) if b else None
def wait(fn):
 for _ in range(40):
  r=fn()
  if r:return r
  time.sleep(.3)
 raise AssertionError('async operation did not complete')
a=client();b=client();stamp=str(time.time_ns())[-12:];pw='compose-smoke-123'
assert call(a,'/api/notes')[0]==401
for c,name in [(a,'ca'+stamp),(b,'cb'+stamp)]:
 d={'username':name,'password':pw};assert call(c,'/api/auth/register','POST',d)[0]==200;assert call(c,'/api/auth/login','POST',d)[0]==200
uid=call(a,'/api/auth/me')[1]['id']
assert call(a,'/api/notes','POST',{'title':'Compose smoke '+stamp,'content':'actual data'})[0]==202
note=wait(lambda:next(iter(call(a,'/api/notes')[1]),None));nid=note['id']
for m,d in [('GET',None),('PUT',{'title':'forbidden','content':'x'}),('DELETE',None)]:assert call(b,f'/api/notes/{nid}',m,d)[0]==404
assert call(a,f'/api/notes/{nid}')[0]==200
key=f'note:{uid}:{nid}'
def redis(*args):return subprocess.check_output(['docker','compose','exec','-T','redis','redis-cli','--raw',*args],text=True).strip()
assert json.loads(redis('GET',key))['id']==nid;assert 0<int(redis('TTL',key))<=600
assert call(a,f'/api/notes/{nid}','PUT',{'title':'updated','content':'updated data'})[0]==202
wait(lambda:call(a,f'/api/notes/{nid}')[1].get('content')=='updated data')
assert call(a,f'/api/notes/{nid}','DELETE')[0]==202
wait(lambda:call(a,f'/api/notes/{nid}')[0]==404);assert redis('EXISTS',key)=='0'
assert call(a,'/api/auth/logout','POST')[0]==200;assert call(a,'/api/notes')[0]==401
print('PASS Compose: startup, anonymous 401, two users, owner-only CRUD, real Redis TTL, async update/delete, cache invalidation, logout 401')
