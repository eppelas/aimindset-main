import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('public_build',Path(__file__).with_name('public_build.py'))
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class PreviewOutput(unittest.TestCase):
    def test_stale_preview_file_moves_outside_public_artifact(self):
        out=Path(tempfile.mkdtemp(prefix='aim-preview-retire-test-'))
        stale=out/'private-old-source.txt';stale.write_text('retained rollback fixture')
        builder.build(ROOT,out)
        self.assertFalse(stale.exists())
        archives=list(out.parent.glob(out.name+'-retired-*'))
        self.assertEqual(len(archives),1)
        self.assertEqual((archives[0]/stale.name).read_text(),'retained rollback fixture')
        self.assertEqual(json.loads((archives[0]/'src-dst-log.json').read_text())[0]['source'],str(stale))
if __name__=='__main__':unittest.main()
