from pathlib import Path

root=Path('/Users/zyb/Documents/Codex/2026-11-02/yin/outputs/first-day-demo')
p=root/'app.js'
s=p.read_text()

def replace_function(name, code):
    global s
    start=s.index('function '+name+'(')
    end=s.index('\nfunction ',start+1)
    s=s[:start]+code.strip()+s[end:]

helpers=r'''
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
function beginUnit(id){if(!selectUnit(id))return openUnit(id);return go(isUnitDone(id)?'reader':nextActivity());}
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
function worldNav(){return `<nav class="world-nav" aria-label="儿童主导航">${[['library','book','书架'],['home','home','今天'],['album','map','旅行册']].map(([route,ico,label])=>`<button class="world-nav-item ${route==='home'?'active':''}" data-action="go" data-screen="${route}" ${route==='home'?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;}
'''
s=s.replace('\nfunction header(){','\n'+helpers+'\nfunction header(){',1)

replace_function('header',r'''
function header(){return `<header class="app-header"><div class="brand"><span class="brand-mark">${icon('book')}</span><span>Milo<small>ENGLISH ADVENTURES</small></span></div>${state.setupDone?`<button class="lesson-hearts" data-action="heart-info" aria-label="Milo开心值 ${happinessValue(state)}">${icon('heart')}${happinessValue(state)}</button>`:''}<div class="header-tools"><button class="icon-button" data-action="sound" aria-label="${state.settings.sound?'关闭声音':'打开声音'}">${icon(state.settings.sound?'volume':'volume-off')}</button>${state.setupDone?`<button class="parent-button" data-action="parent-gate">${icon('users')}家长</button>`:''}</div></header>`;}
''')

replace_function('home',r'''
function home(){
  const unit=quickUnit(),record=unitRecord(state,unit.id);const completed=isUnitDone(unit.id);const started=Boolean(record?.reader?.pagesSeen?.length||record?.lastActivity);
  const title=completed?'再和我读一次吧':started?`接着${unit.title}吧`:`我们去${unit.title==='早餐小帮手'?'准备早餐':'准备野餐'}吧`;
  return `<main class="world-home" aria-label="Milo 的家"><h1 class="world-sr-only" tabindex="-1">Milo 的家</h1><button class="home-companion" data-action="greet" aria-label="和 Milo 打个招呼"><img class="milo-art" src="./assets/art/milo-companion.png" alt="正在向你挥手的 Milo"></button><button class="milo-bubble" data-action="${completed?'unit-replay':'unit-start'}" data-unit="${unit.id}" aria-label="${completed?'重读':started?'继续':'开始'}${e(unit.title)}"><span class="bubble-eyebrow">MILO 想和你一起</span><strong>${e(title)}</strong><small>${completed?'熟悉的故事，也有新的发现':`${started?'继续当前单元':'开始新单元'} · ${e(unit.title)}`}</small><span class="bubble-play">${icon('player-play')}</span></button><div class="world-brand">Milo<small>YOUR LITTLE STORY COMPANION</small></div><button class="map-launch" data-action="path" aria-label="打开学习地图"><img class="rocket-art" src="./assets/art/rocket-map.png" alt="小火箭"><span class="map-launch-label"><strong>学习地图</strong><small>去看看下一段冒险</small></span></button>${worldNav()}</main>`;
}
''')
replace_function('path',r'''
function path(){
  const open=UNITS.filter(unit=>unit.available).length;
  return `<main class="world-map" aria-label="学习地图"><section class="map-companion"><img class="milo-art" src="./assets/art/milo-companion.png" alt="Milo 陪你一起探索"><div class="map-companion-copy"><h1 tabindex="-1">下一段冒险，<br>我们一起出发。</h1><p>一块六边形，就是一个完整单元。<br>向右滑动，看看更多故事。</p></div></section><section class="map-region"><div class="map-heading"><div><h2>我们的学习地图</h2><p>听故事，帮帮忙，再说说自己的选择。</p></div><span class="pill">${open} 个故事已开放</span></div><div class="map-scroll" id="unit-map" tabindex="0" aria-label="横向学习单元地图，可向右滑动"><div class="hex-path">${UNITS.map((unit,index)=>{const done=isUnitDone(unit.id),unlocked=isUnitUnlocked(unit.id),record=unitRecord(state,unit.id),p=getProgress(record||{});const count=[p.readerDone,p.packDone,p.expressionDone,p.completed].filter(Boolean).length;const status=done?'已完成 · 可以回看':!unit.available?'筹备中':unlocked?'从这里继续':'完成上一单元解锁';return `<button class="unit-node ${done?'completed':unlocked?'current':'locked'}" data-action="unit-open" data-unit="${unit.id}" data-index="${index}" aria-label="单元 ${index+1}，${e(unit.title)}，${status}"><span class="unit-number">UNIT ${String(index+1).padStart(2,'0')}</span><span class="unit-hex"><span class="unit-icon">${icon(unit.icon)}</span></span><span class="unit-label"><strong>${e(unit.title)}</strong><small>${e(unit.titleEn)}</small></span>${unit.available?`<span class="unit-mini-progress" aria-label="已完成${count}个环节，共4个">${[0,1,2,3].map(i=>`<i class="${i<count?'filled':''}"></i>`).join('')}</span>`:''}<span class="unit-state">${icon(done?'check':unlocked?'player-play':'lock')}${status}</span></button>`;}).join('')}</div></div><div class="map-paging"><span class="map-position">向右滑动探索 · 每块都是一个完整单元</span><button class="map-arrow" data-action="map-left" aria-label="向左查看地图">${icon('arrow-left')}</button><button class="map-arrow" data-action="map-right" aria-label="向右查看更多单元">${icon('arrow-right')}</button></div></section></main>`;
}
''')

