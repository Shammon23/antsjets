#!/usr/bin/env python3
"""Idempotent static WhatsApp links. No JS needed; existing delegated analytics handles clicks."""
import html,json,re
from pathlib import Path
from urllib.parse import urlencode
ROOT=Path(__file__).resolve().parent.parent
GENERAL="Hi Ant, I've come through your website. Can you come out and quote?"
SERVICES={'patio-repointing':'patio repointing','paving-repointing':'paving repointing','patio-repair':'patio repair','pressure-washing':'pressure washing','driveway-cleaning':'driveway cleaning','patio-cleaning':'patio cleaning','path-cleaning':'path cleaning','decking-cleaning':'decking cleaning','roof-cleaning':'roof cleaning','guttering-cleaning':'gutter cleaning','roof-gutter-cleaning':'roof and gutter cleaning','high-pressure-jet-washing':'high-pressure jet washing','jet-washing':'jet washing','commercial-pressure-washing':'commercial pressure washing','natural-stone-patio-repointing':'natural stone and Indian sandstone patio repointing','porcelain-patio-grouting':'porcelain patio grouting','block-paving-re-sanding':'block paving re-sanding','patio-cleaning-and-repointing':'patio cleaning and repointing'}
GENERAL_PAGES={'index','contact','privacy-policy','services','service-areas','gallery','blog','ad-creative-gallery','404'}

def message_for(stem):
    if stem in GENERAL_PAGES:return GENERAL
    # Longest prefix wins, so combined/material services are not mislabelled as towns.
    for slug,service in sorted(SERVICES.items(),key=lambda x:-len(x[0])):
        if stem==slug:return f"Hi Ant, I've come through your website about {service}. Can you come out and quote?"
        if stem.startswith(slug+'-'):
            town=stem[len(slug)+1:].replace('-',' ').title()
            return f"Hi Ant, I've come through your website about {service} in {town}. Can you come out and quote?"
    if stem.startswith('blog-'):
        for slug,service in sorted(SERVICES.items(),key=lambda x:-len(x[0])):
            if slug in stem:return f"Hi Ant, I've come through your website about {service}. Can you come out and quote?"
    return GENERAL

def install():
    records=[]
    for file in sorted(ROOT.glob('*.html')):
        s=file.read_text();message=message_for(file.stem)
        href='https://wa.me/447920401090?'+urlencode({'text':message})
        safe=html.escape(href,quote=True)
        def link(classes=''):
            return '<a'+(' class="'+classes+'"' if classes else '')+' href="'+safe+'" target="_blank" rel="noopener noreferrer" data-contact="whatsapp">WhatsApp Ant</a>'
        # Replace only our own previous output, allowing copy updates without duplicates.
        s=re.sub(r'<a\b[^>]*data-contact="whatsapp"[^>]*>.*?</a>','',s,flags=re.S)
        def panel(m):
            block=m.group(0)
            return re.sub(r'(<a\b[^>]*href="sms:[^"]*"[^>]*>.*?</a>)',lambda a:a.group(0)+link(),block,count=1,flags=re.S)
        s=re.sub(r'<details\b[^>]*class="direct-contact-widget"[^>]*>.*?</details>',panel,s,flags=re.S)
        def hero(m):
            block=m.group(0)
            return block[:-6]+link('btn btn-whatsapp')+'</div>'
        s=re.sub(r'<div\b[^>]*class="hero-actions"[^>]*>.*?</div>',hero,s,flags=re.S)
        def sticky(m):
            block=m.group(0)
            if not 'href="sms:' in block:
                block=re.sub(r'(<a\b[^>]*href="tel:[^"]*"[^>]*>.*?</a>)',lambda a:a.group(0)+'<a class="btn btn-ghost" href="sms:07920401090">Text Ant</a>',block,count=1,flags=re.S)
            # Place beside the phone/text options, before the existing quote button.
            return re.sub(r'(<a\b[^>]*href="sms:[^"]*"[^>]*>.*?</a>)',lambda a:a.group(0)+link('btn btn-whatsapp'),block,count=1,flags=re.S)
        s=re.sub(r'<div\b[^>]*class="sticky-mobile-cta"[^>]*>.*?</div>',sticky,s,flags=re.S)
        # Pages without main contact actions still need an accessible in-content row.
        if 'class="direct-contact-widget"' in s and not re.search(r'<div class="hero-actions"[^>]*>[^<]*.*?data-contact="whatsapp".*?</div>',s,re.S):
            row='<div class="hero-actions"><a class="btn btn-ghost-dark" href="tel:07920401090">Call 07920 401090</a><a class="btn btn-ghost-dark" href="sms:07920401090">Text Ant</a>'+link('btn btn-whatsapp')+'</div>'
            s=re.sub(r'(<section class="page-hero">.*?)(</div></section>)',lambda m:m.group(1)+row+m.group(2),s,count=1,flags=re.S)
        if s!=file.read_text():file.write_text(s)
        records.append({'file':file.name,'message':message,'href':href,'buttons':s.count('data-contact="whatsapp"')})
    return records

if __name__=='__main__':
    rows=install();print(json.dumps({'pages':len(rows),'pages_with_whatsapp':sum(r['buttons']>0 for r in rows),'contexts':rows},indent=2))
