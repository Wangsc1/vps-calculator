const $ = (id) => document.getElementById(id);
const els = Object.fromEntries([
  'price','currency','currencySymbol','priceCny','tradeDate','dueDate','currencyRate',
  'remainingCny','remainingOriginal','daysRemaining','dueCaption',
  'premium','salePrice','toast','themeButton',
  'copyDetails','exportImage','imageDialog','imageStage','generatedImage','downloadImage','nativeShare','closeDialog','githubLink','imageStatus'
].map(id => [id, $(id)]));

const symbols = {USD:'$',EUR:'€',GBP:'£',JPY:'¥',HKD:'HK$',TWD:'NT$',SGD:'S$',AUD:'A$',CAD:'C$',CNY:'¥'};
const cycleNames = {30:'月付',90:'季付',180:'半年付',365:'年付',730:'两年付',1095:'三年付'};
const MS_DAY = 86400000;
let cycleDays = 365;
let remainingCny = 0;
let remainingOriginal = 0;
let lastDealEdit = 'premium';
let generatedBlob = null;
let exchangeRate = null;
let rateRequestId = 0;

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
function loadState() {
  let state={};
  els.price.value=''; els.currency.value='USD'; els.premium.value=''; els.salePrice.value='';
  els.tradeDate.value=''; els.dueDate.value='';
  const reloading=performance.getEntriesByType('navigation')[0]?.type==='reload';
  const params=new URLSearchParams(reloading?'':location.search);
  if(reloading) history.replaceState(null,'',location.pathname);
  for (const key of ['price','currency','tradeDate','dueDate','premium','salePrice']) {
    if (params.has(key)) state[key]=params.get(key);
  }
  if (params.has('cycle')) state.cycleDays=Number(params.get('cycle'));
  if (state.price!=null) els.price.value=state.price;
  if (state.currency && symbols[state.currency]) els.currency.value=state.currency;
  if (state.tradeDate) els.tradeDate.value=state.tradeDate;
  if (state.dueDate) els.dueDate.value=state.dueDate;
  if (state.premium!=null) els.premium.value=state.premium;
  if (state.salePrice!=null) els.salePrice.value=state.salePrice;
  cycleDays=cycleNames[state.cycleDays] ? Number(state.cycleDays) : 365;
  lastDealEdit=state.salePrice!=null?'sale':'premium';
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
  const rate=code==='CNY'?1:exchangeRate;
  const value=document.createElement('span');
  value.className='exchange-rate-value';
  value.textContent=Number.isFinite(rate)?rate.toFixed(4):'…';
  const caption=document.createElement('span');
  caption.className='exchange-rate-caption';
  caption.textContent='汇率';
  els.currencyRate.replaceChildren('· ',caption,' ',value,' CNY');
}
function calculate({syncDeal=true}={}) {
  for(const id of ['tradeDate','dueDate']) {
    const input=els[id];
    let label=input.parentElement.querySelector('.date-display');
    if(!label) {
      label=document.createElement('span');
      label.className='date-display';
      label.setAttribute('aria-hidden','true');
      input.before(label);
      input.parentElement.classList.add('has-date-display');
    }
    const parts=input.value.split('-');
    label.textContent=parts.length===3?`${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`:'选择日期';
  }
  const price=Math.max(0,toNumber(els.price));
  const rate=els.currency.value==='CNY'?1:(exchangeRate??NaN);
  const renewal=price*rate;
  const trade=parseLocalDate(els.tradeDate.value);
  const due=parseLocalDate(els.dueDate.value);
  let days=0;
  if (trade&&due) days=Math.max(0,Math.ceil((due-trade)/MS_DAY));
  const dailyOriginal=cycleDays?price/cycleDays:0;
  remainingOriginal=dailyOriginal*days;
  remainingCny=remainingOriginal*rate;

  const hasRate=Number.isFinite(rate);
  els.priceCny.textContent=`≈ ¥${hasRate?fmt(renewal):'—'}`;
  els.remainingCny.textContent=hasRate?fmt(remainingCny):'—';
  for(const id of ['copyDetails','exportImage','premium','salePrice']) els[id].disabled=!hasRate;
  els.remainingOriginal.textContent=`≈ ${fmt(remainingOriginal)} ${els.currency.value}`;
  els.daysRemaining.textContent=String(days);
  els.dueCaption.textContent=due?`${els.dueDate.value} 到期`:'未选择到期日';
  if(syncDeal&&Number.isFinite(remainingCny)) syncDealFields();
}
function syncDealFields() {
  if(lastDealEdit==='sale') {
    const sale=Number.parseFloat(els.salePrice.value);
    els.premium.value=Number.isFinite(sale)?(sale-remainingCny).toFixed(2):'';
  } else {
    const premium=Number.parseFloat(els.premium.value);
    const value=Number.isFinite(premium)?premium:0;
    if(document.activeElement!==els.salePrice) {
      els.salePrice.value=(remainingCny+value).toFixed(2);
    }
  }
  updateDealBadge();
}
function updateDealBadge() {
  const premium=Number.parseFloat(els.premium.value)||0;
  const badge=$('exportDealBadge');
  badge.textContent=premium>0?'溢价转让':premium<0?'折价转让':'原价转让';
  badge.style.background=premium<0?'linear-gradient(135deg,#6bd1af,#34b584)':premium>0?'linear-gradient(135deg,#f58c8c,#e65365)':'linear-gradient(135deg,#72b1d1,#4a8fc7)';
}
async function fetchRate() {
  const code=els.currency.value;
  const requestId=++rateRequestId;
  exchangeRate=code==='CNY'?1:null;
  updateCurrencyUi();
  els.currencyRate.title=code==='CNY'?'人民币无需换算':'正在获取最新汇率';
  calculate();
  if(code==='CNY') return;
  try {
    const res=await fetch(`https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(code)}&to=CNY`,{cache:'no-store'});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data=await res.json(); const value=Number(data.rates?.CNY);
    if(!Number.isFinite(value)||value<=0) throw new Error('汇率无效');
    if(requestId!==rateRequestId) return;
    exchangeRate=Number(value.toFixed(4));
    updateCurrencyUi();
    els.currencyRate.title=`更新于 ${data.date||'今天'}`;
    calculate();
  } catch (err) {
    if(requestId!==rateRequestId) return;
    els.currencyRate.textContent='· 汇率获取失败';
    els.currencyRate.title='刷新页面或重新选择币种重试';
    showToast('汇率获取失败，请刷新页面或重新选择币种');
  }
}
function resultText() {
  const premium=Number.parseFloat(els.premium.value)||0;
  const sale=toNumber(els.salePrice,remainingCny);
  return `## VPS 剩余价值\n`+
    `- 续费价格：${els.price.value||0} ${els.currency.value} / ${cycleNames[cycleDays]}（约 ¥${fmt(toNumber(els.price)*(els.currency.value==='CNY'?1:exchangeRate))}）\n`+
    `- 交易日期：${els.tradeDate.value||'-'}\n- 到期日期：${els.dueDate.value||'-'}\n`+
    `- 剩余：${els.daysRemaining.textContent} 天，价值 ¥${fmt(remainingCny)}（约 ${fmt(remainingOriginal)} ${els.currency.value}）\n`+
    `- 溢价 / 折价：${premium>=0?'+':''}¥${fmt(premium)}\n- 售出价格：¥${fmt(sale)}\n`+
    `- 汇率：1 ${els.currency.value} ≈ ${(els.currency.value==='CNY'?1:exchangeRate).toFixed(4)} CNY`;
}
function shareUrl() {
  const p=new URLSearchParams();
  const values={price:els.price.value,currency:els.currency.value,cycle:cycleDays,tradeDate:els.tradeDate.value,dueDate:els.dueDate.value,salePrice:els.salePrice.value};
  Object.entries(values).forEach(([k,v])=>{if(v!==''&&v!=null)p.set(k,v)});
  return `${location.origin}${location.pathname}?${p.toString()}`;
}
function shareMarkdown() {
  const label='VPS 剩余价值';
  const url=shareUrl().replace(/\(/g,'%28').replace(/\)/g,'%29');
  return `[${label}](${url})`;
}
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const themeModes=['system','light','dark'];
const themeLabels={system:'跟随系统',light:'日间模式',dark:'夜间模式'};
let themeMode='system';
const sliderModes=['light','system','dark'];
let themeDragMoved=false;
function themeRange() {
  const track=els.themeButton.querySelector('.theme-track');
  const thumb=els.themeButton.querySelector('.theme-thumb');
  return Math.max(0,track.clientWidth-thumb.offsetWidth-6);
}
function themeOffset(mode) { return themeRange()*sliderModes.indexOf(mode)/2; }
function updateThemeThumb() {
  els.themeButton.querySelector('.theme-thumb').dataset.mode=themeMode;
  els.themeButton.style.setProperty('--theme-x',`${themeOffset(themeMode)}px`);
  els.themeButton.setAttribute('aria-valuenow',String(sliderModes.indexOf(themeMode)));
  els.themeButton.setAttribute('aria-valuetext',themeLabels[themeMode]);
}
function setThemeMode(mode) {
  try { localStorage.setItem('vps-value-theme',mode); } catch (_) {}
  applyTheme(mode);
}
function applyTheme(mode) {
  themeMode=themeModes.includes(mode)?mode:'system';
  const dark=themeMode==='dark'||(themeMode==='system'&&systemTheme.matches);
  const theme=dark?'dark':'light';
  const color=dark?'#181818':'#f4f7fb';
  document.documentElement.dataset.theme=theme;
  document.documentElement.dataset.themeMode=themeMode;
  document.documentElement.style.colorScheme=theme;
  document.documentElement.style.backgroundColor=color;
  document.querySelector('meta[name="color-scheme"]').content=theme;
  document.querySelector('meta[name="theme-color"]').content=color;
  const label=`外观：${themeLabels[themeMode]}；左右拖动或点击切换`;
  els.themeButton.title=label;
  els.themeButton.setAttribute('aria-label',label);
  updateThemeThumb();
}
function toggleTheme() {
  if(themeDragMoved) { themeDragMoved=false; return; }
  const next=themeModes[(themeModes.indexOf(themeMode)+1)%themeModes.length];
  setThemeMode(next);
}
function initThemeSlider() {
  const button=els.themeButton;
  const thumb=button.querySelector('.theme-thumb');
  let drag=null;
  const modeAt=(offset)=>sliderModes[Math.min(2,Math.max(0,Math.round(offset/(themeRange()||1)*2)))];
  button.setAttribute('role','slider');
  button.setAttribute('aria-valuemin','0');
  button.setAttribute('aria-valuemax','2');
  button.addEventListener('pointerdown',(event)=>{
    if(event.pointerType==='mouse'&&event.button!==0) return;
    drag={id:event.pointerId,startX:event.clientX,startOffset:themeOffset(themeMode),moved:false,mode:themeMode};
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointermove',(event)=>{
    if(!drag||event.pointerId!==drag.id) return;
    const dx=event.clientX-drag.startX;
    if(!drag.moved&&Math.abs(dx)<4) return;
    drag.moved=true; button.classList.add('dragging');
    const offset=Math.min(themeRange(),Math.max(0,drag.startOffset+dx));
    button.style.setProperty('--theme-x',`${offset}px`);
    drag.mode=modeAt(offset); thumb.dataset.mode=drag.mode;
  });
  const finish=(event,cancelled)=>{
    if(!drag||event.pointerId!==drag.id) return;
    const finished=drag; drag=null;
    button.classList.remove('dragging');
    try { button.releasePointerCapture?.(event.pointerId); } catch (_) {}
    if(!finished.moved) return;
    themeDragMoved=true;
    setTimeout(()=>{themeDragMoved=false},80);
    if(cancelled) updateThemeThumb(); else setThemeMode(finished.mode);
  };
  button.addEventListener('pointerup',(event)=>finish(event,false));
  button.addEventListener('pointercancel',(event)=>finish(event,true));
  button.addEventListener('keydown',(event)=>{
    const step=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;
    if(!step) return;
    event.preventDefault();
    setThemeMode(sliderModes[Math.min(2,Math.max(0,sliderModes.indexOf(themeMode)+step))]);
  });
  window.addEventListener('resize',updateThemeThumb);
}
function initTheme() {
  initThemeSlider();
  let saved='system';
  try { saved=localStorage.getItem('vps-value-theme')||'system'; } catch (_) {}
  applyTheme(saved);
  systemTheme.addEventListener('change',()=>{if(themeMode==='system')applyTheme('system')});
}
function setImageStatus(text) { els.imageStatus.textContent=text; }
function canCopyImage() { return !!(navigator.clipboard?.write&&window.ClipboardItem); }
async function copyImageBlob(source) {
  if(!canCopyImage()) throw new Error('clipboard image unsupported');
  // Keep write() inside the click gesture; Safari accepts a Promise that resolves after rendering.
  await navigator.clipboard.write([new ClipboardItem({'image/png':source})]);
}
function exportAndCopyImage() {
  const blobPromise=generateImage();
  if(!canCopyImage()) { blobPromise.then(blob=>{if(blob)setImageStatus('当前浏览器不支持复制图片，可长按图片保存')}); return; }
  copyImageBlob(blobPromise.then(blob=>{if(!blob)throw new Error('image failed');return blob}))
    .then(()=>setImageStatus('图片已复制到剪贴板'))
    .catch(()=>blobPromise.then(blob=>{if(blob)setImageStatus('自动复制失败，可长按图片保存')}));
}
async function generateImage() {
  if(!window.htmlToImage) { showToast('图片模块加载失败，请稍后重试'); return null; }
  generatedBlob=null; setImageStatus('正在生成图片…');
  els.imageDialog.showModal(); els.generatedImage.style.display='none';
  els.imageStage.querySelector('.spinner').style.display='block';
  const calculator=$('calculator').querySelector('.result-panel');
  // Elements shown on the page but omitted from the exported card.
  const hidden=[calculator.querySelector('.action-grid'),calculator.querySelector('.deal-heading small')].filter(Boolean);
  const previousStyles=hidden.map(e=>e.getAttribute('style'));
  hidden.forEach(e=>{e.style.display='none'});
  try {
    updateDealBadge();
    calculator.classList.add('exporting-card');
    await document.fonts.ready;
    // Match the canvas to the rendered layout; widening only the clone leaves
    // mobile child columns at their original width and creates blank space.
    const bounds=calculator.getBoundingClientRect();
    const width=Math.ceil(bounds.width);
    const height=Math.ceil(bounds.height);
    const dataUrl=await htmlToImage.toPng(calculator,{pixelRatio:2,cacheBust:true,backgroundColor:getComputedStyle(document.body).backgroundColor,width,height,style:{boxShadow:'none'}});
    const blob=await (await fetch(dataUrl)).blob(); generatedBlob=blob;
    const url=URL.createObjectURL(blob);
    if(els.generatedImage.src.startsWith('blob:')) URL.revokeObjectURL(els.generatedImage.src);
    els.generatedImage.src=url; els.downloadImage.href=url;
    els.downloadImage.download=`vps-value-${localDateString()}.png`;
    els.generatedImage.style.display='block';
    return blob;
  } catch(err) { console.error(err); els.imageDialog.close(); showToast('图片生成失败'); return null; }
  finally {
    calculator.classList.remove('exporting-card');
    hidden.forEach((e,i)=>{
      if(previousStyles[i]===null) e.removeAttribute('style');
      else e.setAttribute('style',previousStyles[i]);
    });
    els.imageStage.querySelector('.spinner').style.display='none';
  }
}
function bindEvents() {
  ['price','tradeDate','dueDate'].forEach(id=>els[id].addEventListener('input',()=>calculate()));
  ['tradeDate','dueDate'].forEach(id=>els[id].addEventListener('change',()=>calculate()));
  els.currency.addEventListener('change',()=>fetchRate());
  document.querySelectorAll('#cycleOptions button').forEach(btn=>btn.addEventListener('click',()=>{
    cycleDays=Number(btn.dataset.days); document.querySelectorAll('#cycleOptions button').forEach(b=>b.classList.toggle('active',b===btn)); calculate();
  }));
  els.salePrice.addEventListener('focus',()=>{
    // Clear only the automatic amount before typing begins. Do not intercept
    // native insertion or selection: mobile number keyboards need both intact.
    if(lastDealEdit!=='sale') els.salePrice.value='';
  });
  els.salePrice.addEventListener('blur',()=>{
    if(lastDealEdit!=='sale') syncDealFields();
  });
  els.salePrice.addEventListener('input',()=>{lastDealEdit='sale';syncDealFields()});
  els.themeButton.addEventListener('click',toggleTheme);
  els.copyDetails.addEventListener('click',()=>copyText(resultText(),'计算结果已复制'));
  els.exportImage.addEventListener('click',exportAndCopyImage); els.closeDialog.addEventListener('click',()=>els.imageDialog.close());
  els.imageDialog.addEventListener('click',e=>{if(e.target===els.imageDialog)els.imageDialog.close()});
  els.nativeShare.addEventListener('click',async()=>{
    if(!generatedBlob)return; const file=new File([generatedBlob],'vps-value.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'VPS 剩余价值'});return}catch(_){}}
    showToast('当前浏览器不支持图片分享，请下载保存');
  });
}
function init() {
  initTheme(); loadState(); setDefaults(); updateCurrencyUi(); bindEvents(); calculate();
  // Remove legacy rate caches; every page load requests the provider's latest rate.
  try { localStorage.removeItem('vps-value-rates-v1'); localStorage.removeItem('vps-value-state-v1'); } catch (_) {}
  fetchRate();
  const repo=document.documentElement.dataset.repo; if(repo)els.githubLink.href=repo;
}
init();
