// Original content for the first-day picnic prototype. This is a sample unit,
// not a complete curriculum. Age changes interaction density; level changes language.

export const FOODS = [
  { id: 'apple', label: 'Apple', labelZh: '苹果', icon: 'apple', color: '#e66c70' },
  { id: 'banana', label: 'Banana', labelZh: '香蕉', icon: 'banana', color: '#e9b93e' },
  { id: 'milk', label: 'Milk', labelZh: '牛奶', icon: 'milk', color: '#6aa9d5' },
  { id: 'bread', label: 'Bread', labelZh: '面包', icon: 'bread', color: '#c78b51' },
];

export const STORY_PAGES = [
  {
    id: 'picnic-time', titleZh: '今天去野餐',
    english: "It is picnic time. Let's pack a basket!",
    guideZh: '今天，米洛想去野餐。一起看看要带些什么。',
    foods: [], scene: 'invitation',
    partnerLine: '一起准备野餐吧！',
    audioKey: 'story_1', guideAudioKey: 'story_1_guide',
  },
  {
    id: 'picnic-fruit', titleZh: '带上水果',
    english: 'An apple and a banana. In they go!',
    guideZh: '米洛带上了苹果和香蕉。听听它们的英文名字。',
    foods: ['apple', 'banana'], scene: 'fruit',
    partnerLine: '我们把水果放进篮子里。',
    audioKey: 'story_2', guideAudioKey: 'story_2_guide',
  },
  {
    id: 'picnic-milk', titleZh: '再带一点牛奶',
    english: 'Milk, please. Put the milk in the basket.',
    guideZh: '还要带一点牛奶。牛奶也放进篮子里。',
    foods: ['milk'], scene: 'drink',
    partnerLine: 'Milk 是牛奶。',
    audioKey: 'story_3', guideAudioKey: 'story_3_guide',
  },
  {
    id: 'picnic-ready', titleZh: '野餐准备好了',
    english: "We have an apple, a banana and milk. Let's have a picnic!",
    guideZh: '水果和牛奶都准备好了。带上野餐篮，一起出发。',
    foods: ['apple', 'banana', 'milk'], scene: 'ready',
    partnerLine: '准备好了，一起去野餐！',
    audioKey: 'story_4', guideAudioKey: 'story_4_guide',
  },
];

const QUESTIONS = {
  beginner: {
    apple: 'Apple.',
    banana: 'Banana.',
    milk: 'Milk.',
  },
  words: {
    apple: 'Can you pack the apple?',
    banana: 'Can you pack the banana?',
    milk: 'Can you pack the milk?',
  },
  talk: {
    apple: 'Which fruit is red?',
    banana: 'Which fruit is yellow?',
    milk: 'We need something to drink. What shall we pack?',
  },
};

const HINTS = {
  beginner: {
    apple: 'Apple 是苹果。找一找苹果的图片。',
    banana: 'Banana 是香蕉。找一找香蕉的图片。',
    milk: 'Milk 是牛奶。找一找牛奶的图片。',
  },
  words: {
    apple: '米洛想带一个苹果。选中苹果，放进篮子。',
    banana: '米洛想带一根香蕉。选中香蕉，放进篮子。',
    milk: '米洛想带一点牛奶。选中牛奶，放进篮子。',
  },
  talk: {
    apple: '找一种红色的水果。看看哪张图片符合。',
    banana: '找一种黄色的水果。看看哪张图片符合。',
    milk: '米洛想带一种可以喝的东西。看看哪张图片符合。',
  },
};

const DEMOS = {
  apple: '这是苹果。我们把苹果放进篮子。',
  banana: '这是香蕉。我们把香蕉放进篮子。',
  milk: '这是牛奶。我们把牛奶放进篮子。',
};

const CHOICES = {
  young: [
    ['banana', 'apple'],
    ['banana', 'milk'],
    ['apple', 'milk'],
  ],
  middle: [
    ['banana', 'apple', 'milk'],
    ['apple', 'milk', 'banana'],
    ['milk', 'banana', 'apple'],
  ],
  older: [
    ['bread', 'banana', 'apple', 'milk'],
    ['banana', 'milk', 'bread', 'apple'],
    ['apple', 'bread', 'banana', 'milk'],
  ],
};

export function getAgeBand(age) {
  const value = Number(age);
  const safeAge = Number.isFinite(value) ? value : 5;
  return safeAge <= 4 ? 'young' : safeAge <= 6 ? 'middle' : 'older';
}

