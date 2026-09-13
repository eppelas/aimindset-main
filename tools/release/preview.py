"""Serve public output and a source baseline at identical asset-relative URLs."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import argparse,json
ap=argparse.ArgumentParser();ap.add_argument('--root',type=Path,required=True);ap.add_argument('--baseline',type=Path);ap.add_argument('--port',type=int,default=4468);a=ap.parse_args()
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(a.root),**kwargs)
 def do_GET(self):
  u=urlsplit(self.path)
  if u.path == '/__preview-health':
   data=json.dumps({'preview':'aim-wild-public','root':str(a.root.resolve())}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data);return
  if a.baseline and u.path in ('/','/index.html') and 'baseline' in parse_qs(u.query):
   data=a.baseline.read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  super().do_GET()
ThreadingHTTPServer(('0.0.0.0',a.port),Handler).serve_forever()
