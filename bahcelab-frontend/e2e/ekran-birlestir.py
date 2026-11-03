"""Mobil ekran parçalarını (ekran-9h.spec.ts ve jlnnlk betiği) tek uzun görüntüde birleştirir. Kullanım: python3 e2e/ekran-birlestir.py <klasör>"""
import json,glob,sys
from PIL import Image
for jf in glob.glob(sys.argv[1]+'/*-tam-390.json'):
    m=json.load(open(jf)); ch=m['ch']; parts=m['parts']
    imgs=[Image.open(p['f']) for p in parts]
    total=parts[-1]['y']+imgs[-1].height
    out=Image.new('RGB',(imgs[0].width,total),'white')
    for p,im in zip(parts,imgs): out.paste(im,(0,p['y']))
    out.save(jf[:-5]+'.png')
