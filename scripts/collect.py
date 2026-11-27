"""抓取源行情并保存公开的价格快照；源地址仅从环境变量读取。"""
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

def number(value):
    import math
    if value is None or str(value).strip().lower() in ('', 'null'):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None

def normalize(payload):
    if not isinstance(payload, dict):
        raise ValueError('行情格式无效')
    quotes = []
    for code, item in payload.items():
        if not re.fullmatch(r'XDL_[A-Za-z0-9_]{1,40}', code) or not isinstance(item, dict) or not item.get('name'):
            continue
        quotes.append(dict(code=code, name=str(item['name']), time=str(item.get('time') or ''),
            bid=number(item.get('bidPrice')), ask=number(item.get('askPrice')),
            high=number(item.get('high')), low=number(item.get('low')),
            order=number(item.get('index')) if number(item.get('index')) is not None else 999,
            category='forex' if code == 'XDL_USDCNH' else 'global' if re.search(r'COMEX|CFD|HK_|XPTUSD|LBMA', code) else 'domestic'))
    if not quotes or not any(q['ask'] is not None or q['bid'] is not None for q in quotes):
        raise ValueError('暂无有效报价')
    return sorted(quotes, key=lambda q:q['order'])

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n', encoding='utf-8')
    temp.replace(path)

def collect():
    source = os.environ.get('SOURCE_URL')
    if not source:
        raise ValueError('未配置 SOURCE_URL Secret')
    with urlopen(Request(source, headers={'User-Agent':'Jinxu-Market-Collector/1.0','Accept':'application/json'}), timeout=30) as response:
        payload = json.loads(response.read(1024*1024).decode('utf-8-sig'))
    quotes = normalize(payload)
    now = datetime.now(timezone.utc)
    point = {'t':int(now.timestamp()*1000), 'values':{q['code']:[q['bid'],q['ask'],q['time']] for q in quotes}}
    archive = ROOT/'data/archive'
    archive.mkdir(parents=True, exist_ok=True)
    with (archive/(now.strftime('%Y-%m-%d')+'.jsonl')).open('a',encoding='utf-8') as f:
        f.write(json.dumps(point,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
    write_json(ROOT/'data/latest.json', {'quotes':quotes,'fetchedAt':now.isoformat(),'stale':False,'collectionIntervalSeconds':300})
    # 工作树保留90天归档；已提交的早期记录仍可能存在于Git历史中。
    cutoff=(now-timedelta(days=90)).strftime('%Y-%m-%d')
    for file in archive.glob('*.jsonl'):
        if file.stem < cutoff:
            file.unlink()
    print(f'已保存 {len(quotes)} 个品种，采集时间 {now.isoformat()}')

if __name__ == '__main__':
    try:
        collect()
    except Exception as error:
        # 不输出可能带源URL的HTTP异常内容。
        print('行情采集失败：'+type(error).__name__+'；保留原有数据。',file=sys.stderr)
        sys.exit(1)
