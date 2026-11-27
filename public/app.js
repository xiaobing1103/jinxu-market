const $ = s => document.querySelector(s);
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => n == null ? '—' : Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const time = (n, date = false) => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...(date?{month:'2-digit',day:'2-digit'}:{}),hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(n));
const symbol = code => code === 'XDL_USDCNH' ? 'FX' : /Au|XAU/.test(code) ? 'Au' : /Ag|XAG/.test(code) ? 'Ag' : /Pt|XPT/.test(code) ? 'Pt' : /Pd/.test(code) ? 'Pd' : 'Rh';
const english = {XDL_Au:'GOLD',XDL_Ag:'SILVER',XDL_Pt:'PLATINUM',XDL_Pd:'PALLADIUM'};
let quotes=[], code='XDL_Au', side='ask', range='1d', category='all', history={points:[]}, busy=false, auto=true, countdown=60, requestId=0, chartGeometry=null, hoverIndex=0;
let favorites;
try { const saved=JSON.parse(localStorage.getItem('jinxu-favorites')||'[]');favorites=new Set(Array.isArray(saved)?saved.filter(x=>typeof x==='string'):[]); } catch {favorites=new Set();}

function renderPrice() {
  const q=quotes.find(q=>q.code===code);
  if(!q)return;
  $('#instrument-name').textContent=q.code==='XDL_Au'?'水贝黄金':q.name;
  $('#instrument-subtitle').textContent=`${q.category==='global'?'GLOBAL':q.category==='forex'?'CURRENCY':'SHUIBEI'} / ${english[code]||symbol(code).toUpperCase()}`;
  $('#hero-price').innerHTML=`${fmt(q[side])}<small>${side==='ask'?'卖出':'买入'}报价</small>`;
  for(const key of ['bid','ask','high','low']) $(`#${key}-price`).textContent=fmt(q[key]);
  $('#source-time').textContent=q.time||'来源未提供';
  document.querySelectorAll('[data-code]').forEach(b=>{b.classList.toggle('active',b.dataset.code===code);b.setAttribute('aria-pressed',String(b.dataset.code===code));});
}
function renderStrip() {
  $('#market-strip').innerHTML=['XDL_Au9999','XDL_Ag','XDL_Pt','XDL_CFDXAU'].map(c=>{
    const q=quotes.find(q=>q.code===c);if(!q)return '';
    return `<button class="strip-item" data-select="${escapeHTML(c)}" aria-label="查看${escapeHTML(q.name)}走势"><span class="strip-name">${escapeHTML(q.name)}<small>${c==='XDL_CFDXAU'?'LONDON / GOLD':symbol(c).toUpperCase()+' / MARKET'}</small></span><span class="strip-price">${fmt(q.ask)}<small>卖出报价 ↗</small></span></button>`;
  }).join('');
}
function renderTable() {
  const query=$('#search').value.trim().toLowerCase();
  const rows=quotes.filter(q=>(category==='all'||(category==='favorites'?favorites.has(q.code):q.category===category))&&`${q.name} ${q.code}`.toLowerCase().includes(query));
  $('#total-count').textContent=quotes.length;$('#favorite-count').textContent=favorites.size;
  $('#result-count').textContent=`${rows.length} 个品种 · 报价沿用来源数值`;
  $('#quotes-body').innerHTML=rows.length?rows.map(q=>`<tr class="${q.code===code?'selected':''}"><td class="star-col"><button class="star-button ${favorites.has(q.code)?'chosen':''}" data-favorite="${escapeHTML(q.code)}" aria-label="${favorites.has(q.code)?'取消自选':'加入自选'}：${escapeHTML(q.name)}" aria-pressed="${favorites.has(q.code)}">${favorites.has(q.code)?'★':'☆'}</button></td><td><button class="instrument-link" data-select="${escapeHTML(q.code)}"><span class="element ${symbol(q.code)==='Au'?'gold':''}">${symbol(q.code)}</span><span><strong>${escapeHTML(q.name)}</strong><small>${escapeHTML(q.code)}</small></span></button></td><td class="num bid">${fmt(q.bid)}</td><td class="num ask">${fmt(q.ask)}</td><td class="num minor">${fmt(q.high)}</td><td class="num minor">${fmt(q.low)}</td><td>${escapeHTML(q.time||'—')}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">${category==='favorites'&&!favorites.size?'点击品种左侧的 ☆，留住你关心的价格。':'没有找到匹配品种，请调整分类或搜索内容。'}</td></tr>`;
}

function drawChart() {
  const svg=$('#chart'), box=$('#chart-container');
  const width=Math.max(200,box.clientWidth),height=box.clientHeight;
  const points=history.points||[];
  const valid=points.filter(p=>Number.isFinite(p[side]));
  const pad={left:12,right:60,top:24,bottom:30};
  const pw=width-pad.left-pad.right,ph=height-pad.top-pad.bottom;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('aria-label',`${$('#instrument-name').textContent}${side==='ask'?'卖出':'买入'}价格走势，${valid.length}个实采样本`);
  const message=$('#chart-message');
  $('#chart-tooltip').hidden=true;
  chartGeometry=null;
  let min=valid.length?Math.min(...valid.map(p=>p[side])):0,max=valid.length?Math.max(...valid.map(p=>p[side])):1;
  const spread=max-min;
  const margin=spread?spread*.22:Math.max(Math.abs(max)*.003,.02);
  min-=margin;max+=margin;
  const now=Date.now(),duration={'1h':3600000,'1d':86400000,'7d':604800000}[range];
  let start=points[0]?.t??now-duration,end=points.at(-1)?.t??now;
  if(end-start<300000){const center=start;start=center-300000;end=center+300000;}
  const x=t=>pad.left+(t-start)/(end-start)*pw,y=v=>pad.top+(max-v)/(max-min)*ph;
  let grid='';
  for(let i=0;i<5;i++){
    const gy=pad.top+i*ph/4,value=max-i*(max-min)/4;
    grid+=`<line class="grid" x1="${pad.left}" x2="${width-pad.right}" y1="${gy}" y2="${gy}"/>${valid.length?`<text x="${width-pad.right+12}" y="${gy+3}">${fmt(value)}</text>`:''}`;
  }
  if(valid.length){
    for(let i=0;i<4;i++)grid+=`<text x="${pad.left+i*pw/3}" y="${height-5}" text-anchor="${i===0?'start':i===3?'end':'middle'}">${time(start+i*(end-start)/3,range==='7d')}</text>`;
  }
  let path='',segment=false;
  points.forEach((p,i)=>{
    if(!Number.isFinite(p[side])){segment=false;return;}
    // 采集中断超过三分钟时断开线段，避免把空白时段伪装成连续走势。
    const gap=i>0&&p.t-points[i-1].t>Math.max(900000,(history.total||points.length)/Math.max(points.length,1)*120000);
    path+=`${segment&&!gap?'L':'M'}${x(p.t).toFixed(2)},${y(p[side]).toFixed(2)} `;segment=true;
  });
  let area='';
  if(valid.length>1&&points.every(p=>Number.isFinite(p[side]))&&points.every((p,i)=>!i||p.t-points[i-1].t<900000))area=`<path d="${path} L${x(valid.at(-1).t)},${pad.top+ph} L${x(valid[0].t)},${pad.top+ph} Z" fill="url(#wash)"/>`;
  const last=valid.at(-1);
  svg.innerHTML=`<defs><linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b79a5f" stop-opacity=".17"/><stop offset="1" stop-color="#b79a5f" stop-opacity="0"/></linearGradient></defs>${grid}${area}<path class="price-line" d="${path}"/>${last?`<circle cx="${x(last.t)}" cy="${y(last[side])}" r="7" fill="#9b783f18"/><circle cx="${x(last.t)}" cy="${y(last[side])}" r="3" fill="#9b783f"/>`:''}<g id="chart-hover" visibility="hidden"><line id="hover-line" class="crosshair"/><circle id="hover-dot" r="4" fill="#9b783f" stroke="#f7f5ef" stroke-width="2"/></g>`;
  if(!valid.length){message.hidden=false;message.textContent=points.length?'此方向暂无有效报价，请切换买入或卖出。':'此时间范围暂无记录。采集开始后，真实走势将在这里逐步展开。';}
  else if(valid.length===1){message.hidden=false;message.style.alignItems='flex-end';message.style.paddingBottom='64px';message.textContent='已记录首个报价，等待后续采集样本。';}
  else{message.hidden=true;message.style.alignItems='center';}
  if(valid.length)chartGeometry={valid,x,y,pad,width,height};
  $('#history-summary').textContent=`${history.total||0} 个实采样本 · 定时实采`;
  $('#history-date').textContent=last?`${time(valid[0].t,true)} — ${time(last.t,true)}`:'北京时间 UTC+8';
  $('#chart-insight').textContent=history.startedAt?`本站自 ${time(history.startedAt,true)} 开始记录。图表展示实际采集区间，未覆盖所选区间的部分不补造。`:'正在建立本站的第一份市场记录。';
  const change=$('#sample-change');change.classList.remove('negative');
  if(valid.length>1){const first=valid[0][side],diff=last[side]-first;change.textContent=`${diff>0?'↗':diff<0?'↘':'→'} ${diff>0?'+':''}${fmt(diff)}${first?` / ${diff>0?'+':''}${(diff/first*100).toFixed(2)}%`:''} · 较区间首个实采价`;change.classList.toggle('negative',diff<0);}
  else change.textContent=valid.length?'首个样本已存档 · 走势积累中':'真实记录，持续积累中';
}
function showPoint(index){
  if(!chartGeometry)return;
  const {valid,x,y,pad,width,height}=chartGeometry;
  hoverIndex=Math.max(0,Math.min(valid.length-1,index));const p=valid[hoverIndex],px=x(p.t),py=y(p[side]);
  $('#chart-hover').setAttribute('visibility','visible');
  const line=$('#hover-line');for(const [k,v] of Object.entries({x1:px,x2:px,y1:pad.top,y2:height-pad.bottom}))line.setAttribute(k,v);
  $('#hover-dot').setAttribute('cx',px);$('#hover-dot').setAttribute('cy',py);
  const tip=$('#chart-tooltip');tip.hidden=false;tip.style.left=`${Math.max(0,Math.min(px+12,width-170))}px`;tip.style.top=`${Math.max(0,Math.min(py-80,height-100))}px`;
  tip.innerHTML=`${side==='ask'?'卖出':'买入'}报价<strong>${fmt(p[side])}</strong><small>采集 ${time(p.t,true)}</small><small>源时间 ${escapeHTML(p.sourceTime||'未提供')}</small>`;
}
$('#chart-container').addEventListener('pointermove',e=>{if(!chartGeometry)return;const px=e.clientX-$('#chart-container').getBoundingClientRect().left;const {valid,x}=chartGeometry;let nearest=0;for(let i=1;i<valid.length;i++)if(Math.abs(x(valid[i].t)-px)<Math.abs(x(valid[nearest].t)-px))nearest=i;showPoint(nearest);});
$('#chart-container').addEventListener('pointerleave',()=>{$('#chart-tooltip').hidden=true;$('#chart-hover')?.setAttribute('visibility','hidden');});
$('#chart-container').tabIndex=0;$('#chart-container').setAttribute('aria-label','走势图，使用左右方向键浏览样本');
$('#chart-container').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();showPoint(hoverIndex+(e.key==='ArrowRight'?1:-1));}if(e.key==='Escape'){$('#chart-tooltip').hidden=true;$('#chart-hover')?.setAttribute('visibility','hidden');}});
new ResizeObserver(()=>drawChart()).observe($('#chart-container'));

