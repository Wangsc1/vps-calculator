const $ = (id) => document.getElementById(id);
const els = Object.fromEntries([
  'serverName','price','currency','currencySymbol','priceCny','tradeDate','dueDate','rate','rateCurrency','rateStatus','refreshRate',
  'remainingCny','remainingOriginal','progressPercent','progressBar','daysRemaining','dueCaption','renewalCny','dailyCost','monthlyCost',
  'usedValue','cycleCaption','premium','salePrice','dealBadge','statusChip','resultTitle','toast','themeButton','resetButton','copyAmount',
  'copyDetails','exportImage','imageDialog','imageStage','generatedImage','downloadImage','nativeShare','closeDialog','githubLink'
].map(id => [id, $(id)]));

const symbols = {USD:'$',EUR:'€',GBP:'£',JPY:'¥',HKD:'HK$',TWD:'NT$',SGD:'S$',AUD:'A$',CAD:'C$',CNY:'¥'};
const cycleNames = {30:'月付',90:'季付',180:'半年付',365:'年付',730:'两年付',1095:'三年付'};
const STORAGE_KEY = 'vps-value-state-v1';
const RATE_CACHE = 'vps-value-rates-v1';
const MS_DAY = 86400000;
let cycleDays = 365;
let remainingCny = 0;
let remainingOriginal = 0;
let lastDealEdit = 'premium';
let generatedBlob = null;

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(y,m-1,d);
  return Number.isNaN(date.getTime()) ? null : date;
}
function fmt(value, digits=2) {
  return Number.isFinite(value) ? value.toLocaleString('zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '0.00';
}
function toNumber(input, fallback=0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}
function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>els.toast.classList.remove('show'),1800);
}
async function copyText(text, message='已复制') {
  try { await navigator.clipboard.writeText(text); }
  catch (_) {
    const area = document.createElement('textarea'); area.value=text; area.style.position='fixed'; area.style.opacity='0';
    document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
  }
  showToast(message);
}
function saveState() {
  const state = {
    serverName:els.serverName.value,price:els.price.value,currency:els.currency.value,cycleDays,
    tradeDate:els.tradeDate.value,dueDate:els.dueDate.value,rate:els.rate.value,
    premium:els.premium.value,salePrice:els.salePrice.value,lastDealEdit
  };
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}
function loadState() {
  let state={};
  try { state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); } catch (_) {}
  const params=new URLSearchParams(location.search);
  for (const key of ['serverName','price','currency','tradeDate','dueDate','rate','premium','salePrice']) {
    if (params.has(key)) state[key]=params.get(key);
  }
  if (params.has('cycle')) state.cycleDays=Number(params.get('cycle'));
  if (state.serverName!=null) els.serverName.value=state.serverName;
  if (state.price!=null) els.price.value=state.price;
  if (state.currency && symbols[state.currency]) els.currency.value=state.currency;
  if (state.tradeDate) els.tradeDate.value=state.tradeDate;
  if (state.dueDate) els.dueDate.value=state.dueDate;
  if (state.rate) els.rate.value=state.rate;
  if (state.premium!=null) els.premium.value=state.premium;
  if (state.salePrice!=null) els.salePrice.value=state.salePrice;
  cycleDays=cycleNames[state.cycleDays] ? Number(state.cycleDays) : 365;
  lastDealEdit=state.lastDealEdit==='sale'?'sale':'premium';
  document.querySelectorAll('#cycleOptions button').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===cycleDays));
}
function setDefaults() {
  if (!els.tradeDate.value) els.tradeDate.value=localDateString();
  if (!els.dueDate.value) {
    const due=new Date(); due.setFullYear(due.getFullYear()+1); els.dueDate.value=localDateString(due);
  }
}
function updateCurrencyUi() {
  const code=els.currency.value;
  els.currencySymbol.textContent=symbols[code]||code;
  els.rateCurrency.textContent=code;
  els.rate.disabled=code==='CNY';
  els.refreshRate.disabled=code==='CNY';
}
function calculate({syncDeal=true}={}) {
  const price=Math.max(0,toNumber(els.price));
  const rate=els.currency.value==='CNY'?1:Math.max(0,toNumber(els.rate));
  const renewal=price*rate;
  const trade=parseLocalDate(els.tradeDate.value);
  const due=parseLocalDate(els.dueDate.value);
  let days=0;
  if (trade&&due) days=Math.max(0,Math.ceil((due-trade)/MS_DAY));
  const dailyOriginal=cycleDays?price/cycleDays:0;
  const dailyCny=dailyOriginal*rate;
  remainingOriginal=dailyOriginal*days;
  remainingCny=remainingOriginal*rate;
  const periodLeft=Math.min(days,cycleDays);
  const usedDays=Math.max(0,cycleDays-periodLeft);
  const progressRaw=cycleDays?days/cycleDays*100:0;
  const progressBar=Math.max(0,Math.min(100,progressRaw));
  const used=dailyCny*usedDays;

  els.priceCny.textContent=`≈ ¥${fmt(renewal)}`;
  els.remainingCny.textContent=fmt(remainingCny);
  els.remainingOriginal.textContent=`≈ ${fmt(remainingOriginal)} ${els.currency.value}`;
  els.daysRemaining.textContent=String(days);
  els.progressPercent.textContent=`${Math.round(progressRaw)}%`;
  els.progressBar.style.width=`${progressBar}%`;
  els.renewalCny.textContent=`¥${fmt(renewal)}`;
  els.dailyCost.textContent=`¥${fmt(dailyCny)}`;
  els.monthlyCost.textContent=`¥${fmt(dailyCny*30)}`;
  els.usedValue.textContent=`¥${fmt(used)}`;
  els.cycleCaption.textContent=cycleNames[cycleDays]||`${cycleDays} 天`;
  els.dueCaption.textContent=due?`${els.dueDate.value} 到期`:'未选择到期日';
  els.statusChip.textContent=!trade||!due?'日期不完整':days===0?'已到期':'有效期内';
  els.statusChip.style.color=days===0?'var(--red)':'var(--accent)';
  els.resultTitle.textContent=els.serverName.value.trim()||'当前剩余价值';
  if(syncDeal) syncDealFields();
  saveState();
}
function syncDealFields() {
  if(lastDealEdit==='sale') {
    const sale=Number.parseFloat(els.salePrice.value);
    els.premium.value=Number.isFinite(sale)?(sale-remainingCny).toFixed(2):'';
  } else {
    const premium=Number.parseFloat(els.premium.value);
    const value=Number.isFinite(premium)?premium:0;
    els.salePrice.value=(remainingCny+value).toFixed(2);
  }
  const premium=Number.parseFloat(els.premium.value)||0;
  els.dealBadge.textContent=premium>0?'溢价转让':premium<0?'折价转让':'原价转让';
  els.dealBadge.style.color=premium<0?'var(--red)':premium>0?'var(--green)':'var(--muted)';
}
function cachedRate(code) {
  try {
    const cache=JSON.parse(localStorage.getItem(RATE_CACHE)||'{}');
    const item=cache[code];
    return item && Date.now()-item.time<12*3600e3 ? item.value : null;
  } catch (_) { return null; }
}
function storeRate(code,value) {
  let cache={}; try{cache=JSON.parse(localStorage.getItem(RATE_CACHE)||'{}')}catch(_){}
  cache[code]={value,time:Date.now()}; localStorage.setItem(RATE_CACHE,JSON.stringify(cache));
}
async function fetchRate(force=false) {
  const code=els.currency.value;
  updateCurrencyUi();
  if(code==='CNY') { els.rate.value='1.0000'; els.rateStatus.textContent='人民币无需换算'; calculate(); return; }
  const cached=!force&&cachedRate(code);
  if(cached) { els.rate.value=cached.toFixed(4); els.rateStatus.textContent='本地缓存 · 12 小时有效'; calculate(); return; }
  els.refreshRate.classList.add('loading'); els.rateStatus.textContent='正在获取实时汇率…';
  try {
    const res=await fetch(`https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(code)}&to=CNY`,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json(); const value=Number(data.rates?.CNY);
    if(!Number.isFinite(value)||value<=0) throw new Error('汇率无效');
    els.rate.value=value.toFixed(4); storeRate(code,value);
    els.rateStatus.textContent=`更新于 ${data.date||'今天'}`; calculate();
    if(force) showToast('汇率已更新');
  } catch (err) {
    els.rateStatus.textContent='自动汇率失败，可手动填写'; showToast('汇率获取失败，请手动填写');
  } finally { els.refreshRate.classList.remove('loading'); }
}
function resultText() {
  const premium=Number.parseFloat(els.premium.value)||0;
  const sale=Number.parseFloat(els.salePrice.value)||remainingCny;
  return `## VPS 剩余价值${els.serverName.value.trim()?` · ${els.serverName.value.trim()}`:''}\n`+
    `- 续费：${els.price.value||0} ${els.currency.value} / ${cycleNames[cycleDays]}（约 ¥${fmt(toNumber(els.price)*toNumber(els.rate))}）\n`+
    `- 交易日期：${els.tradeDate.value||'-'}\n- 到期日期：${els.dueDate.value||'-'}\n`+
    `- 剩余：${els.daysRemaining.textContent} 天，价值 ¥${fmt(remainingCny)}（约 ${fmt(remainingOriginal)} ${els.currency.value}）\n`+
    `- 溢价 / 折价：${premium>=0?'+':''}¥${fmt(premium)}\n- 售出价格：¥${fmt(sale)}\n`+
    `- 汇率：1 ${els.currency.value} ≈ ${els.rate.value} CNY`;
}
function shareUrl() {
  const p=new URLSearchParams();
  const values={serverName:els.serverName.value,price:els.price.value,currency:els.currency.value,cycle:cycleDays,tradeDate:els.tradeDate.value,dueDate:els.dueDate.value,rate:els.rate.value,premium:els.premium.value};
  Object.entries(values).forEach(([k,v])=>{if(v!==''&&v!=null)p.set(k,v)});
  return `${location.origin}${location.pathname}?${p.toString()}`;
}
function shareMarkdown() {
  const name=els.serverName.value.trim();
  const label=(name?`VPS 剩余价值 · ${name}`:'VPS 剩余价值').replace(/[\\`*_[\]<>]/g,'\\$&');
  const url=shareUrl().replace(/\(/g,'%28').replace(/\)/g,'%29');
  return `[${label}](${url})`;
}
function applyTheme(mode) {
  const dark=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]').content=dark?'#08111f':'#f4f7fb';
}
function toggleTheme() {
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  localStorage.setItem('vps-value-theme',next); applyTheme(next);
}
async function generateImage() {
  if(!window.htmlToImage) { showToast('图片模块加载失败，请稍后重试'); return; }
  els.imageDialog.showModal(); els.generatedImage.style.display='none';
  els.imageStage.querySelector('.spinner').style.display='block';
  document.body.classList.add('capture-mode');
  try {
    await document.fonts.ready;
    const width=Math.min(1120,Math.max(760,$('calculator').scrollWidth));
    const dataUrl=await htmlToImage.toPng($('calculator'),{pixelRatio:2,cacheBust:true,backgroundColor:getComputedStyle(document.body).backgroundColor,width});
    const blob=await (await fetch(dataUrl)).blob(); generatedBlob=blob;
    const url=URL.createObjectURL(blob);
    if(els.generatedImage.src.startsWith('blob:')) URL.revokeObjectURL(els.generatedImage.src);
    els.generatedImage.src=url; els.downloadImage.href=url;
    els.downloadImage.download=`vps-value-${localDateString()}.png`;
    els.generatedImage.style.display='block';
  } catch(err) { console.error(err); els.imageDialog.close(); showToast('图片生成失败'); }
  finally { document.body.classList.remove('capture-mode'); els.imageStage.querySelector('.spinner').style.display='none'; }
}
function resetAll() {
  if(!confirm('确定清空当前数据并恢复默认值吗？')) return;
  localStorage.removeItem(STORAGE_KEY); history.replaceState(null,'',location.pathname);
  els.serverName.value=''; els.price.value=''; els.currency.value='USD'; els.premium.value=''; els.salePrice.value='';
  cycleDays=365; els.tradeDate.value=localDateString(); const due=new Date(); due.setFullYear(due.getFullYear()+1); els.dueDate.value=localDateString(due);
  document.querySelectorAll('#cycleOptions button').forEach(b=>b.classList.toggle('active',Number(b.dataset.days)===365));
  fetchRate(true); showToast('已重置');
}
function bindEvents() {
  ['serverName','price','tradeDate','dueDate','rate'].forEach(id=>els[id].addEventListener('input',()=>calculate()));
  els.currency.addEventListener('change',()=>fetchRate(false));
  document.querySelectorAll('#cycleOptions button').forEach(btn=>btn.addEventListener('click',()=>{
    cycleDays=Number(btn.dataset.days); document.querySelectorAll('#cycleOptions button').forEach(b=>b.classList.toggle('active',b===btn)); calculate();
  }));
  els.premium.addEventListener('input',()=>{lastDealEdit='premium';syncDealFields();saveState()});
  els.salePrice.addEventListener('input',()=>{lastDealEdit='sale';syncDealFields();saveState()});
  els.refreshRate.addEventListener('click',()=>fetchRate(true)); els.themeButton.addEventListener('click',toggleTheme); els.resetButton.addEventListener('click',resetAll);
  els.copyAmount.addEventListener('click',()=>copyText(fmt(remainingCny),'金额已复制'));
  els.copyDetails.addEventListener('click',()=>copyText(resultText(),'计算结果已复制'));
  els.exportImage.addEventListener('click',()=>{copyText(shareMarkdown(),'Markdown 链接已复制');generateImage();}); els.closeDialog.addEventListener('click',()=>els.imageDialog.close());
  els.imageDialog.addEventListener('click',e=>{if(e.target===els.imageDialog)els.imageDialog.close()});
  els.nativeShare.addEventListener('click',async()=>{
    if(!generatedBlob)return; const file=new File([generatedBlob],'vps-value.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'VPS 剩余价值'});return}catch(_){}}
    showToast('当前浏览器不支持图片分享，请下载保存');
  });
}
function init() {
  loadState(); setDefaults(); updateCurrencyUi(); bindEvents(); calculate();
  const savedRate=cachedRate(els.currency.value);
  if(new URLSearchParams(location.search).has('rate')) calculate();
  else if(savedRate){els.rate.value=savedRate.toFixed(4);els.rateStatus.textContent='本地缓存 · 12 小时有效';calculate()}
  else fetchRate(false);
  const repo=document.documentElement.dataset.repo; if(repo)els.githubLink.href=repo;
}
init();