replace_function('render',r'''
function render(){
  const map={welcome,setup,meet,home,path,reader,pack,expression,memory:memoryPage,finish,library,album,parent,plans,mentor};
  const world=['home','path'].includes(state.screen);
  const renderPage=map[state.screen]||home;
  const childNav=state.setupDone&&!['setup','meet','welcome','parent','plans','mentor','home','path'].includes(state.screen);
  app.innerHTML=`<div class="demo-bar"><span class="demo-label"><span class="demo-dot"></span>学习体验版 <span class="detail">· 进度保存在本机</span></span><div class="demo-actions">${embeddedPreview?'':`<a href="${previewHref}" target="_top">缩放调试</a>`}<button data-action="demo-info">体验说明</button><button data-action="reset">重新体验</button></div></div><div class="app-shell ${world?'world-shell':''} ${getAgeBand(state.profile.age)==='young'?'young':''}">${world?worldTopbar():header()+routeBar()}${renderPage()}<div id="audio-state" class="audio-state" aria-live="polite"></div>${childNav?nav():''}${rewardMarkup()}</div>`;
  if(state.screen==='path')requestAnimationFrame(()=>{
    const target=document.querySelector(`.unit-node[data-unit="${quickUnit().id}"]`),scroller=document.querySelector('#unit-map');
    if(target&&scroller)scroller.scrollLeft=Math.max(0,target.offsetLeft-scroller.clientWidth*.2);
  });
}
''')

