from pathlib import Path

base=Path('/Users/zyb/Documents/Codex/2026-11-02/yin/outputs/first-day-demo')
p=base/'app.js'
s=p.read_text()
(p.parent.parent.parent/'work/tab-before-app.js').write_text(s)

def replace_function(name,code):
    global s
    start=s.index('function '+name+'(')
    end=s.index('\nfunction ',start+1)
    s=s[:start]+code.strip()+s[end:]

s=s.replace("const STORAGE_SUFFIX =", "const MAIN_TABS=['library','home','album'];\nconst collectionScroll={library:0,album:0};\nconst STORAGE_SUFFIX =",1)
s=s.replace("state.version=2;", "state.version=2;\nstate.navigation??={mainTab:MAIN_TABS.includes(state.screen)?state.screen:'home'};")
s=s.replace("activeUnitId:'picnic',unitRecords:{},relationship:{rewards:{}},", "activeUnitId:'picnic',unitRecords:{},relationship:{rewards:{}},navigation:{mainTab:'home'},")
s=s.replace("  state.screen=valid.includes(screen)?screen:'home';", "  state.screen=valid.includes(screen)?screen:'home';\n  if(MAIN_TABS.includes(state.screen))state.navigation.mainTab=state.screen;")

replace_function('worldNav',r'''
function worldNav(lesson=false){const selected=MAIN_TABS.includes(state.screen)?state.screen:state.navigation.mainTab;return `<nav class="world-nav ${lesson?'lesson-nav':''}" aria-label="儿童主导航">${[['library','book','书架'],['home','home','今天'],['album','map','旅行册']].map(([route,ico,label])=>`<button class="world-nav-item ${route===selected?'active':''}" data-action="go" data-screen="${route}" ${route===selected?'aria-current="page"':''}>${icon(ico)}<span>${label}</span></button>`).join('')}</nav>`;}
''')
replace_function('nav',"function nav(){return worldNav(true);}")
s=s.replace('${worldNav()}</main>','</main>')

replace_function('library',r'''
function library(){const units=UNITS.filter(unit=>unit.available);return `<main class="world-collection world-library" aria-label="Milo 的书架"><div class="collection-inner"><header class="collection-heading"><div class="collection-hello"><img src="./assets/art/milo-companion.png" alt="" aria-hidden="true"><div><span class="collection-eyebrow">STORIES WITH MILO</span><h1 tabindex="-1">我的小书架</h1><p>喜欢的故事，想听就再听一遍。</p></div></div><span class="collection-count">${icon('book')}${units.length} 本故事</span></header><div class="collection-scroll" tabindex="0" aria-label="故事书架"><div class="story-shelf">${units.map(unit=>{const record=unitRecord(state,unit.id),done=isUnitDone(unit.id),unlocked=isUnitUnlocked(unit.id);const seen=new Set(record?.reader?.pagesSeen||[]).size;const label=done?'已经完成，随时重读':unlocked?seen?'接着听这个故事':'和 Milo 一起听故事':'完成前一个故事后开启';return `<button class="story-card ${done?'story-completed':unlocked?'story-ready':'story-locked'}" data-action="book-open" data-unit="${unit.id}" aria-label="${e(unit.title)}，${label}"><span class="story-cover ${unit.id==='breakfast'?'cover-lavender':'cover-mint'}"><span class="story-cover-title">${e(unit.titleEn)}</span><img class="story-cover-milo" src="./assets/art/milo-companion.png" alt=""><span class="story-cover-foods">${unit.foods.map(id=>foodArt(id)).join('')}</span><span class="story-cover-number">${String(unit.order).padStart(2,'0')}</span></span><span class="story-card-copy"><strong>${e(unit.title)}</strong><small>${e(unit.subtitle)}</small><span class="story-reading-info">${icon('headphones')}4 页短故事${seen?` · 看过 ${seen} 页`:''}</span><span class="story-card-footer"><span class="story-status">${icon(done?'check':unlocked?'player-play':'lock')}${label}</span><span class="story-arrow">${icon('arrow-right')}</span></span></span></button>`;}).join('')}</div><p class="collection-hint">可以慢慢听，也可以回到喜欢的那一页。</p></div></div></main>`;}
''')
replace_function('album',r'''
function album(){const done=UNITS.filter(unit=>unit.available&&isUnitDone(unit.id));return `<main class="world-collection world-album" aria-label="和 Milo 的旅行册"><div class="collection-inner"><header class="collection-heading"><div class="collection-hello"><img src="./assets/art/milo-companion.png" alt="" aria-hidden="true"><div><span class="collection-eyebrow">OUR LITTLE MEMORIES</span><h1 tabindex="-1">我们的旅行册</h1><p>把一起经历过的故事，好好收起来。</p></div></div><span class="collection-count">${icon('map')}${done.length} 张旅行页</span></header><div class="collection-scroll" tabindex="0" aria-label="共同旅行页">${done.length?`<div class="memory-collection">${done.map((unit,index)=>{const record=unitRecord(state,unit.id);const chosen=record.expression.selectedFood;return `<article class="memory-card"><div class="memory-scene ${unit.id==='breakfast'?'memory-lavender':'memory-peach'}"><span class="memory-scene-tag">OUR ADVENTURE ${String(index+1).padStart(2,'0')}</span><img src="./assets/art/milo-companion.png" alt="与你一起完成故事的 Milo"><div class="memory-keepsakes">${[...new Set([...record.pack.items,chosen].filter(Boolean))].map(id=>`<span class="memory-keepsake ${id===chosen?'chosen':''}">${foodArt(id)}<small>${e(food(id).labelZh)}</small></span>`).join('')}</div></div><div class="memory-card-copy"><span class="memory-complete">${icon('check')}一起完成的故事</span><h2>${e(unit.memoryTitle)}</h2><p>${e(state.profile.name)} & Milo${chosen?` · 你选了${e(food(chosen).labelZh)}`:''}</p><div class="memory-actions">${btn('再读一次','book-open','secondary','book',`data-unit="${unit.id}"`)}${btn('家长回顾','unit-recap','quiet','users',`data-unit="${unit.id}"`)}</div></div></article>`;}).join('')}</div><p class="collection-hint">每一页，都来自你和 Milo 真实完成的共同冒险。</p>`:`<section class="album-empty"><img src="./assets/art/milo-companion.png" alt="等待和你一起完成故事的 Milo"><div class="album-empty-copy"><span class="collection-eyebrow">OUR FIRST MEMORY</span><h2>第一张旅行页，<br>等你一起完成。</h2><p>听个故事，帮忙做准备，<br>再告诉 Milo 你的选择。</p>${btn('继续今天的故事','start','primary collection-start','player-play')}</div></section>`}</div></div></main>`;}
''')