export function getPackTrials(profile = {}) {
  const level = Object.hasOwn(QUESTIONS, profile.level) ? profile.level : 'beginner';
  const ageBand = getAgeBand(profile.age);
  return ['apple', 'banana', 'milk'].map((target, index) => ({
    id: `pack-${level}-${target}`,
    question: QUESTIONS[level][target],
    target,
    choices: [...CHOICES[ageBand][index]],
    hintZh: HINTS[level][target],
    demoZh: DEMOS[target],
    audioKey: `pack_${level}_${target}`,
    hintAudioKey: `hint_${level}_${target}`,
    demoAudioKey: `demo_${target}`,
  }));
}

export const SPEECH_LINES = {
  welcome: { text: '欢迎来到故事伙伴。请家长先做一个简单设置。', lang: 'zh-CN' },
  audioTest: { text: "Hello! Let's go on a picnic.", lang: 'en-US' },
  meet: { text: '你好，我是米洛。点一下我，听听我的声音。', lang: 'zh-CN' },
  tapPartner: { text: '听到啦！接下来跟着我，一起读故事。', lang: 'zh-CN' },
  home: { text: '今天，我们一起准备野餐。点一下我的对话气泡，就能出发。', lang: 'zh-CN' },
  packIntro: { text: '现在帮我装好野餐篮。先听一听，再选一种食物。', lang: 'zh-CN' },
  expressionIntro: { text: '你想带什么去野餐？可以说一说，也可以点图片告诉我。', lang: 'zh-CN' },
  expressionQuestion: { text: 'What would you like?', lang: 'en-US' },
  finish: { text: '谢谢你和我一起准备野餐。今天的冒险完成了。休息一下吧，下次再见。', lang: 'zh-CN' },
  correctChoice: { text: 'There it is! Into the basket.', lang: 'en-US' },
  tryAgain: { text: '再听一遍，找找我想带的食物。', lang: 'zh-CN' },
  helpIntro: { text: '需要帮忙吗？我们可以再听一遍，或者看看提示。', lang: 'zh-CN' },
  picnicReady: { text: '野餐篮准备好了。一起看看我们带了什么。', lang: 'zh-CN' },
  expressionThanks: { text: "Thank you! Let's have a picnic.", lang: 'en-US' },
  expressionApple: { text: 'An apple, please.', lang: 'en-US' },
  expressionBanana: { text: 'A banana, please.', lang: 'en-US' },
  expressionMilk: { text: 'Milk, please.', lang: 'en-US' },
  resume: { text: '你回来啦！我们从上次的地方继续。', lang: 'zh-CN' },
  saved: { text: '已经帮你记住这里。下次可以继续。', lang: 'zh-CN' },
  readerFinished: { text: '故事听完啦。接下来，我们一起装野餐篮。', lang: 'zh-CN' },
  readerIntro: { text: '跟着我听一个小故事。点小喇叭，可以再听一遍。点右边的箭头，就能翻到下一页。', lang: 'zh-CN' },
  homeComplete: { text: '今天的冒险完成啦。你可以回看我们的旅行页，也可以再读一次故事。', lang: 'zh-CN' },
  memory: { text: '我们选好了食物，第一张旅行页也准备好了。一起把它收好吧。', lang: 'zh-CN' },
  packDone: { text: '我们的篮子装好啦。接下来轮到你来选择，你想带什么？', lang: 'zh-CN' },
};

SPEECH_LINES.soundTest = SPEECH_LINES.audioTest;
SPEECH_LINES.sample_apple = SPEECH_LINES.expressionApple;
SPEECH_LINES.sample_banana = SPEECH_LINES.expressionBanana;
SPEECH_LINES.sample_milk = SPEECH_LINES.expressionMilk;

for (const page of STORY_PAGES) {
  SPEECH_LINES[page.audioKey] = { text: page.english, lang: 'en-US' };
  SPEECH_LINES[page.guideAudioKey] = { text: page.guideZh, lang: 'zh-CN' };
}

for (const food of FOODS) {
  SPEECH_LINES[`food_${food.id}`] = { text: food.label, lang: 'en-US' };
  if (DEMOS[food.id]) SPEECH_LINES[`demo_${food.id}`] = { text: DEMOS[food.id], lang: 'zh-CN' };
}

for (const level of Object.keys(QUESTIONS)) {
  for (const target of ['apple', 'banana', 'milk']) {
    SPEECH_LINES[`pack_${level}_${target}`] = { text: QUESTIONS[level][target], lang: 'en-US' };
    SPEECH_LINES[`hint_${level}_${target}`] = { text: HINTS[level][target], lang: 'zh-CN' };
  }
}
