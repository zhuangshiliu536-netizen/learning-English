import assert from 'node:assert/strict';
import { buildEvidence, getProgress } from '../outputs/first-day-demo/evidence.js';

// Empty and malformed records must not invent participation or language evidence.
const empty = buildEvidence(null);
assert.deepEqual(empty.listening.trials, []);
assert.equal(empty.expression.attempted, false);
assert.equal(empty.support.adultAssistance, 'unknown');
assert.equal(getProgress({ completedAt: '2026-11-02' }).completed, false);
assert.equal(getProgress({ reader: { done: true } }).packDone, false);

// Cumulative counters and repeated attempts must not become separate tasks.
const supported = buildEvidence({
  reader: { done: true, pagesSeen: [0, 0, 1], audioPlayed: [0], audioEnded: [0] },
  pack: {
    done: true,
    hints: { apple: 2 },
    replays: { apple: 2 },
    events: [
      { trialId: 'apple', target: 'apple', question: 'Apple, please.', choice: 'banana', correct: false, hintLevel: 0, replays: 1, source: 'click' },
      { trialId: 'apple', target: 'apple', question: 'Apple, please.', choice: 'apple', correct: true, hintLevel: 2, replays: 2, source: 'drag' }
    ]
  },
  helpEvents: [{ type: 'pack', trialId: 'apple', level: 2 }]
});
assert.equal(supported.listening.trials.length, 1);
assert.equal(supported.listening.trials[0].attemptCount, 2);
assert.equal(supported.listening.trials[0].maxHintLevel, 2);
assert.equal(supported.listening.trials[0].correct, true);
assert.equal(supported.support.replayCount, 2);
assert.equal(supported.support.promptedTrials, 1);
assert.match(supported.listening.trials[0].description, /减少了选项/);

// A choice is not evidence of speaking, even when the activity was completed.
const selected = buildEvidence({ expression: { done: true, selectedFood: 'apple', mode: 'selection' } });
assert.equal(selected.expression.mode, 'selection');
assert.equal(selected.expression.attempted, false);
assert.match(selected.expression.summary, /英文口语本次未观察/);

// A recording does not imply recognition, pronunciation accuracy, or independence.
const recorded = buildEvidence({ expression: { done: true, selectedFood: 'milk', recorded: true, samplePlayed: true } });
assert.equal(recorded.expression.mode, 'recording');
assert.equal(recorded.expression.attempted, true);
assert.equal(recorded.expression.automatedAssessment, false);
assert.match(recorded.expression.summary, /未自动识别/);
assert.match(recorded.expression.summary, /不足以判断/);

const completed = {
  reader: { done: true }, pack: { done: true }, expression: { done: true }, completedAt: '2026-11-02T00:00:00Z'
};
assert.equal(getProgress(completed).completed, true);
assert.match(buildEvidence(completed).participation.join(''), /结束首日主流程/);
console.log('Evidence checks passed: empty state, supported attempts, non-speech selection, recording limits, completion.');
