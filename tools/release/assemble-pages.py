"""Create an artifact from tracked Main files plus the verified Wild public output."""
from pathlib import Path
import subprocess,sys,shutil
main,wild,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
for rel in subprocess.check_output(['git','ls-files','-z'],cwd=main).decode().split('\0'):
 if not rel or rel.split('/')[0] in ('.git','.github','wild') or rel.startswith('.') and rel!='.nojekyll':continue
 p=main/rel
 if not p.is_file() or p.is_symlink():continue
 q=out/rel;q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
for p in wild.rglob('*'):
 if p.is_file():
  q=out/'wild'/p.relative_to(wild);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
