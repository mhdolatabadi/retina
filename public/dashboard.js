const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const n = value => typeof value === 'number' && Number.isFinite(value) ? nf.format(value) : '—';
const label = value => String(value == null ? 'UNKNOWN' : value);
function el(tag,className,text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent=label(text);
  return node;
}
function clear(node) {node.replaceChildren();}
function showEmpty(node,text) {node.append(el('div','empty',text));}
function bindSelect() {
  const q = new URLSearchParams();
  q.set('groupBy',$('groupBy').value);
  for(const key of ['issue','taskType']) {
    const value=$(key).value.trim();
    if(value) q.set(key,value);
  }
  if($('period').value) q.set('since',new Date(Date.now()-Number($('period').value)*3600000).toISOString());
  return q;
}
function renderTable(id,rows,columns) {
  const body=$(id);clear(body);
  if(!rows.length) {const td=el('td','empty','داده‌ای در این بازه وجود ندارد');td.colSpan=columns.length;const tr=el('tr');tr.append(td);body.append(tr);return;}
  for(const row of rows){
    const tr=el('tr');
    for(const value of columns.map(fn=>fn(row))) tr.append(el('td','',value));
    body.append(tr);
  }
}
function render(report) {
  const o=report.overview;
  $('total').textContent=n(o.tokens.total);
  $('rate').textContent=n(o.tokensPerActiveMinute);
  $('decode').textContent=n(o.generationTokensPerSecond);
  $('requests').textContent=n(o.requests);
  $('request-detail').textContent=n(o.completed)+' کامل · '+n(o.running)+' درحال اجرا · '+n(o.missingUsage)+' ناقص';
  $('ttft').textContent=n(o.ttftMeanMs);
  $('cost').textContent=o.costUSD===null ? '—' : '$'+n(o.costUSD);
  $('updated').textContent=new Date(report.updatedAt).toLocaleTimeString('fa-IR');
  $('status').textContent='داده محلی · '+n(o.requests)+' درخواست';
  const bars=$('bars');clear(bars);
  if(!report.groups.length) showEmpty(bars,'هنوز مصرفی ثبت نشده است. ابتدا OpenCode را اجرا کن.');
  const max=Math.max(1,...report.groups.map(g=>g.tokens.total||0));
  for(const group of report.groups.slice(0,9)) {
    const block=el('div');
    const title=el('div','bar-head');
    title.append(el('span','bar-label',group.name),el('span','',n(group.tokens.total)));
    const track=el('div','bar-track');
    const fill=el('div','bar-fill');
    fill.style.width=(100*(group.tokens.total||0)/max)+'%';
    track.append(fill);block.append(title,track);bars.append(block);
  }
  const timeline=$('timeline');clear(timeline);
  if(!report.trend.length) showEmpty(timeline,'داده زمانی موجود نیست');
  const peak=Math.max(1,...report.trend.map(x=>x.tokens));
  for(const tick of report.trend) {
    const div=el('div','timeline-bar');div.style.height=Math.max(2,tick.tokens/peak*100)+'%';
    div.title=tick.time+' · '+n(tick.tokens)+' tokens';timeline.append(div);
  }
  renderTable('groups',report.groups,[
    g=>g.name,g=>n(g.tokens.total),g=>n(g.requests),
    g=>n(g.tokensPerActiveMinute),g=>n(g.generationTokensPerSecond),
    g=>n(g.costUSD),g=>n(g.ttftMeanMs)
  ]);
  renderTable('sessions',report.sessions,[
    s=>s.sessionID,s=>s.issueKey,s=>s.taskType,s=>n(s.requests),
    s=>s.lastSeen ? new Date(s.lastSeen).toLocaleString('fa-IR') : '—'
  ]);
  $('message').textContent='داده هر ۳ ثانیه به‌روزرسانی می‌شود. شمارنده‌های ناموجود به‌عنوان «—» نمایش داده می‌شوند، نه صفر.';
}
let fetching=false;
async function refresh(){
  if(fetching)return;
  fetching=true;
  try{
    const response=await fetch('/api/report?'+bindSelect().toString(),{cache:'no-store'});
    if(!response.ok) throw Error('HTTP '+response.status);
    render(await response.json());
    $('message').classList.remove('error');
  }catch(error) {
    $('status').textContent='اتصال ناموفق';
    $('message').classList.add('error');
    $('message').textContent='خواندن Telemetry ناموفق بود: '+error.message;
  }finally{fetching=false;}
}
$('apply').addEventListener('click',refresh);
$('groupBy').addEventListener('change',refresh);
refresh();
setInterval(refresh,3000);
