import { FOODS, SPEECH_LINES, getAgeBand } from './content.js';
import { UNITS, getUnitStoryPages, getUnitTrials, sampleFor, EXTRA_SPEECH_LINES } from './curriculum.js';
import { HEART_RULES, freshLearningState, initializeJourney, archiveUnit, unitRecord, switchUnit, awardHearts, happinessValue, totalHearts } from './journey.js';
Object.assign(SPEECH_LINES, EXTRA_SPEECH_LINES);
import { buildEvidence, getProgress } from './evidence.js';

const MAIN_TABS=['library','home','album'];
const collectionScroll={library:0,album:0};
const STORAGE_SUFFIX = new URLSearchParams(location.search).get('qa')==='1'?'-qa':'';
const STORAGE_KEY = 'milo-companion-world-v2'+STORAGE_SUFFIX;
const LEGACY_STORAGE_KEY = 'milo-first-day-flow-v1'+STORAGE_SUFFIX;
const embeddedPreview = new URLSearchParams(location.search).get('embedded')==='1';
const previewHref = './preview.html'+(new URLSearchParams(location.search).get('qa')==='1'?'?qa=1':'');
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const foods = Array.isArray(FOODS) ? Object.fromEntries(FOODS.map(f => [f.id, f])) : FOODS;
const LEVELS = {beginner:'刚开始接触',words:'知道一些单词',talk:'能简单交流'};
const freshState = () => ({
  version:2,screen:'welcome',profile:{age:5,level:'beginner',name:'小探险家'},
  setupDone:false,settings:{sound:true,guideVoice:'neural'},activeUnitId:'picnic',unitRecords:{},relationship:{rewards:{}},navigation:{mainTab:'home'},
  ...freshLearningState(),savedAt:null
});
let state;
try { const old=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)); state=[1,2].includes(old?.version)?old:freshState(); } catch { state=freshState(); }
state.version=2;
state.navigation??={mainTab:MAIN_TABS.includes(state.screen)?state.screen:'home'};
if(!MAIN_TABS.includes(state.navigation.mainTab))state.navigation.mainTab=MAIN_TABS.includes(state.screen)?state.screen:'home';
state.pack.resolved ??= Object.fromEntries((state.pack.events||[]).filter(event=>event.correct===true).map(event=>[event.trialId,true]));
state.pack.review ??= false;
state.settings.guideVoice ??= 'neural';
initializeJourney(state);
const neuralAudioReady = fetch('./assets/audio-neural/manifest.json?v=0.4.8')
  .then(response=>{if(!response.ok)throw new Error('Voice pack unavailable');return response.json();})
  .then(manifest=>new Map((manifest.audio||[]).filter(item=>item.lang==='zh-CN'&&item.path?.startsWith('assets/audio-neural/')).map(item=>[item.key,item.path])))
  .catch(()=>new Map());
let feedback=null, recorder=null, stream=null, recordingUrl=null, recording=false, recordingPending=false;
let currentAudio=null, currentSpeech=null, audioToken=0, toastTimer, recordTimer, cancelAudioResolve=null, recordGeneration=0;
let returnAfterParent='home';

