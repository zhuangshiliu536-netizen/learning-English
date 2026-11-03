import { STORY_PAGES, getPackTrials, getAgeBand } from './content.js';

// Two complete original sample units. Future map tiles are explicitly unavailable.
export const UNITS = [
  {id:'picnic',order:1,title:'准备野餐',titleEn:'Picnic time',subtitle:'带上食物，一起出发',icon:'basket',foods:['apple','banana','milk'],available:true,containerTitle:'野餐篮',containerIcon:'basket',packTitle:'帮 Milo 装篮子',memoryTitle:'我们的第一次野餐',completionTitle:'野餐准备好了'},
  {id:'breakfast',order:2,title:'早餐小帮手',titleEn:'Breakfast together',subtitle:'摆好早餐，分享好心情',icon:'bread',foods:['bread','apple','milk'],available:true,containerTitle:'早餐餐盘',containerIcon:'bread',packTitle:'帮 Milo 摆早餐',memoryTitle:'我们一起准备的早餐',completionTitle:'早餐准备好了'},
  {id:'fruit-shop',order:3,title:'水果小铺',titleEn:'At the fruit shop',subtitle:'新单元筹备中',icon:'apple',foods:[],available:false},
  {id:'garden',order:4,title:'花园发现',titleEn:'Garden discoveries',subtitle:'新单元筹备中',icon:'star',foods:[],available:false},
  {id:'friends',order:5,title:'认识新朋友',titleEn:'Hello, new friends',subtitle:'新单元筹备中',icon:'users',foods:[],available:false},
  {id:'bedtime',order:6,title:'晚安故事',titleEn:'A bedtime story',subtitle:'新单元筹备中',icon:'book',foods:[],available:false},
];

const BREAKFAST_STORY_PAGES = [
  {id:'breakfast-time',titleZh:'早上好，米洛',english:'Good morning, Milo! It is breakfast time.',guideZh:'早上好，米洛。我们一起准备早餐。',foods:[],scene:'invitation',partnerLine:'早上好，一起准备早餐吧！',audioKey:'breakfast_story_1',guideAudioKey:'breakfast_story_1_guide'},
  {id:'breakfast-bread',titleZh:'先摆好面包',english:'Bread, please. Put the bread on the plate.',guideZh:'先带来面包，把面包放在餐盘上。',foods:['bread'],scene:'bread',partnerLine:'面包摆好啦，还要准备什么呢？',audioKey:'breakfast_story_2',guideAudioKey:'breakfast_story_2_guide'},
  {id:'breakfast-fruit',titleZh:'苹果和牛奶也来了',english:'An apple and some milk. Here you are!',guideZh:'再准备一个苹果和一点牛奶。早餐快要准备好了。',foods:['apple','milk'],scene:'fruit',partnerLine:'谢谢你带来了苹果和牛奶。',audioKey:'breakfast_story_3',guideAudioKey:'breakfast_story_3_guide'},
  {id:'breakfast-ready',titleZh:'一起吃早餐吧',english:"We have bread, an apple and milk. Let's eat together!",guideZh:'面包、苹果和牛奶都齐了。一起吃早餐吧。',foods:['bread','apple','milk'],scene:'ready',partnerLine:'我们的早餐准备好啦！',audioKey:'breakfast_story_4',guideAudioKey:'breakfast_story_4_guide'},
];

const QUESTIONS = {
  beginner:{bread:'Bread.',apple:'Apple.',milk:'Milk.'},
  words:{bread:'Can you bring the bread?',apple:'Can you bring the apple?',milk:'Can you bring the milk?'},
  talk:{bread:'Find something to eat that is not a fruit.',apple:'Which fruit is red?',milk:'Which drink can we pour into a cup?'},
};
const HINTS = {
  beginner:{bread:'米洛说的是面包。找一找面包的图片。',apple:'米洛说的是苹果。找一找苹果的图片。',milk:'米洛想要牛奶。找一找牛奶的图片。'},
  words:{bread:'米洛想把面包摆到早餐桌上。选中面包。',apple:'米洛想把苹果摆到早餐桌上。选中苹果。',milk:'米洛想把牛奶摆到早餐桌上。选中牛奶。'},
  talk:{bread:'找一种不是水果、可以吃的食物。',apple:'找一种红色的水果。看看哪张图片符合。',milk:'找一种可以倒进杯子里的饮品。'},
};
const DEMOS = {bread:'这是面包。我们把面包摆到早餐桌上。',apple:'这是苹果。我们把苹果摆到早餐桌上。',milk:'这是牛奶。我们把牛奶摆到早餐桌上。'};
const CHOICES = {
  young:[['apple','bread'],['milk','apple'],['bread','milk']],
  middle:[['apple','bread','milk'],['bread','milk','apple'],['milk','apple','bread']],
  older:[['apple','banana','bread','milk'],['bread','milk','banana','apple'],['banana','milk','apple','bread']],
};

