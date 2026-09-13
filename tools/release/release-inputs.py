"""Resolve the exact checked-out pair and skip an unchanged scheduled release."""
import json,os,re,subprocess,sys
from urllib.request import urlopen
source,platform=sys.argv[1:]
def revision(folder):
    value=subprocess.check_output(['git','-C',folder,'rev-parse','HEAD'],text=True).strip()
    if not re.fullmatch('[0-9a-f]{40}',value):raise ValueError('Invalid input revision')
    return value
record={'source_sha':revision(source),'platform_sha':revision(platform),'changed':'true'}
if os.environ.get('GITHUB_EVENT_NAME')=='schedule':
    try:
        with urlopen('https://eppelas.github.io/aimindset-main/wild/release-manifest.json',timeout=10) as response:
            published=json.load(response)
        if published.get('sourceCommit')==record['source_sha'] and published.get('platformCommit')==record['platform_sha']:
            record['changed']='false'
    except (OSError,ValueError):
        pass
if os.environ.get('GITHUB_OUTPUT'):
    with open(os.environ['GITHUB_OUTPUT'],'a') as output:
        for key,value in record.items():output.write(key+'='+value+'\n')
print(json.dumps(record))
