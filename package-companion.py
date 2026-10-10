from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parent
with ZipFile(root/'dist/slotcare-companion.zip','w',ZIP_DEFLATED) as z:
    for p in sorted((root/'companion').iterdir()):
        z.write(p,p.name)
    z.write(root/'README.md','README.md')
print('Packaged companion ZIP.')