async function apiFetch(path,timeout=12000) {
  const url=new URL(path,location.href);
  const file=url.pathname.endsWith('/api/quotes')?'./data/latest.json':`./data/history/${encodeURIComponent(url.searchParams.get('code'))}/${url.searchParams.get('range')}.json`;
  return fetch(file,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
}
async function loadHistory(){
  const id=++requestId,requestedCode=code;
  try{const r=await apiFetch(`./api/history?code=${encodeURIComponent(code)}&range=${range}`);if(!r.ok)throw Error();const data=await r.json();if(id!==requestId)return;history=data;drawChart();}
  catch{if(id!==requestId)return;if(requestedCode!==history.code)history={points:[]};drawChart();$('#chart-message').hidden=false;$('#chart-message').textContent='历史记录暂时无法读取，请稍后刷新重试。';}
}
async function load(){
  if(busy)return;busy=true;$('#refresh').disabled=true;
  try{
    const r=await apiFetch('./api/quotes',18000);if(!r.ok)throw Error();const data=await r.json();if(!data.quotes?.length)throw Error();quotes=data.quotes;
    renderPrice();renderStrip();renderTable();
    $('#sync-status').textContent=`${data.stale?'缓存报价':'已同步'} ${time(data.fetchedAt)}`;$('#sync-dot').style.background=data.stale?'#9b783f':'';
    const latest=quotes.map(q=>q.time).filter(Boolean).sort().at(-1);const parsed=latest?Date.parse(latest.replace(' ','T')+'+08:00'):NaN;
    const delayed=Number.isFinite(parsed)&&Date.now()-parsed>900000;
    $('#notice').hidden=!data.stale&&!delayed;$('#notice').textContent=data.stale?'行情源暂时无法连接，当前保留上次成功获取的报价。':delayed?'源报价距当前已超过15分钟，当前展示最新可用数据，请留意报价时间。':'';
    await loadHistory();
  }catch{$('#sync-status').textContent='同步暂不可用';$('#sync-dot').style.background='#9b783f';$('#notice').hidden=false;$('#notice').textContent=quotes.length?'暂时无法同步，已保留上次成功报价。':'暂时无法连接行情，请点击刷新重试。';if(!quotes.length)$('#quotes-body').innerHTML='<tr><td colspan="7" class="empty">行情暂不可用，请稍后重试。</td></tr>';}
  finally{busy=false;countdown=60;$('#refresh').disabled=false;}
}
function activate(selector,button){document.querySelectorAll(selector).forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});}
function selectInstrument(next,scroll=false){code=next;history={points:[]};renderPrice();renderTable();drawChart();loadHistory();if(scroll)$('#market').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
document.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>selectInstrument(b.dataset.code)));
document.querySelectorAll('[data-side]').forEach(b=>b.addEventListener('click',()=>{side=b.dataset.side;activate('[data-side]',b);renderPrice();drawChart();}));
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range;activate('[data-range]',b);history={points:[]};drawChart();loadHistory();}));
document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;activate('[data-category]',b);renderTable();}));
document.addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){const c=favorite.dataset.favorite;favorites.has(c)?favorites.delete(c):favorites.add(c);try{localStorage.setItem('jinxu-favorites',JSON.stringify([...favorites]));}catch{}renderTable();return;}const select=e.target.closest('[data-select]');if(select)selectInstrument(select.dataset.select,true);});
$('#search').addEventListener('input',renderTable);$('#refresh').addEventListener('click',load);
$('#auto-refresh').addEventListener('click',()=>{auto=!auto;$('#auto-refresh').setAttribute('aria-pressed',String(auto));countdown=60;$('#countdown').textContent=auto?'60s':'已暂停';});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}});
$('#edition-date').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'short',day:'2-digit'}).format(new Date()).toUpperCase();$('#year').textContent=new Date().getFullYear();
setInterval(()=>{if(auto&&!busy&&!document.hidden){countdown--;$('#countdown').textContent=`${countdown}s`;if(countdown<=0)load();}},1000);
drawChart();load();
