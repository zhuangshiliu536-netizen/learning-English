/**
 * Turn this browser's recorded activity into a factual parent recap.
 * This module does not infer mastery, recognise speech or assess pronunciation.
 */

const FOOD_LABELS = Object.freeze({
  apple: '苹果', banana: '香蕉', milk: '牛奶', bread: '面包',
  water: '水', orange: '橙子', juice: '果汁', sandwich: '三明治'
});

const HINT_LABELS = Object.freeze([
  '未记录额外语义提示', '提供了语义提示', '减少了选项或拆小步骤', '提供了示范'
]);

const list = value => Array.isArray(value) ? value : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = value => typeof value === 'string' ? value.trim() : '';
const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const hint = value => Math.min(3, count(value));
const foodLabel = value => FOOD_LABELS[text(value)] || text(value) || '未注明物品';
const uniquePages = value => new Set(list(value).filter(page => Number.isInteger(page) && page >= 0)).size;

/** Completion is a product state, not a claim about language ability. */
export function getProgress(value = {}) {
  const state = object(value);
  const readerDone = object(state.reader).done === true;
  const packDone = object(state.pack).done === true;
  const expressionDone = object(state.expression).done === true;
  const completed = readerDone && packDone && expressionDone && Boolean(text(state.completedAt));
  return { readerDone, packDone, expressionDone, completed };
}

function collectTrials(pack) {
  const grouped = new Map();
  const hints = object(pack.hints);
  const replays = object(pack.replays);

  list(pack.events).forEach((rawEvent, index) => {
    const event = object(rawEvent);
    if (!text(event.trialId) && !text(event.target) && !text(event.question) && !text(event.choice)) return;
    // Unknown IDs stay separate: their relationship cannot be reconstructed safely.
    const trialId = text(event.trialId) || `unidentified-${index + 1}`;
    if (!grouped.has(trialId)) {
      grouped.set(trialId, {
        trialId, target: text(event.target), question: text(event.question), responses: []
      });
    }
    const trial = grouped.get(trialId);
    trial.target ||= text(event.target);
    trial.question ||= text(event.question);
    trial.responses.push({
      choice: text(event.choice),
      choiceLabel: foodLabel(event.choice),
      correct: typeof event.correct === 'boolean' ? event.correct : null,
      hintLevel: hint(event.hintLevel),
      replays: count(event.replays),
      source: text(event.source) || 'unspecified',
      ts: typeof event.ts === 'number' || typeof event.ts === 'string' ? event.ts : null
    });
  });

  return [...grouped.values()].map(trial => {
    const last = trial.responses.at(-1);
    const maxHintLevel = Math.max(hint(hints[trial.trialId]), ...trial.responses.map(item => item.hintLevel));
    // Each event stores a cumulative replay count; summing would overstate usage.
    const replayCount = Math.max(count(replays[trial.trialId]), ...trial.responses.map(item => item.replays));
    const result = last.correct === true ? '与本次目标一致' : last.correct === false ? '与本次目标未一致' : '是否与目标一致尚未确认';
    const sourceLabels = [...new Set(trial.responses.map(item => {
      if (item.source === 'click' || item.source === 'selection') return '点选';
      if (item.source === 'drag' || item.source === 'drop') return '拖动';
      if (item.source === 'demo' || item.source === 'demonstration') return '示范路径';
      return '未注明的操作方式';
    }))];

    return {
      ...trial,
      label: trial.question ? `请求：${trial.question}` : `物品请求：${foodLabel(trial.target)}`,
      attemptCount: trial.responses.length,
      correct: last.correct,
      finalChoice: last.choice,
      maxHintLevel,
      replays: replayCount,
      description: [
        `记录了 ${trial.responses.length} 次选择回应，最后选择${last.choice ? `“${last.choiceLabel}”` : '未注明'}，${result}。`,
        `最高已记录帮助：${HINT_LABELS[maxHintLevel]}；请求重听 ${replayCount} 次。`,
        `回应方式：${sourceLabels.join('、')}。`,
        '这是具体任务中的表现，不能单独代表已掌握相应语言。'
      ].join('')
    };
  });
}

function expressionEvidence(expression) {
  const selectedFood = text(expression.selectedFood);
  const recorded = expression.recorded === true;
  const samplePlayed = expression.samplePlayed === true;
  let summary;

  if (recorded) {
    summary = `本次留下了录音尝试${selectedFood ? `，所选物品为“${foodLabel(selectedFood)}”` : ''}。录音内容未自动识别，也没有进行发音评价。`;
    if (samplePlayed) summary += '本次还播放过表达示范；现有记录不足以判断录音属于模仿还是独立表达。';
  } else if (selectedFood) {
    summary = `本次选择了“${foodLabel(selectedFood)}”${expression.done === true ? '并通过点选完成表达活动' : '，活动尚未结束'}；没有留下录音，英文口语本次未观察。`;
    if (samplePlayed) summary += '播放过示范音频只说明接触了示范，不代表孩子已经说出该表达。';
  } else {
    summary = '本次尚无表达选择或录音记录，口语表现待观察。';
    if (samplePlayed) summary += '有表达示范播放记录，但没有孩子回应的证据。';
  }

  return {
    summary,
    mode: recorded ? 'recording' : selectedFood ? 'selection' : 'not-observed',
    attempted: recorded,
    selectedFood: selectedFood || null,
    samplePlayed,
    automatedAssessment: false
  };
}

/**
 * @returns {{participation: string[], listening: object, expression: object,
 * support: object, nextStep: string, caveats: string[]}}
 */
