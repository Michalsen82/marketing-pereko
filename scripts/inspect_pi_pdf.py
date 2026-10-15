import re
import urllib.request
import fitz

url='https://www.pereko.pl/downloads/pi-dtr.pdf'
req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (PEREKO diagnostic)'})
data=urllib.request.urlopen(req,timeout=120).read()
doc=fitz.open(stream=data,filetype='pdf')
print('PI pages:',doc.page_count)
for i in range(doc.page_count):
    text=doc.load_page(i).get_text('text')
    norm=re.sub(r'\s+',' ',text).strip()
    upper=norm.upper()
    if 'PX100' in upper or ('REGULATOR' in upper and 'INSTRUKCJA' in upper):
        print(f'--- PAGE {i+1} ---')
        print(norm[:1200])
