"""构建纯静态Pages站点，历史JSON仅包含真实样本。"""
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from collect import ROOT, write_json

def build():
    latest=json.loads((ROOT/'data/latest.json').read_text(encoding='utf-8'))
    if not latest.get('quotes'):
        raise ValueError('缺少有效行情，请先执行采集')
    site=ROOT/'_site'
    if site.exists():
        shutil.rmtree(site)
    shutil.copytree(ROOT/'public',site)
    (site/'.nojekyll').touch()
    write_json(site/'data/latest.json',latest)
    now=int(datetime.now(timezone.utc).timestamp()*1000)
    points=[]
    started=None
    for path in sorted((ROOT/'data/archive').glob('*.jsonl')):
        for line in path.read_text(encoding='utf-8').splitlines():
            try:
                p=json.loads(line)
                if not isinstance(p.get('t'),(int,float)) or not isinstance(p.get('values'),dict):
                    continue
                started=min(started or p['t'],p['t'])
                if p['t']>=now-7*86400000:
                    points.append(p)
            except (ValueError,TypeError):
                continue
    points=sorted({p['t']:p for p in points}.values(),key=lambda p:p['t'])
    for q in latest['quotes']:
        code=q['code']
        for name,duration in [('1h',3600000),('1d',86400000),('7d',7*86400000)]:
            rows=[dict(t=p['t'],bid=p['values'][code][0],ask=p['values'][code][1],sourceTime=p['values'][code][2]) for p in points if p['t']>=now-duration and code in p['values']]
            # 按真实数据索引抽样，不插值、不补造过去行情。
            import math
            stride=max(1,math.ceil(len(rows)/800))
            sampled=[p for i,p in enumerate(rows) if i%stride==0 or i==len(rows)-1]
            write_json(site/f'data/history/{code}/{name}.json',dict(code=code,range=name,points=sampled,total=len(rows),startedAt=started,intervalSeconds=300))
    print(f'静态站点已生成：{len(latest["quotes"])}个品种，{len(points)}个历史快照')

if __name__=='__main__':
    build()
