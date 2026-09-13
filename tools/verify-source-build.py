"""Verify source assembly without changing the working HTML."""
import argparse
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--platform', required=True, type=Path)
parser.add_argument('--platform-revision', help='Explicit exact parent commit; defaults to the consumer dependency pin')
args = parser.parse_args()
spec = importlib.util.spec_from_file_location('source_build', root / 'tools/source-build.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
output = Path(tempfile.mkdtemp(prefix='wild-source-build-'))
module.build(args.platform, output, platform_revision=args.platform_revision)
for name in ('index.html', 'assets/site/site-shell.js'):
    assert (output / name).read_bytes() == (root / name).read_bytes(), name
html = (output / 'index.html').read_text()
assert '{{source:' not in html and '{{shared:' not in html
for marker in ('waitlist', 'motion', 'responsive'):
    assert 'data-learning-runtime="' + marker + '"' in html
subprocess.run(['node', str(root / 'tools/verify-animation-scheduling.cjs'), str(output / 'index.html')], check=True)
manifest = json.loads((root / 'source-manifest.json').read_text())
runtime = [str(root / block['path']) for block in manifest['blocks'] if block['tag'] == 'script']
subprocess.run(['node', '-e', "const fs=require('fs'),vm=require('vm');for(const p of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(fs.readFileSync(p,'utf8'),{filename:p});"], input=json.dumps(runtime), text=True, check=True)
print('PASS byte-identical HTML/shell roundtrip, shared learning runtimes, generated scheduling, all extracted JS syntax')