export function getUnitStoryPages(id='picnic'){
  return id==='picnic'?STORY_PAGES:id==='breakfast'?BREAKFAST_STORY_PAGES:[];
}
export function getUnitTrials(profile={},id='picnic'){
  if(id==='picnic')return getPackTrials(profile);
  if(id!=='breakfast')return [];
  const level=Object.hasOwn(QUESTIONS,profile.level)?profile.level:'beginner';
  const band=getAgeBand(profile.age);
  return ['bread','apple','milk'].map((target,index)=>({
    id:`breakfast-${level}-${target}`,question:QUESTIONS[level][target],target,
    choices:[...CHOICES[band][index]],hintZh:HINTS[level][target],demoZh:DEMOS[target],
    audioKey:`breakfast_pack_${level}_${target}`,hintAudioKey:`breakfast_hint_${level}_${target}`,demoAudioKey:`breakfast_demo_${target}`,
  }));
}
export function sampleFor(id){
  const samples={bread:{text:'Bread, please.',textZh:'请给我一点面包。',audioKey:'sample_bread'},apple:{text:'An apple, please.',textZh:'请给我一个苹果。',audioKey:'sample_apple'},milk:{text:'Milk, please.',textZh:'请给我一点牛奶。',audioKey:'sample_milk'},banana:{text:'A banana, please.',textZh:'请给我一根香蕉。',audioKey:'sample_banana'}};
  return samples[id]||null;
}

export const EXTRA_SPEECH_LINES = {
  breakfast_home:{text:'新的早餐冒险开始啦。点一下对话气泡，我们一起摆好早餐桌吧。',lang:'zh-CN'},
  breakfast_homeComplete:{text:'我们一起准备了早餐。你可以看看旅行页，也可以再读一次故事。',lang:'zh-CN'},
  breakfast_readerIntro:{text:'跟着我听一段早餐故事。点小喇叭可以再听一遍，点右边的箭头翻到下一页。',lang:'zh-CN'},
  breakfast_packIntro:{text:'现在帮我准备早餐。先听一听，再选一样食物。',lang:'zh-CN'},
  breakfast_packDone:{text:'早餐桌摆好啦。接下来轮到你来选择，你想吃什么？',lang:'zh-CN'},
  breakfast_expressionIntro:{text:'早餐你想吃什么？可以说一说，也可以点图片告诉我。',lang:'zh-CN'},
  breakfast_memory:{text:'我们一起准备了早餐。把这次共同的选择，收进旅行页吧。',lang:'zh-CN'},
  breakfast_finish:{text:'谢谢你和我一起准备早餐。今天就到这里，休息一下吧。下次再见。',lang:'zh-CN'},
  sample_bread:{text:'Bread, please.',lang:'en-US'},
};
for(const page of BREAKFAST_STORY_PAGES){
  EXTRA_SPEECH_LINES[page.audioKey]={text:page.english,lang:'en-US'};
  EXTRA_SPEECH_LINES[page.guideAudioKey]={text:page.guideZh,lang:'zh-CN'};
}
for(const target of ['bread','apple','milk']){
  EXTRA_SPEECH_LINES[`breakfast_demo_${target}`]={text:DEMOS[target],lang:'zh-CN'};
  for(const level of Object.keys(QUESTIONS)){
    EXTRA_SPEECH_LINES[`breakfast_pack_${level}_${target}`]={text:QUESTIONS[level][target],lang:'en-US'};
    EXTRA_SPEECH_LINES[`breakfast_hint_${level}_${target}`]={text:HINTS[level][target],lang:'zh-CN'};
  }
}
