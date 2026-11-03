const WIDTH=2400, HEIGHT=1600, MIN=.01, MAX=2, PADDING=24, STEP=1.25;
const qa=new URLSearchParams(location.search).get('qa')==='1';
const storageKey='milo-preview-zoom-v1'+(qa?'-qa':'');
const workspace=document.querySelector('#preview-workspace');
const size=document.querySelector('#preview-size');
const frame=document.querySelector('#demo-frame');
const percent=document.querySelector('#zoom-percent');
const range=document.querySelector('#zoom-range');
const fit=document.querySelector('#zoom-fit');
const readout=document.querySelector('#zoom-readout');
const zoomOut=document.querySelector('#zoom-out');
const zoomIn=document.querySelector('#zoom-in');
let mode='fit', scale=1;
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.mode==='manual'&&Number.isFinite(saved.scale)){mode='manual';scale=Math.min(MAX,Math.max(MIN,saved.scale));}}catch{}

const childUrl=new URL('./index.html',location.href);
childUrl.searchParams.set('embedded','1');
if(qa)childUrl.searchParams.set('qa','1');
frame.src=childUrl.href;
document.querySelector('#return-to-app').href=qa?'./index.html?qa=1':'./index.html';

function saveZoom(){try{localStorage.setItem(storageKey,JSON.stringify({mode,scale}));}catch{}}
function updateControls(){
  const value=Math.round(scale*1000)/10;
  if(document.activeElement!==percent)percent.value=String(value);
  range.value=String(value);
  fit.setAttribute('aria-pressed',String(mode==='fit'));
  zoomOut.disabled=scale<=MIN;zoomIn.disabled=scale>=MAX;
  document.querySelectorAll('[data-scale]').forEach(button=>button.setAttribute('aria-pressed',String(mode==='manual'&&Math.abs(Number(button.dataset.scale)-scale)<.0001)));
  readout.textContent=`${mode==='fit'?'自动适应':'手动缩放'} · ${Math.round(WIDTH*scale)} × ${Math.round(HEIGHT*scale)} px`;
}
function applyScale(next,{keepCenter=true}={}){
  if(!Number.isFinite(next))return;
  const viewport=workspace.getBoundingClientRect();
  const before=size.getBoundingClientRect();
  const cx=viewport.left+workspace.clientWidth/2, cy=viewport.top+workspace.clientHeight/2;
  const focusX=Math.max(0,Math.min(WIDTH,(cx-before.left)/scale));
  const focusY=Math.max(0,Math.min(HEIGHT,(cy-before.top)/scale));
  scale=Math.min(MAX,Math.max(MIN,next));
  size.style.width=`${WIDTH*scale}px`;size.style.height=`${HEIGHT*scale}px`;
  frame.style.transform=`scale(${scale})`;size.classList.add('ready');
  if(keepCenter){const after=size.getBoundingClientRect();workspace.scrollLeft+=after.left+focusX*scale-cx;workspace.scrollTop+=after.top+focusY*scale-cy;}
  else workspace.scrollTo({left:0,top:0,behavior:'instant'});
  updateControls();saveZoom();
}
function fitWindow(){
  mode='fit';
  applyScale(Math.min((workspace.clientWidth-PADDING*2)/WIDTH,(workspace.clientHeight-PADDING*2)/HEIGHT),{keepCenter:false});
}
function manual(next){mode='manual';applyScale(next);}
zoomOut.addEventListener('click',()=>manual(scale/STEP));
zoomIn.addEventListener('click',()=>manual(scale*STEP));
range.addEventListener('input',()=>manual(Number(range.value)/100));
percent.addEventListener('input',()=>{const value=Number(percent.value);if(percent.value.trim()&&Number.isFinite(value)&&value>=MIN*100&&value<=MAX*100)manual(value/100);});
percent.addEventListener('change',()=>{const value=Number(percent.value);if(percent.value.trim()&&Number.isFinite(value))manual(value/100);percent.value=String(Math.round(scale*1000)/10);});
document.querySelectorAll('[data-scale]').forEach(button=>button.addEventListener('click',()=>manual(Number(button.dataset.scale))));
fit.addEventListener('click',fitWindow);
new ResizeObserver(()=>{if(mode==='fit')fitWindow();}).observe(workspace);
if(mode==='fit')fitWindow();else applyScale(scale,{keepCenter:false});
