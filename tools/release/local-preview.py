"""Prepare/reuse an exported preview; the shell launcher opens the returned URL."""
import errno,hashlib,json,os,socket,subprocess,sys,tempfile,time
from pathlib import Path
from urllib.request import urlopen

root=Path(__file__).resolve().parents[2]
platform=None
candidates=[Path(os.environ['AIM_PLATFORM_PATH'])] if os.environ.get('AIM_PLATFORM_PATH') else []
for parent in root.parents:
    candidates += [parent/'aim-web-platform',parent/'5 Work/AI Mindset/aim-web-platform']
for candidate in candidates:
    if (candidate/'platform_core/shared.py').is_file(): platform=candidate;break
if not platform:
    raise SystemExit('Set AIM_PLATFORM_PATH to the local aim-web-platform checkout.')

statefile=Path(tempfile.gettempdir())/('aim-wild-preview-'+hashlib.sha256(str(root).encode()).hexdigest()[:16]+'.json')
reuse=None
if statefile.is_file():
    try:
        state=json.loads(statefile.read_text())
        with urlopen(f"http://127.0.0.1:{int(state['port'])}/__preview-health",timeout=1) as response: health=json.load(response)
        candidate=Path(state['output'])
        if candidate.is_dir() and candidate.resolve().is_relative_to(Path(tempfile.gettempdir()).resolve()) and health.get('preview')=='aim-wild-public' and health.get('root')==str(candidate.resolve()): reuse=state
    except (OSError,ValueError,KeyError): pass
subprocess.run([sys.executable,str(root/'tools/source-build.py'),'--platform',str(platform)],check=True,stdout=sys.stderr)
output=Path(reuse['output']) if reuse else Path(tempfile.mkdtemp(prefix='aim-wild-public-preview-'))
subprocess.run([sys.executable,str(root/'tools/release/public_build.py'),'--output',str(output)],check=True,stdout=sys.stderr)
if reuse:
    print(f"http://localhost:{int(reuse['port'])}/")
    raise SystemExit(0)
port=int(os.environ.get('AIM_PREVIEW_PORT','4468'))
if not 1 <= port <= 65535:
    raise SystemExit('AIM_PREVIEW_PORT must be between 1 and 65535.')
for port in range(port,min(port+100,65536)):
    with socket.socket() as probe:
        try: probe.bind(('0.0.0.0',port))
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                raise SystemExit('Preview cannot bind a local port: '+str(error)) from error
        else: break
else: raise SystemExit('No free preview port in the checked range.')
log=output.parent/('aim-wild-public-preview-'+str(port)+'.log')
with log.open('a') as stream:
    process=subprocess.Popen([sys.executable,str(root/'tools/release/preview.py'),'--root',str(output),'--port',str(port)],stdout=stream,stderr=stream,start_new_session=True)
url=f'http://localhost:{port}/'
for _ in range(30):
    if process.poll() is not None: raise SystemExit('Preview failed: '+str(log))
    try:
        with urlopen(url+'__preview-health',timeout=1) as response: health=json.load(response)
        if health.get('root')==str(output.resolve()): break
    except OSError: time.sleep(.1)
else: raise SystemExit('Preview is not ready: '+str(log))
print(url)
statefile.write_text(json.dumps({'port':port,'output':str(output),'project':str(root)})+'\n')
try:
    lan=subprocess.check_output(['ipconfig','getifaddr','en0'],text=True,stderr=subprocess.DEVNULL).strip()
    if lan: print(f'Phone: http://{lan}:{port}/',file=sys.stderr)
except (OSError,subprocess.CalledProcessError): pass