# Scope all reusable narration to the active unit, while preserving English keys.
s=s.replace("  const line=SPEECH_LINES[key];", "  key=unitVoice(key);\n  const line=SPEECH_LINES[key];")
s=s.replace("const sample=selected==='milk'?'Milk, please.':selected==='banana'?'A banana, please.':'An apple, please.';const sampleZh=selected==='milk'?'请给我一点牛奶。':selected==='banana'?'请给我一根香蕉。':'请给我一个苹果。';", "const sampleInfo=sampleFor(selected)||sampleFor(currentUnit().foods[0]);const sample=sampleInfo.text;const sampleZh=sampleInfo.textZh;")
s=s.replace("${['apple','banana','milk'].map(id=>foodButton", "${currentUnit().foods.map(id=>foodButton")
s=s.replace("const text=id==='milk'?'Milk, please.':id==='banana'?'A banana, please.':'An apple, please.';return say(`sample_${id}`,{text,lang:'en-US'});", "const sample=sampleFor(id);return say(sample.audioKey,{text:sample.text,lang:'en-US'});")
s=s.replace("if(name==='greet')return say('meet',{text:`你好，${state.profile.name}，我是 Milo。一起去准备野餐吧。`});", "if(name==='greet')return say('home');")
s=s.replace("if(name==='reader-next'){", "if(name==='reader-next'){if(!state.reader.pagesFinished.includes(state.reader.page))state.reader.pagesFinished.push(state.reader.page);reward(`reader-page-${state.reader.page}`,2);")
s=s.replace("if(correct){state.pack.resolved", "if(correct){reward(`pack-${t.target}`,2);state.pack.resolved")
s=s.replace("function completeExpression(){if(!state.expression.selectedFood)return;state.expression.done=true;", "function completeExpression(){if(!state.expression.selectedFood)return;reward('expression',3);state.expression.done=true;")
s=s.replace("state.completedAt=state.completedAt||new Date().toISOString();state.lastActivity=null;", "reward('memory',3);state.completedAt=state.completedAt||new Date().toISOString();state.lastActivity=null;")
s=s.replace("if(name==='start')return go(nextActivity());", "if(name==='start')return beginUnit(quickUnit().id);")
s=s.replace("if(name==='book-open'){state.reader.page=0;return go('reader');}", "if(name==='book-open'){if(el.dataset.unit&&!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);state.reader.page=0;return go('reader');}")
s=s.replace("  if(name==='go')return", r'''  if(name==='world-settings')return modal('Milo 的小设置',`<p>想再听听声音，或者把本次表现交给家长看看？</p><div class="help-choices">${btn('试听与调整中文声音','voice-settings','secondary','volume')}${btn('交给家长查看','parent-gate','quiet','users')}${btn('了解小心心','heart-info','quiet','heart')}</div>`,btn('回到 Milo 的家','close-dialog','primary'));
  if(name==='heart-info')return modal('我们一起收集的小心心',`<p>和 Milo 一起听故事、完成帮忙、表达选择，就能获得小心心。</p><p>已经一起收集了 <strong>${totalHearts(state)}</strong> 颗，Milo 的开心值是 <strong>${happinessValue(state)}/100</strong>。</p><p>需要提示也没关系，只选择、不录音也一样。休息后再回来，Milo 还是会开心地欢迎你。</p>`,btn('继续和 Milo 探索','close-dialog','primary','heart'));
  if(name==='unit-open')return openUnit(el.dataset.unit);
  if(name==='unit-start')return beginUnit(el.dataset.unit);
  if(name==='unit-replay'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);state.reader.page=0;return go('reader');}
  if(name==='unit-activity'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);const p=progress();if(el.dataset.screen==='pack'&&!p.readerDone||el.dataset.screen==='expression'&&!p.packDone||el.dataset.screen==='memory'&&!p.expressionDone)return;return go(el.dataset.screen);}
  if(name==='unit-recap'){if(!selectUnit(el.dataset.unit))return openUnit(el.dataset.unit);return go('parent',false);}
  if(name==='map-left'||name==='map-right'){const node=document.querySelector('#unit-map');node?.scrollBy({left:node.clientWidth*.75*(name==='map-left'?-1:1),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  if(name==='go')return''')