replace_function('render',r'''
function render(){
  const map={welcome,setup,meet,home,path,reader,pack,expression,memory:memoryPage,finish,library,album,parent,plans,mentor};
  const mainTab=MAIN_TABS.includes(state.screen),world=mainTab||state.screen==='path';
  const oldShell=app.querySelector('.app-shell'),oldScreen=oldShell?.dataset.worldScreen;
  const oldScroller=oldShell?.querySelector('.collection-scroll');
  if(oldScroller&&Object.hasOwn(collectionScroll,oldScreen))collectionScroll[oldScreen]=oldScroller.scrollTop;
  const reuse=mainTab&&MAIN_TABS.includes(oldScreen)&&oldShell?.classList.contains('world-shell');
  const renderPage=map[state.screen]||home;
  const childNav=state.setupDone&&!['setup','meet','welcome','parent','plans','mentor','home','path','library','album'].includes(state.screen);
  if(reuse){
    if(oldScreen!==state.screen){const template=document.createElement('template');template.innerHTML=renderPage();const main=template.content.firstElementChild;main.classList.add('world-view-enter');oldShell.querySelector('main').replaceWith(main);}
    oldShell.dataset.worldScreen=state.screen;
    const sound=oldShell.querySelector('.world-topbar [data-action="sound"]');
    const soundLabel=state.settings.sound?'关闭声音':'打开声音';
    if(sound.getAttribute('aria-label')!==soundLabel){sound.setAttribute('aria-label',soundLabel);sound.innerHTML=icon(state.settings.sound?'volume':'volume-off');}
    oldShell.querySelectorAll('.world-nav-item').forEach(button=>{const active=button.dataset.screen===state.screen;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
    oldShell.querySelector('.heart-reward')?.remove();if(rewardMarkup())oldShell.insertAdjacentHTML('beforeend',rewardMarkup());
  }else{
    app.innerHTML=`<div class="demo-bar"><span class="demo-label"><span class="demo-dot"></span>学习体验版 <span class="detail">· 进度保存在本机</span></span><div class="demo-actions">${embeddedPreview?'':`<a href="${previewHref}" target="_top">缩放调试</a>`}<button data-action="demo-info">体验说明</button><button data-action="reset">重新体验</button></div></div><div class="app-shell ${world?'world-shell':''} ${getAgeBand(state.profile.age)==='young'?'young':''}" ${world?`data-world-screen="${state.screen}"`:''}>${world?worldTopbar():header()+routeBar()}${renderPage()}<div id="audio-state" class="audio-state" aria-live="polite"></div>${mainTab?worldNav():childNav?nav():''}${rewardMarkup()}</div>`;
  }
  if(Object.hasOwn(collectionScroll,state.screen)){const scroller=app.querySelector('.collection-scroll');if(scroller)scroller.scrollTop=collectionScroll[state.screen];}
  if(state.screen==='path')requestAnimationFrame(()=>{
    const target=document.querySelector(`.unit-node[data-unit="${quickUnit().id}"]`),scroller=document.querySelector('#unit-map');
    if(target&&scroller)scroller.scrollLeft=quickUnit().order<=2?0:Math.max(0,target.offsetLeft-scroller.clientWidth*.2);
  });
}
''')
p.write_text(s)
