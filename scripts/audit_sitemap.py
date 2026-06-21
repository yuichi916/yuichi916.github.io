"""Diff local HTML files vs sitemap.xml entries and live URL availability."""
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path(r'C:\Users\yuich\yuichi916.github.io')
SITE = 'https://yuichi916.github.io'

# 1) Local HTML files
html_files = sorted({
    p.relative_to(ROOT).as_posix()
    for p in ROOT.glob('**/*.html')
    if '.git' not in p.parts and 'googlea794' not in p.name
})
print(f'=== Local HTML files ({len(html_files)}) ===')
for f in html_files:
    print(f'  {f}')

# 2) sitemap.xml URLs
sm = urllib.request.urlopen(SITE + '/sitemap.xml').read()
ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}'
sitemap_urls = [u.find(ns + 'loc').text for u in ET.fromstring(sm).findall(ns + 'url')]
print(f'\n=== sitemap.xml URLs ({len(sitemap_urls)}) ===')

# 3) Diff
def url_of(local):
    if local == 'index.html':
        return SITE + '/'
    return SITE + '/' + local

local_urls = {url_of(f) for f in html_files}
sitemap_set = set(sitemap_urls)
missing = local_urls - sitemap_set
orphan = sitemap_set - local_urls

def check_live(u):
    try:
        urllib.request.urlopen(u, timeout=6)
        return 'LIVE'
    except Exception:
        return '404'

print(f'\n=== Local files MISSING from sitemap ({len(missing)}) ===')
for u in sorted(missing):
    print(f'  [{check_live(u)}] {u}')

print(f'\n=== Sitemap entries with no local file ({len(orphan)}) ===')
for u in sorted(orphan):
    print(f'  [{check_live(u)}] {u}')