# Text follows the unit's context. Keep the learning mechanics and evidence intact.
s=s.replace('首日冒险 · 准备野餐', '${e(currentUnit().title)} · 单元 ${currentUnit().order}')
s=s.replace("${getAgeBand(state.profile.age)==='older'?'完成野餐清单':'帮 Milo 装篮子'}", "${getAgeBand(state.profile.age)==='older'?`完成${currentUnit().containerTitle}清单`:e(currentUnit().packTitle)}")
s=s.replace('aria-label="野餐篮，拖入食物"','aria-label="${e(currentUnit().containerTitle)}，拖入食物"')
s=s.replace("${icon('basket')}<strong>野餐篮</strong>", "${icon(currentUnit().containerIcon)}<strong>${e(currentUnit().containerTitle)}</strong>")
s=s.replace('篮子装好了</div>', '${e(currentUnit().completionTitle)}</div>')
s=s.replace('放进篮子啦', '准备好啦')
s=s.replace('还告诉了伙伴自己的选择', '还告诉了伙伴自己的选择')
s=s.replace('我们的第一次野餐', '${e(currentUnit().memoryTitle)}')
s=s.replace('你想带什么去野餐？</h1>', "${state.activeUnitId==='breakfast'?'早餐你想吃什么？':'你想带什么去野餐？'}</h1>")
s=s.replace('scene-title">PICNIC TIME', 'scene-title">${e(currentUnit().titleEn.toUpperCase())}')
s=s.replace('读完了，去装篮子', '${state.activeUnitId===\'breakfast\'?\'读完了，去摆早餐\':\'读完了，去装篮子\'}') if False else s
# This ternary lives inside an existing JavaScript template interpolation.
s=s.replace("state.reader.page===storyPages().length-1?'读完了，去装篮子':'下一页'", "state.reader.page===storyPages().length-1?(state.activeUnitId==='breakfast'?'读完了，去摆早餐':'读完了，去装篮子'):'下一页'")
s=s.replace('第一张共同旅行页已经保存', '这次共同旅行页已经保存')
s=s.replace('我们一起完成的第一场冒险', '我们一起完成的冒险')
s=s.replace('<div class="memory-title">准备野餐</div>', '<div class="memory-title">${e(currentUnit().title)}</div>')
s=s.replace('今天，具体发生了什么', '这个单元，具体发生了什么')
s=s.replace('${e(state.profile.name)} · ${state.profile.age} 岁', '${e(currentUnit().title)} · ${e(state.profile.name)} · ${state.profile.age} 岁')
s=s.replace("${p.completed?'首日已完成':'正在体验'}", "${p.completed?'单元已完成':'正在体验'}")
s=s.replace('<div class="parent-layout"><section>', '<div class="unit-recap-tabs">${UNITS.filter(unit=>unit.available).map(unit=>btn(unit.title,\'unit-recap\',state.activeUnitId===unit.id?\'primary\':\'quiet\',\'\',`data-unit="${unit.id}"`)).join(\'\')}</div><div class="parent-layout"><section>')
s=s.replace('已生成共同旅行页并结束首日主流程', '已生成共同旅行页并结束本单元')
s=s.replace('保存当前的位置', '保存当前单元的位置')

# Album and bookshelf expose the actual units rather than manufacturing progress.
replace_function('library',r'''
function library(){return `<main class="content"><div class="section-head"><div><span class="eyebrow">YOUR BOOKSHELF</span><h1 tabindex="-1">喜欢的故事，可以再读</h1><p class="lede">每一个故事，都有听读、帮忙和自己的选择。</p></div><span class="pill">${UNITS.filter(unit=>unit.available).length} 个原创故事</span></div><div class="book-grid">${UNITS.filter(unit=>unit.available).map(unit=>`<button class="book-card" data-action="book-open" data-unit="${unit.id}"><div class="book-cover">${icon(unit.icon)}${icon(unit.foods[0])}</div><h3>${e(unit.titleEn)}</h3><p>${e(unit.title)}<br>${isUnitDone(unit.id)?'已完成，可以重读':isUnitUnlocked(unit.id)?'4 页短故事 · 可听读':'完成前一单元后开启'}</p></button>`).join('')}</div></main>`;}
''')
replace_function('album',r'''
function album(){const done=UNITS.filter(unit=>unit.available&&isUnitDone(unit.id));if(!done.length)return `<main class="content"><div class="empty-state">${icon('map')}<h1 tabindex="-1">第一张旅行页，等你一起完成</h1><p class="lede">听个故事，帮忙做准备，<br>再告诉伙伴自己的选择。</p>${btn('继续今天的冒险','start','primary','player-play')}</div></main>`;return `<main class="content"><span class="eyebrow">OUR TRAVEL ALBUM</span><h1 tabindex="-1">我们一起经历过</h1><p class="lede">这里收着真实的选择与共同作品。</p><div class="album-grid">${done.map(unit=>{const record=unitRecord(state,unit.id);return `<section class="memory-paper">${robot('small','greet')}<div class="memory-foods">${[...new Set([...record.pack.items,record.expression.selectedFood].filter(Boolean))].map(id=>foodArt(id)).join('')}</div><div class="memory-title">${e(unit.memoryTitle)}</div><div class="memory-caption">${e(state.profile.name)} & Milo</div><div class="button-row center" style="margin-top:1rem">${btn('重读这个故事','book-open','secondary','book',`data-unit="${unit.id}"`)}${btn('看本单元反馈','unit-recap','quiet','users',`data-unit="${unit.id}"`)}</div></section>`;}).join('')}</div></main>`;}
''')

p.write_text(s)