export function buildEvidence(value = {}) {
  const state = object(value);
  const reader = object(state.reader);
  const pack = object(state.pack);
  const expression = object(state.expression);
  const progress = getProgress(state);
  const breakfast = state.activeUnitId === 'breakfast';
  const taskLabel = breakfast ? '摆早餐' : '装篮子';
  const trials = collectTrials(pack);
  const pagesSeen = uniquePages(reader.pagesSeen);
  const pagesWithAudio = uniquePages(reader.audioPlayed);
  const audioEndedPages = uniquePages(reader.audioEnded);
  const helpEvents = list(state.helpEvents).map(object);
  const readerHelp = helpEvents.filter(event => event.type === 'reader');
  const packHelp = helpEvents.filter(event => event.type === 'pack');
  const expressionHelp = helpEvents.filter(event => event.type === 'expression');

  const participation = [];
  if (pagesSeen) participation.push(`访问了绘本的 ${pagesSeen} 个不同页面${progress.readerDone ? '，并到达本次阅读活动的结束点' : '，可以继续听读或重读'}。`);
  else if (progress.readerDone) participation.push('已标记本次阅读活动完成，但没有可用的页面访问记录。');
  else participation.push('本次尚无绘本页面访问记录。');

  if (pagesWithAudio || audioEndedPages) {
    participation.push(`有 ${pagesWithAudio} 页的音频开始播放记录，${audioEndedPages} 页有播放结束记录；这些记录不证明孩子已经听懂故事。`);
  }
  if (progress.packDone) participation.push(`已结束${taskLabel}活动；具体选择与帮助情况见下方记录。`);
  if (progress.expressionDone) participation.push('已结束表达选择活动；点选和录音尝试分别说明。');
  if (progress.completed) participation.push(breakfast ? '已生成共同旅行页并结束本单元。' : '已生成共同旅行页并结束首日主流程。');

  const attemptCount = trials.reduce((sum, item) => sum + item.attemptCount, 0);
  const matchedTrials = trials.filter(item => item.correct === true).length;
  const promptedTrials = trials.filter(item => item.maxHintLevel > 0).length;
  const demonstrationUsed = trials.some(item => item.maxHintLevel >= 3) || expression.samplePlayed === true || expressionHelp.some(item => hint(item.level) >= 3);
  const replayMap = object(pack.replays);
  const replayIds = new Set([...Object.keys(replayMap), ...trials.map(item => item.trialId)]);
  let replayCount = 0;
  for (const id of replayIds) replayCount += Math.max(count(replayMap[id]), trials.find(item => item.trialId === id)?.replays || 0);
  const helpCount = readerHelp.length + packHelp.length + expressionHelp.length;

  let listeningSummary = `本次尚无${taskLabel}任务的选择记录；仅有阅读或播放记录时，不形成理解能力结论。`;
  if (trials.length) {
    listeningSummary = `在 ${trials.length} 个不同请求中记录了 ${attemptCount} 次选择回应；各请求最近一次回应中，有 ${matchedTrials} 项与任务目标一致。`;
    listeningSummary += promptedTrials ? `其中 ${promptedTrials} 个请求有额外提示、选项调整或示范记录，请结合具体条件查看。` : '这些请求未记录额外语义提示；题目材料与重听情况仍是观察条件。';
  }

  const supportParts = [];
  if (helpCount) supportParts.push(`记录了 ${helpCount} 次帮助操作`);
  if (replayCount) supportParts.push(`${taskLabel}请求重听 ${replayCount} 次`);
  if (readerHelp.length) supportParts.push(`阅读理解提示 ${readerHelp.length} 次`);
  if (demonstrationUsed) supportParts.push('本次存在示范相关记录');
  const supportSummary = `${supportParts.length ? `${supportParts.join('；')}。` : '本次未记录额外帮助操作或请求重听。'}成人是否协助尚未确认；自行操作与语言支持程度分别记录。`;

  let nextStep;
  if (!progress.readerDone) nextStep = '可以先继续当前绘本，保留暂停、重听和理解帮助；听读后再观察孩子如何回应。';
  else if (!progress.packDone) nextStep = `继续${taskLabel}活动，观察具体请求下的选择；需要时使用帮助，并保留实际支持条件。`;
  else if (!progress.expressionDone) nextStep = '邀请孩子表达自己的选择。可以只点选，也可自愿录音；不把开口或录音作为故事继续的前提。';
  else if (!progress.completed) nextStep = `一起回看准备好的${breakfast ? '早餐' : '野餐'}，生成旅行页并自然结束。后续可换材料再观察相同语言任务。`;
  else nextStep = '下一次换一组图片位置、物品或请求，再观察孩子如何理解和回应；继续记录实际提供的帮助。';

  return {
    participation,
    listening: { summary: listeningSummary, trials, attemptCount, matchedTrials },
    expression: expressionEvidence(expression),
    support: {
      summary: supportSummary, helpCount, replayCount, promptedTrials,
      storyGuideCount: readerHelp.length, demonstrationUsed, adultAssistance: 'unknown'
    },
    nextStep,
    caveats: [
      '本次反馈来自当前浏览器的实际活动记录，不是标准化语言测评。',
      '翻页、音频播放和故事结束说明接触与参与，不直接证明理解或独立阅读。',
      '点选与拖动不作为英文口语证据；录音尝试也不代表已识别内容或已评价发音。',
      '成人协助情况未确认，不能根据未记录协助直接认定完全自主。',
      '当前没有可比的同条件历史观察，不提供进步幅度、等级提升或掌握结论。'
    ]
  };
}