const e = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name,cls='') => `<img class="icon ${cls}" src="./assets/icons/${e(name)}.svg" alt="" aria-hidden="true">`;
const robot = (size='big',action='greet') => `<button class="robot milo-avatar ${size}" data-action="${action}" aria-label="听 Milo 说话"><img src="./assets/art/milo-companion.png" alt="挥手的故事伙伴 Milo"></button>`;
const btn = (label,action,kind='primary',ico='',extra='') => `<button class="${kind}" data-action="${action}" ${extra}>${ico?icon(ico):''}${label}</button>`;
const food = id => foods[id] || {id,label:id,labelZh:id,icon:id,color:'#f1efe7'};
const foodArt = (id,extra='') => { const f=food(id); return `<span class="food-art ${extra}" style="--food-bg:${e(f.color||'#f1efe7')}">${icon(f.icon||id)}</span>`; };
const foodMini = id => `<span class="object-mini" style="color:${e(food(id).ink||'#455844')}">${icon(food(id).icon||id)}</span>`;
const currentUnit = () => UNITS.find(unit=>unit.id===state.activeUnitId)||UNITS[0];
const storyPages = () => getUnitStoryPages(state.activeUnitId);
const trials = () => getUnitTrials(state.profile,state.activeUnitId);
const unitVoice = key => state.activeUnitId==='breakfast'&&SPEECH_LINES[`breakfast_${key}`]?`breakfast_${key}`:key;
const progress = () => getProgress(state);
const trial = () => trials()[Math.min(state.pack.trialIndex,trials().length-1)];
function save(){archiveUnit(state);state.savedAt=new Date().toISOString();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
function toast(message){const node=document.querySelector('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{node.classList.remove('show');node.textContent='';},3300);}
function closeDialog(){if(dialog.open){stopSound();dialog.close();}}
function modal(title,body,buttons=''){stopSound();if(recording||recordingPending)stopRecording();dialog.innerHTML=`<button class="dialog-close" data-action="close-dialog" aria-label="关闭">${icon('x')}</button><h2 id="dialog-title">${title}</h2>${body}${buttons?`<div class="button-row">${buttons}</div>`:''}`;if(!dialog.open)dialog.showModal();}
function stopSound(){audioToken++;if(cancelAudioResolve){cancelAudioResolve(false);cancelAudioResolve=null;}if(currentAudio){currentAudio.pause();currentAudio=null;}try{speechSynthesis.cancel();}catch{}currentSpeech=null;audioState('');}
function audioState(text){const node=document.querySelector('#audio-state');if(node)node.textContent=text;}
function speechFallback(text,lang,token){return new Promise(resolve=>{
  if(!window.speechSynthesis||token!==audioToken)return resolve(false);
  const u=new SpeechSynthesisUtterance(text);let settled=false;
  const finish=ok=>{if(settled)return;settled=true;if(cancelAudioResolve===cancel)cancelAudioResolve=null;if(currentSpeech===u)currentSpeech=null;if(token===audioToken)audioState(ok?'':'声音暂不可用，可继续点选或重听');resolve(ok);};
  const cancel=()=>finish(false);cancelAudioResolve=cancel;
  const voices=speechSynthesis.getVoices();u.lang=lang;u.rate=lang.startsWith('zh')?.9:.82;u.voice=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.split('-')[0]))||null;currentSpeech=u;
  u.onstart=()=>{if(token===audioToken&&currentSpeech===u)audioState('正在播放，点击上方声音按钮可关闭');};
  u.onend=()=>finish(true);u.onerror=()=>finish(false);speechSynthesis.speak(u);
});}
function playLocalAudio(path,token,page){return new Promise(resolve=>{
  const a=new Audio(`./${path}?v=0.4.8`);let settled=false;currentAudio=a;
  const finish=ok=>{if(settled)return;settled=true;a.onplaying=a.onended=a.onerror=null;if(currentAudio===a)currentAudio=null;if(cancelAudioResolve===cancel)cancelAudioResolve=null;if(token===audioToken)audioState('');resolve(ok);};
  const cancel=()=>{a.pause();finish(false);};cancelAudioResolve=cancel;
  a.onplaying=()=>{if(token!==audioToken)return cancel();audioState('正在播放');if(page!==null&&!state.reader.audioPlayed.includes(page)){state.reader.audioPlayed.push(page);save();}};
  a.onended=()=>{if(token===audioToken&&page!==null&&!state.reader.audioEnded.includes(page)){state.reader.audioEnded.push(page);save();}finish(true);};
  a.onerror=()=>finish(false);a.play().catch(()=>finish(false));
});}
async function say(key,{text,lang='zh-CN',page=null,guideVoice=state.settings.guideVoice,preview=false}={}){
  stopSound();if(!state.settings.sound&&!preview)return false;const token=audioToken;
  key=unitVoice(key);
  const line=SPEECH_LINES[key];const sourceText=(typeof line==='string'?line:line?.text) || text;
  const sourceLang=(typeof line==='object'&&line?.lang)||lang;
  if(!sourceText)return false;
  let ok=false;
  if(line&&sourceLang.startsWith('zh')&&guideVoice!=='legacy'){
    const neuralAudio=await neuralAudioReady;if(token!==audioToken)return false;
    if(neuralAudio.has(key))ok=await playLocalAudio(neuralAudio.get(key),token,page);
  }
  if(!ok&&line&&token===audioToken)ok=await playLocalAudio(`assets/audio/${encodeURIComponent(key)}.wav`,token,page);
  if(!ok&&token===audioToken)ok=await speechFallback(sourceText,sourceLang,token);
  return ok;
}
function openVoiceSettings(){const modern=state.settings.guideVoice!=='legacy';modal('中文引导声音',`<p>默认使用晓晓女声，语速稍慢。可以试听同一句话，再选择喜欢的声音。</p><div class="help-choices"><button class="choice voice-choice ${modern?'selected':''}" data-action="guide-voice" data-value="neural" aria-pressed="${modern}"><strong>晓晓 · 新版中文引导</strong><small>自然音高，语速稍慢</small></button>${btn('试听新版','voice-preview-new','secondary','volume')}<button class="choice voice-choice ${!modern?'selected':''}" data-action="guide-voice" data-value="legacy" aria-pressed="${!modern}"><strong>原版 · 系统女声</strong><small>保留作试听对比</small></button>${btn('试听原版','voice-preview-old','quiet','volume')}</div><p class="dialog-note">这里调整中文引导，英文听读保持原来的声音。试听会单独播放一次。</p>`,btn('保存并返回','close-dialog','primary','check'));}
function go(screen,voice=true){
  closeDialog();stopSound();if(recording||recordingPending)stopRecording();
  const valid=['welcome','setup','meet','home','path','reader','pack','expression','memory','finish','library','album','parent','plans','mentor'];
  state.screen=valid.includes(screen)?screen:'home';
  if(MAIN_TABS.includes(state.screen))state.navigation.mainTab=state.screen;
  if(['reader','pack','expression','memory'].includes(state.screen))state.lastActivity=state.screen;
  feedback=null;save();render();
  window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('main h1')?.focus({preventScroll:true});
  if(voice)autoVoice();
}
async function autoVoice(){
  const s=state.screen;
  if(s==='meet')say('meet',{text:'你好，我是 Milo。今天我们一起准备野餐。点一下小喇叭，可以再听一次。'});
  if(s==='home')say(quickUnit().id!==state.activeUnitId?'breakfast_home':state.completedAt?'homeComplete':'home',{text:state.completedAt?'今天的野餐完成啦。你还可以再读一次故事。':'今天我们一起准备野餐。点开始冒险，一起出发吧。'});
  if(s==='reader'){if(!state.reader.introPlayed){state.reader.introPlayed=true;save();const ok=await say('readerIntro');if(!ok||state.screen!=='reader')return;}const p=storyPages()[state.reader.page];say(p.audioKey||`story_${p.id}`,{text:p.english,lang:'en-US',page:state.reader.page});}
  if(s==='pack'){if(!state.pack.introPlayed){state.pack.introPlayed=true;save();const ok=await say('packIntro');if(!ok||state.screen!=='pack')return;}const t=trial();say(t.audioKey||`trial_${state.profile.level}_${t.target}`,{text:t.question,lang:'en-US'});}
  if(s==='expression')say('expressionIntro',{text:'你想带什么去野餐？先选一样，再试着告诉我。你也可以只选择。'});
  if(s==='memory')say('memory',{text:'我们的野餐准备好啦！谢谢你和我一起完成。'});
  if(s==='finish')say('finish',{text:'今天的冒险完成啦。休息一下吧，下次再一起玩。'});
}
function nextActivity(){if(!state.reader.done)return'reader';if(!state.pack.done)return'pack';if(!state.expression.done)return'expression';if(!state.completedAt)return'memory';return'finish';}
function stageTitle(){return {reader:'听读故事',pack:'装好野餐篮',expression:'表达我的选择',memory:'留下旅行页'}[nextActivity()]||'回看今天的冒险';}


let heartNotice=null,heartNoticeTimer;
function reward(eventId,amount){
  const gained=awardHearts(state,eventId,amount);
  if(gained){heartNotice={amount:gained,expires:Date.now()+2400};clearTimeout(heartNoticeTimer);heartNoticeTimer=setTimeout(()=>{heartNotice=null;document.querySelector('.heart-reward')?.remove();},2400);}
  return gained;
}
function rewardMarkup(){return heartNotice&&heartNotice.expires>Date.now()?`<div class="heart-reward" role="status">${icon('heart')}+${heartNotice.amount} 小心心 · 谢谢你和我一起完成</div>`:'';}
function isUnitDone(id){return getProgress(unitRecord(state,id)||{}).completed;}
function isUnitUnlocked(id){const index=UNITS.findIndex(unit=>unit.id===id);return index>=0&&UNITS[index].available&&UNITS.slice(0,index).filter(unit=>unit.available).every(unit=>isUnitDone(unit.id));}
function quickUnit(){
  if(!isUnitDone(state.activeUnitId)&&isUnitUnlocked(state.activeUnitId))return currentUnit();
  return UNITS.find(unit=>unit.available&&isUnitUnlocked(unit.id)&&!isUnitDone(unit.id))||currentUnit();
}
function selectUnit(id){
  if(!isUnitUnlocked(id))return false;
  if(state.activeUnitId!==id){
    recordGeneration++;stopRecording();stopSound();if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=null;
    switchUnit(state,id);state.reader.pagesFinished??=[];
  }
  save();return true;
}
function beginUnit(id){if(!selectUnit(id))return openUnit(id);if(isUnitDone(id))state.reader.page=0;return go(isUnitDone(id)?'reader':nextActivity());}
function openUnit(id){
  const unit=UNITS.find(item=>item.id===id);if(!unit)return;
  if(!unit.available)return modal('这段冒险正在准备中',`<p>“${e(unit.title)}”还在筹备。先和 Milo 一起探索已经开放的故事吧。</p>`,btn('回到学习地图','close-dialog','primary'));
  if(!isUnitUnlocked(id)){const previous=UNITS[UNITS.findIndex(item=>item.id===id)-1];return modal('先完成前面的冒险',`<p>完成“${e(previous.title)}”后，我们就能一起探索“${e(unit.title)}”。</p>`,btn(`继续${e(previous.title)}`,'unit-start','primary','player-play',`data-unit="${previous.id}"`));}
  const record=unitRecord(state,id)||freshLearningState();const done=getProgress(record);
  const steps=[['reader','book','听读故事',true,done.readerDone],['pack','basket',id==='breakfast'?'摆好早餐':'装好篮子',done.readerDone,done.packDone],['expression','microphone','表达选择',done.packDone,done.expressionDone],['memory','map','共同旅行页',done.expressionDone,done.completed]];
  modal(e(unit.title),`<p>${e(unit.subtitle)}。一个完整单元里，我们会一起完成下面四个环节。</p><div class="unit-activity-list">${steps.map(([route,ico,title,enabled,finished])=>btn(`${title}${finished?' · 已完成':''}`,'unit-activity','quiet',finished?'check':ico,`data-unit="${id}" data-screen="${route}" ${enabled?'':'disabled'}`)).join('')}</div><p class="dialog-note">小心心记录我们一起参与过的环节，不是答题分数。需要帮助、只点选而不录音，都可以获得同样的奖励。</p>`,btn(done.completed?'重读这个单元':record.lastActivity?'继续这个单元':'开始这个单元','unit-start','primary','player-play',`data-unit="${id}"`));
}
function happinessWidget(){const value=happinessValue(state);return `<button class="happiness-widget" data-action="heart-info" aria-label="Milo 开心值 ${value}，了解小心心"><span class="happiness-icon">${icon('heart')}</span><span class="happiness-main"><span class="happiness-label">MILO 的开心值</span><span class="happiness-track" role="progressbar" aria-label="伙伴开心值" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><span class="happiness-fill" style="display:block;width:${value}%"></span></span></span><span class="happiness-value">${value}<small> / 100</small></span></button>`;}
function worldTopbar(){return `<header class="world-topbar"><div class="world-tools">${state.screen==='path'?`<button class="world-tool" data-action="home" aria-label="返回 Milo 的家">${icon('arrow-left')}</button>`:`<button class="world-tool" data-action="world-settings" aria-label="设置">${icon('settings')}</button>`}</div>${happinessWidget()}<div class="world-tools"><button class="world-tool" data-action="sound" aria-label="${state.settings.sound?'关闭声音':'打开声音'}">${icon(state.settings.sound?'volume':'volume-off')}</button><button class="world-parent" data-action="parent-gate">${icon('users')}家长</button></div></header>`;}
function worldNav(lesson=false){const selected=MAIN_TABS.includes(state.screen)?state.screen:state.navigation.mainTab;return `<nav class="world-nav ${lesson?'lesson-nav':''}" aria-label="儿童主导航">${[['library','book','书架'],['home','home','今天'],['album','map','旅行册']].map(([route,ico,label])=>`<button class="world-nav-item ${route===selected?'active':''}" data-action="go" data-screen="${route}" ${route===selected?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;}
function header(){return `<header class="app-header"><div class="brand"><span class="brand-mark">${icon('book')}</span><span>Milo<small>ENGLISH ADVENTURES</small></span></div>${state.setupDone?`<button class="lesson-hearts" data-action="heart-info" aria-label="Milo开心值 ${happinessValue(state)}">${icon('heart')}${happinessValue(state)}</button>`:''}<div class="header-tools"><button class="icon-button" data-action="sound" aria-label="${state.settings.sound?'关闭声音':'打开声音'}">${icon(state.settings.sound?'volume':'volume-off')}</button>${state.setupDone?`<button class="parent-button" data-action="parent-gate">${icon('users')}家长</button>`:''}</div></header>`;}
function nav(){return worldNav(true);}
function routeBar(){if(['welcome','setup','home'].includes(state.screen))return'';const parent=['parent','plans','mentor'].includes(state.screen);return `<div class="route-bar"><button class="text-button" data-action="${parent?'parent-back':'back'}">${icon('arrow-left')}${parent?(state.screen==='parent'?'返回孩子模式':'家长中心'):'返回'}</button><div class="crumb">${parent?'家长中心':`${e(currentUnit().title)} · 单元 ${currentUnit().order}`}</div>${parent?'':`<button class="text-button" data-action="pause">${icon('player-pause')}稍后继续</button>`}</div>`;}
function welcome(){return `<main class="content welcome"><div class="split"><section class="hero-copy"><span class="eyebrow">HELLO, LITTLE EXPLORER</span><h1 tabindex="-1">第一次英语冒险，<br>从一场野餐开始。</h1><p class="lede">听一个小故事，帮伙伴准备食物，<br>留下属于你们的第一张旅行页。</p>${btn('家长快速设置','setup','primary','arrow-right')}<p class="onboarding-foot">适合 3–8 岁 · 无需注册 · 先完整体验一次<br>家长完成设置后，可以把接下来的冒险交给孩子。</p></section><section class="intro-card">${robot('big','intro-greet')}<div class="intro-list">${[['1','听故事，也能自己翻一翻'],['2','点一点、拖一拖，帮忙装篮子'],['3','选择或说一说，一起去野餐']].map(([n,t])=>`<div class="intro-item"><span class="number">${n}</span>${t}</div>`).join('')}</div></section></div></main>`;}
function setup(){return `<main class="content"><span class="eyebrow">FOR PARENTS</span><h1 tabindex="-1">先认识一下小探险家</h1><p class="lede">年龄调整操作方式，英语接触情况调整任务语言。</p><div class="split setup-layout wide-right"><section><div class="setup-fields"><div><label class="field-label" for="child-name">怎么称呼孩子？</label><input class="setup-name" id="child-name" maxlength="12" value="${e(state.profile.name)}" placeholder="小探险家" autocomplete="off"></div><div><span class="field-label">孩子几岁？</span><div class="age-options">${[3,4,5,6,7,8].map(n=>`<button class="choice ${state.profile.age===n?'selected':''}" data-action="age" data-value="${n}" aria-pressed="${state.profile.age===n}">${n} 岁</button>`).join('')}</div></div><div><span class="field-label">最近的英语接触情况</span><div class="level-options">${[['beginner','刚开始','先从单词与图片认识'],['words','知道一些单词','尝试听懂简短请求'],['talk','能简单交流','在情境中理解和回应']].map(([v,t,d])=>`<button class="choice level-choice ${state.profile.level===v?'selected':''}" data-action="level" data-value="${v}" aria-pressed="${state.profile.level===v}"><strong>${t}</strong><small>${d}</small></button>`).join('')}</div></div><div class="setup-sound"><span>先听一下声音，调整到合适音量</span><div class="button-row">${btn('试听','test-sound','text-button','volume')}${btn('选择声音','voice-settings','text-button')}</div></div></div><div class="setup-foot">${btn('交给孩子，开始探索','setup-finish','primary','arrow-right')}<span class="tiny">这些设置以后可以修改</span></div></section><aside class="setup-aside">${robot('small','intro-greet')}<h3>这一版可以体验什么？</h3><p>完整的听读、互动、帮助和首日反馈。进度保存在当前浏览器，可以随时重置。</p><div class="small-divider"></div><h3>说话是可选的</h3><p>到表达环节再自愿开启麦克风；点击选择也能完成故事。录音只在本次窗口播放，不上传。</p><p class="tiny">当前为流程样板：未接入语音识别或大模型，不自动评判发音或口语能力。没有真实支付和外教预约。</p></aside></div></main>`;}
function meet(){return `<main class="content"><div class="split"><div class="partner-stage"><div class="speech">Hi! I'm <strong>Milo</strong>.<br>你好，${e(state.profile.name)}！</div>${robot('big','greet')}<span class="partner-caption">点一下 Milo，听我打个招呼</span></div><section class="hero-copy"><span class="eyebrow">LET'S GET READY</span><h1 tabindex="-1">一起准备野餐吧</h1><p class="lede">小喇叭可以再听一次，<br>问号里有帮忙的小方法。</p><div class="button-row">${btn('再听一次','greet','secondary','volume')}${btn('看看怎么帮忙','tutorial-help','quiet','help-circle')}</div><div class="small-divider"></div>${btn('我准备好了','meet-finish','primary','arrow-right')}</section></div></main>`;}
function home(){
  const unit=quickUnit(),record=unitRecord(state,unit.id);const completed=isUnitDone(unit.id);const started=Boolean(record?.reader?.pagesSeen?.length||record?.lastActivity);
  const title=completed?'再和我读一次吧':started?`接着${unit.title}吧`:`我们去${unit.title==='早餐小帮手'?'准备早餐':'准备野餐'}吧`;
  return `<main class="world-home" aria-label="Milo 的家"><h1 class="world-sr-only" tabindex="-1">Milo 的家</h1><button class="home-companion" data-action="greet" aria-label="和 Milo 打个招呼"><img class="milo-art" src="./assets/art/milo-companion.png" alt="正在向你挥手的 Milo"></button><button class="milo-bubble" data-action="${completed?'unit-replay':'unit-start'}" data-unit="${unit.id}" aria-label="${completed?'重读':started?'继续':'开始'}${e(unit.title)}"><span class="bubble-eyebrow">MILO 想和你一起</span><strong>${e(title)}</strong><small>${completed?'熟悉的故事，也有新的发现':`${started?'继续当前单元':'开始新单元'} · ${e(unit.title)}`}</small><span class="bubble-play">${icon('player-play')}</span></button><div class="world-brand">Milo<small>YOUR LITTLE STORY COMPANION</small></div><button class="map-launch" data-action="path" aria-label="打开学习地图"><img class="rocket-art" src="./assets/art/rocket-map.png" alt="小火箭"><span class="map-launch-label"><strong>学习地图</strong><small>去看看下一段冒险</small></span></button></main>`;
}
function path(){
  const open=UNITS.filter(unit=>unit.available).length;
  return `<main class="world-map" aria-label="学习地图"><section class="map-companion"><img class="milo-art" src="./assets/art/milo-companion.png" alt="Milo 陪你一起探索"><div class="map-companion-copy"><h1 tabindex="-1">下一段冒险，<br>我们一起出发。</h1><p>一块六边形，就是一个完整单元。<br>向右滑动，看看更多故事。</p></div></section><section class="map-region"><div class="map-heading"><div><h2>我们的学习地图</h2><p>听故事，帮帮忙，再说说自己的选择。</p></div><span class="pill">${open} 个故事已开放</span></div><div class="map-scroll" id="unit-map" tabindex="0" aria-label="横向学习单元地图，可向右滑动"><div class="hex-path">${UNITS.map((unit,index)=>{const done=isUnitDone(unit.id),unlocked=isUnitUnlocked(unit.id),record=unitRecord(state,unit.id),p=getProgress(record||{});const count=[p.readerDone,p.packDone,p.expressionDone,p.completed].filter(Boolean).length;const status=done?'已完成 · 可以回看':!unit.available?'筹备中':unlocked?'从这里继续':'完成上一单元解锁';return `<button class="unit-node ${done?'completed':unlocked?'current':'locked'}" data-action="unit-open" data-unit="${unit.id}" data-index="${index}" aria-label="单元 ${index+1}，${e(unit.title)}，${status}"><span class="unit-number">UNIT ${String(index+1).padStart(2,'0')}</span><span class="unit-hex"><span class="unit-icon">${icon(unit.icon)}</span></span><span class="unit-label"><strong>${e(unit.title)}</strong><small>${e(unit.titleEn)}</small></span>${unit.available?`<span class="unit-mini-progress" aria-label="已完成${count}个环节，共4个">${[0,1,2,3].map(i=>`<i class="${i<count?'filled':''}"></i>`).join('')}</span>`:''}<span class="unit-state">${icon(done?'check':unlocked?'player-play':'lock')}${status}</span></button>`;}).join('')}</div></div><div class="map-paging"><span class="map-position">向右滑动探索 · 每块都是一个完整单元</span><button class="map-arrow" data-action="map-left" aria-label="向左查看地图">${icon('arrow-left')}</button><button class="map-arrow" data-action="map-right" aria-label="向右查看更多单元">${icon('arrow-right')}</button></div></section></main>`;
}
function reader(){const page=storyPages()[state.reader.page]||storyPages()[0];if(!state.reader.pagesSeen.includes(state.reader.page)){state.reader.pagesSeen.push(state.reader.page);save();}return `<main class="content"><div class="section-head"><div><span class="eyebrow">OUR STORY</span><h1 tabindex="-1">${e(page.titleZh)}</h1></div><span class="pill">第 ${state.reader.page+1} / ${storyPages().length} 页</span></div><div class="reader-layout"><section class="book-scene"><span class="scene-title">${e(currentUnit().titleEn.toUpperCase())}</span>${robot('small','reader-listen')}<div class="scene-foods">${(page.foods||[]).map(id=>foodArt(id)).join('')}</div></section><section><div class="story-text">${e(page.english)}</div><p class="story-guide">${e(page.guideZh||'点小喇叭，听听这一页。')}</p><div class="audio-control">${btn('听这一页','reader-listen','secondary','volume')}${btn('听中文提示','reader-guide','text-button','help-circle')}</div><p class="note">${e(page.partnerLine||'可以慢慢看，也可以再听一次。')}</p></section></div><div class="reader-controls">${btn('上一页','reader-prev','quiet','arrow-left',state.reader.page===0?'disabled':'')}<div class="dots">${storyPages().map((_,i)=>`<span class="dot ${i===state.reader.page?'active':''}"></span>`).join('')}</div>${btn(state.reader.page===storyPages().length-1?(state.activeUnitId==='breakfast'?'读完了，去摆早餐':'读完了，去装篮子'):'下一页','reader-next','primary','arrow-right')}</div></main>`;}
function foodButton(id,{labels=true,action='pack-choice',selected=false,draggable=false,demo=false}={}){const f=food(id);return `<button class="food-button ${selected?'selected':''} ${demo?'demo-highlight':''}" data-action="${action}" data-food="${e(id)}" aria-label="选择${e(f.labelZh)}" ${draggable?'data-draggable="true" draggable="false"':''}>${foodArt(id)}${labels?`<span class="food-name">${e(f.label)}</span><span class="food-hint">${e(f.labelZh)}</span>`:''}</button>`;}
function pack(){if(state.pack.done&&!state.pack.review)return packDone();const t=trial();state.pack.resolved??={};if(!feedback&&state.pack.resolved[t.id])feedback={correct:true,message:`${food(t.target).label}! 已经准备好啦，可以继续。`};const hint=state.pack.hints[t.id]||0;const choices=hint>=2?t.choices.filter(id=>id===t.target||id===t.choices.find(x=>x!==t.target)):t.choices;return `<main class="content"><div class="task-heading"><span class="eyebrow">LISTEN & PACK</span><h1 tabindex="-1">${getAgeBand(state.profile.age)==='older'?`完成${currentUnit().containerTitle}清单`:e(currentUnit().packTitle)}</h1><div class="task-question"><button class="icon-button" data-action="pack-replay" aria-label="重听 Milo 的请求">${icon('volume')}</button><span class="question-label">${hint?e(t.hintZh):'听听 Milo 想带什么'}</span></div><span class="tiny">${getAgeBand(state.profile.age)==='young'?'点一下食物，帮 Milo 准备好':'点选食物，或把它拖到右边的准备区'}</span></div><div class="task-area"><div class="food-grid ${choices.length===2?'two':choices.length===4?'four':''}">${choices.map(id=>foodButton(id,{labels:false,draggable:true,selected:feedback?.correct&&id===t.target,demo:hint>=3&&id===t.target})).join('')}</div><div class="basket-zone" id="basket-zone" aria-label="${e(currentUnit().containerTitle)}，拖入食物">${icon(currentUnit().containerIcon)}<strong>${e(currentUnit().containerTitle)}</strong><div class="basket-items">${state.pack.items.map(id=>icon(food(id).icon)).join('')}</div><small>${state.pack.items.length?`已准备好 ${state.pack.items.length} 样`:'食物放到这里'}</small></div></div><div class="feedback ${feedback?.correct?'success':feedback?'retry':''}" role="status">${feedback?icon(feedback.correct?'check':'repeat'):icon('headphones')}${feedback?e(feedback.message):'点小喇叭可以再听一次，问号里有帮助。'}</div><div class="task-footer"><span class="task-count">第 ${state.pack.trialIndex+1} / ${trials().length} 个请求</span><div class="button-row">${btn('帮帮我','help','secondary','help-circle',feedback?.correct?'disabled':'')}${feedback?.correct?btn('下一步','pack-next','primary','arrow-right'):''}</div></div></main>`;}
function packDone(){return `<main class="content"><div class="split"><div class="memory-paper">${robot('small','pack-done-greet')}<div class="memory-foods">${state.pack.items.map(id=>foodArt(id)).join('')}</div><div class="memory-title">${e(currentUnit().completionTitle)}</div><div class="memory-caption">谢谢你帮我准备食物。</div></div><section><span class="eyebrow">READY TO GO</span><h1 tabindex="-1">你想选什么？</h1><p class="lede">接下来轮到你来选择。<br>可以说一说，也可以点给我看。</p>${btn('表达我的选择','go-expression','primary','arrow-right')}${btn('再听一个请求','pack-review','text-button','repeat')}</section></div></main>`;}
function expression(){const selected=state.expression.selectedFood;const sampleInfo=sampleFor(selected)||sampleFor(currentUnit().foods[0]);const sample=sampleInfo.text;const sampleZh=sampleInfo.textZh;return `<main class="content"><div class="expression-layout"><div class="task-heading"><span class="eyebrow">YOUR CHOICE</span><h1 tabindex="-1">${state.activeUnitId==='breakfast'?'早餐你想吃什么？':'你想带什么去野餐？'}</h1><p class="note">先选一样，再告诉 Milo。也可以只选择。</p></div><div class="food-grid">${currentUnit().foods.map(id=>foodButton(id,{action:'expression-choice',selected:id===selected})).join('')}</div>${selected?`<div class="speech" style="margin:0 auto"><strong>${e(sample)}</strong><br><span class="tiny">${e(sampleZh)}</span></div><div class="record-controls">${btn('听一个说法','expression-sample','secondary','volume')}${btn(recording?'停止录音':recordingPending?'等待麦克风…':'试着说一说',recording?'record-stop':'record-start','quiet record-button '+(recording?'recording':''),'microphone',recordingPending?'disabled':'')}</div><div class="record-status" role="status">${recording?'正在录音，点停止结束；最多录制 20 秒。':state.expression.recorded?'你已经尝试说过了，可以听听自己的声音。':'愿意说时再打开麦克风，不想说也没关系。'}</div>${recordingUrl?`<div class="record-preview"><audio controls src="${e(recordingUrl)}" aria-label="回放我的录音"></audio></div>`:''}<div class="button-row center" style="margin-top:1.1875rem">${btn('我选好了，一起出发','expression-finish','primary','arrow-right',recording||recordingPending?'disabled':'')}</div>`:`<p class="note" style="text-align:center">点选上面的食物，告诉伙伴你的选择。</p>`}</div></main>`;}
function memoryPage(){const chosen=state.expression.selectedFood;const items=[...new Set([...state.pack.items,...(chosen?[chosen]:[])])];return `<main class="content"><div class="split"><section class="memory-paper">${robot('small','memory-greet')}<div class="memory-title">${e(currentUnit().memoryTitle)}</div><div class="memory-foods">${items.map(id=>foodArt(id)).join('')}</div><div class="memory-caption">${e(state.profile.name)} & Milo<br>${chosen?`你选了${e(food(chosen).labelZh)}，我们带着它出发。`:'我们一起准备了食物。'}</div></section><section><span class="eyebrow">A MEMORY, TOGETHER</span><h1 tabindex="-1">今天的冒险，<br>收进旅行册。</h1><p class="lede">你看过故事、帮忙准备食物，<br>还告诉了伙伴自己的选择。</p>${btn('收好旅行页，完成今天','complete-day','primary','check')}<p class="note">没有录音，也可以留下这张共同旅行页。</p></section></div></main>`;}
function finish(){return `<main class="content finish-content"><div class="split"><section><div class="completion-mark">${icon('check')}</div><span class="eyebrow">ADVENTURE COMPLETE</span><h1 tabindex="-1">今天就到这里，<br>我们下次再见。</h1><p class="lede">这次共同旅行页已经保存。<br>你可以休息，也可以再读一次喜欢的故事。</p><div class="button-row">${btn('看看旅行册','album','primary','map')}${btn('回到今天','home','quiet','home')}</div><div class="small-divider"></div>${btn('交给家长，看本次反馈','parent-gate','text-button','users')}</section><section class="memory-paper">${robot('small','finish-greet')}<div class="memory-foods">${[...new Set(state.pack.items)].map(id=>foodArt(id)).join('')}</div><div class="memory-title">${e(currentUnit().title)}</div><div class="memory-caption">我们一起完成的冒险</div></section></div></main>`;}
function library(){const units=UNITS.filter(unit=>unit.available);return `<main class="world-collection world-library" aria-label="Milo 的书架"><div class="collection-inner"><header class="collection-heading"><div class="collection-hello"><img src="./assets/art/milo-companion.png" alt="" aria-hidden="true"><div><span class="collection-eyebrow">STORIES WITH MILO</span><h1 tabindex="-1">我的小书架</h1><p>喜欢的故事，想听就再听一遍。</p></div></div><span class="collection-count">${icon('book')}${units.length} 本故事</span></header><div class="collection-scroll" tabindex="0" aria-label="故事书架"><div class="story-shelf">${units.map(unit=>{const record=unitRecord(state,unit.id),done=isUnitDone(unit.id),unlocked=isUnitUnlocked(unit.id);const seen=new Set(record?.reader?.pagesSeen||[]).size;const label=done?'已经完成，随时重读':unlocked?seen?'接着听这个故事':'和 Milo 一起听故事':'完成前一个故事后开启';return `<button class="story-card ${done?'story-completed':unlocked?'story-ready':'story-locked'}" data-action="book-open" data-unit="${unit.id}" aria-label="${e(unit.title)}，${label}"><span class="story-cover ${unit.id==='breakfast'?'cover-lavender':'cover-mint'}"><span class="story-cover-title">${e(unit.titleEn)}</span><img class="story-cover-milo" src="./assets/art/milo-companion.png" alt=""><span class="story-cover-foods">${unit.foods.map(id=>foodArt(id)).join('')}</span><span class="story-cover-number">${String(unit.order).padStart(2,'0')}</span></span><span class="story-card-copy"><strong>${e(unit.title)}</strong><small>${e(unit.subtitle)}</small><span class="story-reading-info">${icon('headphones')}4 页短故事${seen?` · 看过 ${seen} 页`:''}</span><span class="story-card-footer"><span class="story-status">${icon(done?'check':unlocked?'player-play':'lock')}${label}</span><span class="story-arrow">${icon('arrow-right')}</span></span></span></button>`;}).join('')}</div><p class="collection-hint">可以慢慢听，也可以回到喜欢的那一页。</p></div></div></main>`;}
function album(){const done=UNITS.filter(unit=>unit.available&&isUnitDone(unit.id));return `<main class="world-collection world-album" aria-label="和 Milo 的旅行册"><div class="collection-inner"><header class="collection-heading"><div class="collection-hello"><img src="./assets/art/milo-companion.png" alt="" aria-hidden="true"><div><span class="collection-eyebrow">OUR LITTLE MEMORIES</span><h1 tabindex="-1">我们的旅行册</h1><p>把一起经历过的故事，好好收起来。</p></div></div><span class="collection-count">${icon('map')}${done.length} 张旅行页</span></header><div class="collection-scroll" tabindex="0" aria-label="共同旅行页">${done.length?`<div class="memory-collection">${done.map((unit,index)=>{const record=unitRecord(state,unit.id);const chosen=record.expression.selectedFood;return `<article class="memory-card"><div class="memory-scene ${unit.id==='breakfast'?'memory-lavender':'memory-peach'}"><span class="memory-scene-tag">OUR ADVENTURE ${String(index+1).padStart(2,'0')}</span><img src="./assets/art/milo-companion.png" alt="与你一起完成故事的 Milo"><div class="memory-keepsakes">${[...new Set([...record.pack.items,chosen].filter(Boolean))].map(id=>`<span class="memory-keepsake ${id===chosen?'chosen':''}">${foodArt(id)}<small>${e(food(id).labelZh)}</small></span>`).join('')}</div></div><div class="memory-card-copy"><span class="memory-complete">${icon('check')}一起完成的故事</span><h2>${e(unit.memoryTitle)}</h2><p>${e(state.profile.name)} & Milo${chosen?` · 你选了${e(food(chosen).labelZh)}`:''}</p><div class="memory-actions">${btn('再读一次','book-open','secondary','book',`data-unit="${unit.id}"`)}${btn('家长回顾','unit-recap','quiet','users',`data-unit="${unit.id}"`)}</div></div></article>`;}).join('')}</div><p class="collection-hint">每一页，都来自你和 Milo 真实完成的共同冒险。</p>`:`<section class="album-empty"><img src="./assets/art/milo-companion.png" alt="等待和你一起完成故事的 Milo"><div class="album-empty-copy"><span class="collection-eyebrow">OUR FIRST MEMORY</span><h2>第一张旅行页，<br>等你一起完成。</h2><p>听个故事，帮忙做准备，<br>再告诉 Milo 你的选择。</p>${btn('继续今天的故事','start','primary collection-start','player-play')}</div></section>`}</div></div></main>`;}
function parent(){const data=buildEvidence(state);const p=progress();const listening=data.listening||{};const expressionData=data.expression||{};const support=data.support||{};return `<main class="content"><div class="section-head"><div><span class="eyebrow">PARENT RECAP</span><h1 tabindex="-1">这个单元，具体发生了什么</h1><p class="lede">${e(currentUnit().title)} · ${e(state.profile.name)} · ${state.profile.age} 岁 · ${e(LEVELS[state.profile.level])}</p></div><span class="pill">${p.completed?'单元已完成':'正在体验'}</span></div><div class="unit-recap-tabs">${UNITS.filter(unit=>unit.available).map(unit=>btn(unit.title,'unit-recap',state.activeUnitId===unit.id?'primary':'quiet','',`data-unit="${unit.id}"`)).join('')}</div><div class="parent-layout"><section><div class="evidence-section"><div class="evidence-label">${icon('book')}听读与参与</div>${(data.participation||[]).map(t=>`<p>${e(t)}</p>`).join('')}</div><div class="evidence-section"><div class="evidence-label">${icon('headphones')}理解活动</div><p>${e(listening.summary)}</p>${(listening.trials||[]).map(t=>`<details class="evidence-detail"><summary>${e(t.label||t.question||t.target||t.trialId)}</summary><div>${e(typeof t.description==='string'?t.description:JSON.stringify(t))}</div></details>`).join('')}</div><div class="evidence-section"><div class="evidence-label">${icon('microphone')}表达尝试</div><p>${e(expressionData.summary)}</p>${recordingUrl?`<audio controls src="${e(recordingUrl)}" aria-label="回放本次录音"></audio>`:''}</div><div class="evidence-section"><div class="evidence-label">${icon('help-circle')}使用了哪些支持</div><p>${e(support.summary)}</p><p class="tiny">成人是否协助：本次未确认。自己操作与语言表现分别看。</p></div><div class="evidence-section"><div class="evidence-label">${icon('route')}接下来怎么安排</div><p>${e(data.nextStep)}</p></div><details class="evidence-detail" style="margin-top:1.25rem"><summary>查看本次记录与演示边界</summary><ul>${(data.caveats||[]).map(t=>`<li>${e(t)}</li>`).join('')}</ul><p>中文引导使用本地神经语音音频，英文使用系统语音合成；未接入自动语音识别、发音评分或大语言模型。录音不上传，仅在当前窗口回放。没有真实扣费或预约。</p>${btn('下载本次记录','export','text-button','download')}</details></section><aside><div class="aside-card"><h3>中文引导声音</h3><p>${state.settings.guideVoice==='legacy'?'原版系统女声':'晓晓女声 · 语速稍慢'}</p>${btn('试听与调整声音','voice-settings','secondary wide','volume')}</div><div class="aside-card"><span class="eyebrow">NEXT ADVENTURE</span><h3 style="margin-top:0.75rem">换个情境，再观察一次</h3><p>继续使用这些食物，在新的位置和请求中看看孩子如何回应。</p>${btn('返回孩子的今天','home','secondary wide','home')}</div><div class="aside-card"><h3>需要真人进一步了解？</h3><p>稳定导师可结合实际表现，安排交流与后续建议。</p>${btn('看看导师指导','mentor','secondary wide','users')}</div><div class="aside-card"><h3>了解后续学习方案</h3><p>家庭内容订阅与导师服务分别说明。</p>${btn('查看权益','plans','secondary wide','arrow-right')}</div></aside></div></main>`;}
function plans(){return `<main class="content"><span class="eyebrow">FOR YOUR FAMILY</span><h1 tabindex="-1">选择适合家庭的下一步</h1><p class="lede">当前只展示权益与选择流程，价格及服务数量待确定。</p><div class="plan-grid">${[['完整样板','已可体验','第一天完整学习体验',['听读故事与任务互动','伙伴引导、帮助和旅行页','本次真实操作反馈'],'回到样板','home'],['家庭内容订阅','持续听读','按阶段继续探索更多故事',['持续主题与书架内容','适配活动与学习安排','周期回顾与家长支持'],'体验选择这个方案','select-family'],['导师周期服务包','家庭订阅之上加购','稳定导师，持续了解孩子',['固定周期一对一交流','课前了解与课后观察','个性化调整与家长指导'],'看看指导流程','mentor']].map(([title,tag,desc,items,label,action],i)=>`<section class="plan ${i===1?'featured':''}"><span class="plan-tag">${tag}</span><h2>${title}</h2><p>${desc}</p><ul>${items.map(t=>`<li>${t}</li>`).join('')}</ul>${btn(label,action,i===1?'primary':'secondary','arrow-right')}</section>`).join('')}</div><p class="note">样板拥有完整结尾；已有作品与基础记录可回看。这里不会发起支付或开通自动续费。</p></main>`;}
function mentor(){return `<main class="content"><span class="eyebrow">A CONTINUOUS CONNECTION</span><h1 tabindex="-1">让老师接着了解孩子</h1><p class="lede">把家庭学习中的具体表现，带入真实交流。</p><div class="mentor-card"><span class="mentor-avatar">${icon('users')}</span><div><h2>示例导师 Alex</h2><p>稳定导师 · 周期一对一<br>这里是服务流程示例，未匹配真实老师。</p></div></div><div class="split"><section><h3>课前，老师会看到</h3><div class="info-list">最近听读的材料<br>选择任务、提示与重听记录<br>本次表达尝试及待观察的问题</div></section><section><h3>交流后，家庭会得到</h3><div class="info-list">具体情境中的老师观察<br>下一阶段选书与活动建议<br>需要继续观察的目标与支持方式</div></section></div><div class="small-divider"></div><h3>你更方便哪个时段？</h3><div class="slots">${['工作日傍晚','周末上午','周末下午'].map(v=>`<button class="choice" data-action="slot" data-value="${v}">${v}</button>`).join('')}</div><p class="note">选择后只演示预约意向确认，不创建真实预约。</p></main>`;}
function render(){
  const map={welcome,setup,meet,home,path,reader,pack,expression,memory:memoryPage,finish,library,album,parent,plans,mentor};
  const mainTab=MAIN_TABS.includes(state.screen),world=mainTab||state.screen==='path';
  const oldShell=app.querySelector('.app-shell'),oldScreen=oldShell?.dataset.worldScreen;
  const oldScroller=oldShell?.querySelector('.collection-scroll');
  if(oldScroller&&Object.hasOwn(collectionScroll,oldScreen))collectionScroll[oldScreen]=oldScroller.scrollTop;
  const reuse=mainTab&&MAIN_TABS.includes(oldScreen)&&oldShell?.classList.contains('world-shell');
  const renderPage=map[state.screen]||home;
  const childNav=state.setupDone&&!['setup','meet','welcome','parent','plans','mentor','home','path','library','album'].includes(state.screen);
  document.body.classList.toggle('has-milo-nav',mainTab||childNav);
  if(reuse){
    if(oldScreen!==state.screen){const template=document.createElement('template');template.innerHTML=renderPage();const main=template.content.firstElementChild;main.classList.add('world-view-enter');oldShell.querySelector('main').replaceWith(main);}
    oldShell.dataset.worldScreen=state.screen;
    const sound=oldShell.querySelector('.world-topbar [data-action="sound"]');
    const soundLabel=state.settings.sound?'关闭声音':'打开声音';
    if(sound.getAttribute('aria-label')!==soundLabel){sound.setAttribute('aria-label',soundLabel);sound.innerHTML=icon(state.settings.sound?'volume':'volume-off');}
    oldShell.querySelectorAll('.world-nav-item').forEach(button=>{const active=button.dataset.screen===state.screen;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    if(!oldShell.querySelector('.heart-reward')&&rewardMarkup())oldShell.insertAdjacentHTML('beforeend',rewardMarkup());
  }else{
    app.innerHTML=`<div class="demo-bar"><span class="demo-label"><span class="demo-dot"></span>学习体验版 <span class="detail">· 进度保存在本机</span></span><div class="demo-actions">${embeddedPreview?'':`<a href="${previewHref}" target="_top">缩放调试</a>`}<button data-action="demo-info">体验说明</button><button data-action="reset">重新体验</button></div></div><div class="app-shell ${world?'world-shell':''} ${getAgeBand(state.profile.age)==='young'?'young':''}" ${world?`data-world-screen="${state.screen}"`:''}>${world?worldTopbar():header()+routeBar()}${renderPage()}<div id="audio-state" class="audio-state" aria-live="polite"></div>${mainTab?worldNav():childNav?nav():''}${rewardMarkup()}</div>`;
  }
  if(Object.hasOwn(collectionScroll,state.screen)){const scroller=app.querySelector('.collection-scroll');if(scroller)scroller.scrollTop=collectionScroll[state.screen];}
  if(state.screen==='path')requestAnimationFrame(()=>{
    const target=document.querySelector(`.unit-node[data-unit="${quickUnit().id}"]`),scroller=document.querySelector('#unit-map');
    if(target&&scroller)scroller.scrollLeft=quickUnit().order<=2?0:Math.max(0,target.offsetLeft-scroller.clientWidth*.2);
  });
}
function openHelp(){const t=trial();modal('我们一步一步来',`<p>先再听一次，或者让 Milo 用更简单的方法帮忙。</p><div class="help-choices">${btn('再听一遍请求','help-replay','secondary','volume')}${btn('给我一个小提示','help-hint','quiet','help-circle')}${btn('把选择变少一点','help-reduce','quiet','basket')}${btn('Milo 示范，我们一起完成','help-demo','quiet','check')}</div><p class="dialog-note">提供的帮助会记录下来；你仍然可以继续故事。</p>`);}
function applyHelp(level){const t=trial();state.pack.hints[t.id]=Math.max(level,state.pack.hints[t.id]||0);state.helpEvents.push({type:'pack',trialId:t.id,level,ts:Date.now()});save();closeDialog();feedback={correct:false,message:level>=3?(t.demoZh||`Milo 会选${food(t.target).labelZh}，我们一起试试。`):t.hintZh};render();say(level>=3?t.demoAudioKey:t.hintAudioKey,{text:level>=3?(t.demoZh||t.hintZh):t.hintZh});}
function chooseFood(id,source='click'){
  if((state.pack.done&&!state.pack.review)||feedback?.correct)return;const t=trial();const correct=id===t.target;
  state.pack.events.push({trialId:t.id,target:t.target,question:t.question,choice:id,correct,hintLevel:state.pack.hints[t.id]||0,replays:state.pack.replays[t.id]||0,source,ts:Date.now()});
  if(correct){reward(`pack-${t.target}`,HEART_RULES.request);state.pack.resolved??={};state.pack.resolved[t.id]=true;if(!state.pack.items.includes(id))state.pack.items.push(id);feedback={correct:true,message:`${food(id).label}! 准备好啦。`};save();render();say(`food_${id}`,{text:food(id).label,lang:'en-US'});}
  else{feedback={correct:false,message:'这次先不放。再听听 Milo 想带什么，也可以请他帮忙。'};save();render();say('tryAgain',{text:'再听一次吧，也可以点帮帮我。'});}
}
async function startRecording(){
  if(!state.expression.selectedFood||recording||recordingPending)return;stopSound();
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('这个浏览器暂不能录音。可以点选继续，也可以换 Chrome 试试。');return;}
  const generation=++recordGeneration;recordingPending=true;render();
  let ownStream=null, ownRecorder=null;
  try{
    ownStream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(generation!==recordGeneration||state.screen!=='expression'||!recordingPending){ownStream.getTracks().forEach(t=>t.stop());return;}
    stream=ownStream;const chunks=[];const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    ownRecorder=new MediaRecorder(ownStream,mime?{mimeType:mime}:undefined);recorder=ownRecorder;
    ownRecorder.ondataavailable=ev=>{if(ev.data.size)chunks.push(ev.data);};
    ownRecorder.onstop=()=>{
      ownStream.getTracks().forEach(t=>t.stop());
      if(generation!==recordGeneration)return;
      clearTimeout(recordTimer);if(stream===ownStream)stream=null;if(recorder===ownRecorder)recorder=null;
      recording=false;recordingPending=false;
      if(chunks.length){if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=URL.createObjectURL(new Blob(chunks,{type:ownRecorder.mimeType||'audio/webm'}));state.expression.recorded=true;state.expression.mode='recording';save();}
      if(state.screen==='expression')render();
    };
    ownRecorder.start();recording=true;recordingPending=false;render();recordTimer=setTimeout(stopRecording,20000);
  }catch(error){
    ownStream?.getTracks().forEach(t=>t.stop());
    if(generation!==recordGeneration)return;
    if(stream===ownStream)stream=null;if(recorder===ownRecorder)recorder=null;
    recordingPending=false;recording=false;render();toast('没有开启麦克风，也可以选择食物继续冒险。');
  }
}
function stopRecording(){
  clearTimeout(recordTimer);
  if(recordingPending&&!recording){recordGeneration++;recordingPending=false;return;}
  const activeRecorder=recorder, activeStream=stream;
  if(activeRecorder?.state==='recording'){recording=false;activeRecorder.stop();}
  else{activeStream?.getTracks().forEach(t=>t.stop());if(stream===activeStream)stream=null;recording=false;recordingPending=false;}
}
function completeExpression(){if(!state.expression.selectedFood)return;reward('expression',HEART_RULES.expression);state.expression.done=true;if(!state.expression.recorded)state.expression.mode='selection';save();go('memory');}

async function action(name,el){
  if(name==='world-settings')return modal('Milo 的小设置',`<p>想再听听声音，或者把本次表现交给家长看看？</p><div class="help-choices">${btn('试听与调整中文声音','voice-settings','secondary','volume')}${btn('交给家长查看','parent-gate','quiet','users')}${btn('了解小心心','heart-info','quiet','heart')}</div>`,btn('回到 Milo 的家','close-dialog','primary'));
  if(name==='heart-info')return modal('我们一起收集的小心心',`<p>和 Milo 一起听故事、完成帮忙、表达选择，就能获得小心心。</p><p>已经一起收集了 <strong>${totalHearts(state)}</strong> 颗，Milo 的开心值是 <strong>${happinessValue(state)}/100</strong>。</p><p>需要提示也没关系，只选择、不录音也一样。休息后再回来，Milo 还是会开心地欢迎你。</p>`,btn('继续和 Milo 探索','close-dialog','primary','heart'));
  if(name==='unit-open')return openUnit(el.dataset.unit);
  if(name==='unit-start')return beginUnit(el.dataset.unit);
  if(name==='unit-replay'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);state.reader.page=0;return go('reader');}
  if(name==='unit-activity'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);const p=progress();if(el.dataset.screen==='pack'&&!p.readerDone||el.dataset.screen==='expression'&&!p.packDone||el.dataset.screen==='memory'&&!p.expressionDone)return;return go(el.dataset.screen);}
  if(name==='unit-recap'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);returnAfterParent='home';return go('parent',false);}
  if(name==='map-left'||name==='map-right'){const node=document.querySelector('#unit-map');node?.scrollBy({left:node.clientWidth*.75*(name==='map-left'?-1:1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  if(name==='go')return go(el.dataset.screen);
  if(name==='close-dialog')return closeDialog();
  if(name==='setup')return go('setup',false);
  if(name==='age'){state.profile.age=Number(el.dataset.value);save();render();return;}
  if(name==='level'){state.profile.level=el.dataset.value;save();render();return;}
  if(name==='setup-finish'){state.profile.name=document.querySelector('#child-name')?.value.trim()||'小探险家';state.setupDone=true;save();return go('meet');}
  if(name==='voice-settings')return openVoiceSettings();
  if(name==='guide-voice'){state.settings.guideVoice=el.dataset.value==='legacy'?'legacy':'neural';save();if(state.screen==='parent')render();return openVoiceSettings();}
  if(name==='voice-preview-new')return say('meet',{guideVoice:'neural',preview:true});
  if(name==='voice-preview-old')return say('meet',{guideVoice:'legacy',preview:true});
  if(name==='test-sound')return say('meet',{preview:true});
  if(name==='intro-greet')return say('welcome',{text:'你好，我是你的故事伙伴 Milo。我们一起去野餐吧。'});
  if(name==='greet')return say(quickUnit().id==='breakfast'?'breakfast_home':'home');
  if(name==='meet-finish')return go('home');
  if(name==='home')return go('home');
  if(name==='path')return go('path',false);
  if(name==='album')return go('album',false);
  if(name==='plans')return go('plans',false);
  if(name==='mentor')return go('mentor',false);
  if(name==='start')return beginUnit(quickUnit().id);
  if(name==='path-step')return go(el.dataset.screen);
  if(name==='book-open'){if(el.dataset.unit&&!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);if(state.reader.done||state.completedAt)state.reader.page=0;return go('reader');}
  if(name==='reader-listen'){const p=storyPages()[state.reader.page];return say(p.audioKey||`story_${p.id}`,{text:p.english,lang:'en-US',page:state.reader.page});}
  if(name==='reader-guide'){const p=storyPages()[state.reader.page];state.helpEvents.push({type:'reader',page:state.reader.page,level:1,ts:Date.now()});save();return say(p.guideAudioKey||`story_guide_${p.id}`,{text:p.guideZh});}
  if(name==='reader-prev'){state.reader.page=Math.max(0,state.reader.page-1);save();render();return autoVoice();}
  if(name==='reader-next'){if(!state.reader.pagesFinished.includes(state.reader.page))state.reader.pagesFinished.push(state.reader.page);reward(`reader-page-${state.reader.page}`,HEART_RULES.readerPage);if(state.reader.page<storyPages().length-1){state.reader.page++;save();render();return autoVoice();}state.reader.done=true;save();if(state.completedAt)return go('home');return go(state.pack.done?nextActivity():'pack');}
  if(name==='pack-choice')return chooseFood(el.dataset.food);
  if(name==='pack-replay'||name==='help-replay'){const t=trial();state.pack.replays[t.id]=(state.pack.replays[t.id]||0)+1;save();closeDialog();return say(t.audioKey||`trial_${state.profile.level}_${t.target}`,{text:t.question,lang:'en-US'});}
  if(name==='help')return openHelp();
  if(name==='help-hint')return applyHelp(1);
  if(name==='help-reduce')return applyHelp(2);
  if(name==='help-demo')return applyHelp(3);
  if(name==='pack-next'){feedback=null;if(state.pack.trialIndex<trials().length-1){state.pack.trialIndex++;save();render();return autoVoice();}state.pack.done=true;state.pack.review=false;save();render();return say('packDone',{text:'我们的篮子装好啦。接下来轮到你来选择。'});}
  if(name==='go-expression')return go('expression');
  if(name==='pack-done-greet')return say('packDone',{text:'谢谢你帮忙准备好食物，接下来轮到你来选。'});
  if(name==='pack-review'){state.pack.review=true;state.pack.resolved={};state.pack.trialIndex=0;save();return go('pack');}
  if(name==='expression-choice'){state.expression.selectedFood=el.dataset.food;if(!state.expression.recorded)state.expression.mode='selection';save();render();return say(`food_${el.dataset.food}`,{text:food(el.dataset.food).label,lang:'en-US'});}
  if(name==='expression-sample'){state.expression.samplePlayed=true;state.helpEvents.push({type:'expression',level:3,ts:Date.now()});save();const id=state.expression.selectedFood;const sample=sampleFor(id);return say(sample.audioKey,{text:sample.text,lang:'en-US'});}
  if(name==='record-start')return startRecording();
  if(name==='record-stop')return stopRecording();
  if(name==='expression-finish')return completeExpression();
  if(name==='memory-greet')return say('memory',{text:'我们的野餐准备好了。谢谢你陪我一起完成。'});
  if(name==='finish-greet')return say('finish',{text:'今天的冒险完成啦。我们下次再见。'});
  if(name==='complete-day'){if(!state.reader.done||!state.pack.done||!state.expression.done)return toast('先把前面的活动一起完成吧。');reward('memory',HEART_RULES.memory);state.completedAt=state.completedAt||new Date().toISOString();state.lastActivity=null;save();return go('finish');}
  if(name==='pause')return modal('稍后继续，也没关系',`<p>已经保存当前单元的位置。回来时，从刚才的活动接着开始。</p>`,btn('回到今天','pause-home','primary','home')+btn('继续当前活动','close-dialog','quiet','arrow-right'));
  if(name==='pause-home')return go('home',false);
  if(name==='back')return go(MAIN_TABS.includes(state.navigation.mainTab)?state.navigation.mainTab:'home',false);
  if(name==='parent-gate'){returnAfterParent=['parent','plans','mentor'].includes(state.screen)?'home':state.screen;return modal('请家长来看看',`<p>这里可以查看本次表现、调整安排和了解后续方案。</p>`,btn('家长查看','parent-enter','primary','users')+btn('回到孩子模式','close-dialog','quiet'));}
  if(name==='parent-enter')return go('parent',false);
  if(name==='parent-back')return go(state.screen==='parent'?returnAfterParent:'parent',false);
  if(name==='select-family')return modal('已体验方案选择',`<p>你选择了家庭内容订阅。这只是流程演示，没有发生扣费或开通订阅。</p>`,btn('返回权益页','close-dialog','primary'));
  if(name==='slot')return modal('预约意向已演示',`<p>偏好时段：${e(el.dataset.value)}。正式服务会在家长确认老师、时间和权益后预约。本次没有创建真实预约。</p>`,btn('回家长中心','parent-enter','primary','arrow-right'));
  if(name==='sound'){state.settings.sound=!state.settings.sound;save();stopSound();render();toast(state.settings.sound?'声音已打开':'声音已关闭，仍可继续点选');return;}
  if(name==='tutorial-help')return modal('遇到困难，Milo 可以帮忙',`<p>先听一遍，再跟着示范做。你可以随时重听、减少选项，或者和伙伴一起完成。</p>`,btn('我知道了','close-dialog','primary','check'));
  if(name==='demo-info')return modal('这是一份流程体验版',`<p>从家长设置到首日完成都可以实际操作。阅读、点选、帮助、保存和反馈使用本次真实记录。</p><p>中文引导已换为晓晓女声，可在家长设置中试听对比。音频随本地文件播放。录音仅供本次窗口回放；没有语音识别、大语言模型或自动口语评分。支付、家长身份验证和导师预约均为流程演示。</p><p>年龄影响操作方式，英语起点影响请求语言。重新体验可以更换配置。</p>`,btn('继续体验','close-dialog','primary'));
  if(name==='reset')return modal('重新开始一次体验？',`<p>这会清除当前浏览器里本 Demo 的档案、活动进度和记录，回到首次启动。</p>`,btn('保留，继续体验','close-dialog','quiet')+btn('清除并重新开始','reset-confirm','primary','refresh'));
  if(name==='reset-confirm'){recordGeneration++;stopRecording();stopSound();heartNotice=null;clearTimeout(heartNoticeTimer);if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=null;state=freshState();save();return go('welcome',false);}
  if(name==='export'){const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),state,evidence:buildEvidence(state)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='milo-first-day-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
}

document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el||el.disabled)return;if(el.dataset.action==='pack-choice'&&performance.now()<suppressFoodClickUntil)return;if(el.dataset.action==='unit-open'&&performance.now()<suppressMapClickUntil)return;action(el.dataset.action,el).catch(error=>{console.error(error);toast('这一步暂时没有完成，进度已保留，可以重试。');});});
document.addEventListener('input',ev=>{if(ev.target.id==='child-name'){state.profile.name=ev.target.value;save();}});
let dragGesture=null, suppressFoodClickUntil=0;
let mapGesture=null,suppressMapClickUntil=0;
document.addEventListener('pointerdown',ev=>{
  const node=ev.target.closest('#unit-map');if(!node||ev.pointerType!=='mouse'||ev.button!==0)return;
  mapGesture={node,id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:node.scrollLeft,moved:false};
});
document.addEventListener('pointermove',ev=>{
  const g=mapGesture;if(!g||g.id!==ev.pointerId)return;const dx=ev.clientX-g.x,dy=ev.clientY-g.y;
  if(!g.moved&&Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)){g.moved=true;g.node.classList.add('map-dragging');g.node.setPointerCapture?.(ev.pointerId);}
  if(g.moved){g.node.scrollLeft=g.left-dx;ev.preventDefault();}
});
function endMapGesture(){if(mapGesture?.moved)suppressMapClickUntil=performance.now()+350;mapGesture?.node.classList.remove('map-dragging');mapGesture=null;}
document.addEventListener('pointerup',endMapGesture);
document.addEventListener('pointercancel',endMapGesture);
document.addEventListener('wheel',ev=>{
  const node=ev.target.closest('#unit-map');if(!node||node.scrollWidth<=node.clientWidth+1||node.scrollHeight>node.clientHeight+2||Math.abs(ev.deltaX)>=Math.abs(ev.deltaY))return;
  const before=node.scrollLeft;node.scrollLeft+=ev.deltaY;if(node.scrollLeft!==before)ev.preventDefault();
},{passive:false});
document.addEventListener('pointerdown',ev=>{
  const el=ev.target.closest('[data-draggable="true"]');if(!el||ev.button!==0)return;
  dragGesture={id:ev.pointerId,food:el.dataset.food,x:ev.clientX,y:ev.clientY,moved:false,el};
  el.setPointerCapture?.(ev.pointerId);
});
document.addEventListener('pointermove',ev=>{
  const g=dragGesture;if(!g||g.id!==ev.pointerId)return;
  if(Math.hypot(ev.clientX-g.x,ev.clientY-g.y)>8)g.moved=true;
  if(g.moved){g.el.classList.add('dragging');const zone=document.querySelector('#basket-zone');
    if(zone){const r=zone.getBoundingClientRect();zone.classList.toggle('drag-over',ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom);}}
});
document.addEventListener('pointerup',ev=>{
  const g=dragGesture;if(!g||g.id!==ev.pointerId)return;dragGesture=null;g.el.classList.remove('dragging');
  const zone=document.querySelector('#basket-zone');zone?.classList.remove('drag-over');
  if(g.moved){suppressFoodClickUntil=performance.now()+350;const r=zone?.getBoundingClientRect();
    if(r&&ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom)chooseFood(g.food,'drag');}
});
document.addEventListener('pointercancel',()=>{dragGesture?.el.classList.remove('dragging');dragGesture=null;document.querySelector('#basket-zone')?.classList.remove('drag-over');});
window.addEventListener('pagehide',()=>{save();stopRecording();stopSound();});
dialog.addEventListener('cancel',stopSound);
dialog.addEventListener('click',ev=>{if(ev.target===dialog&&ev.clientX<dialog.getBoundingClientRect().left)closeDialog();});
save();render();
