import assert from 'node:assert/strict';
import test from 'node:test';
import {
  freshLearningState, initializeJourney, archiveUnit, unitRecord, switchUnit,
  awardHearts, totalHearts, happinessValue,
} from '../outputs/first-day-demo/journey.js';
import { UNITS, getUnitStoryPages, getUnitTrials, sampleFor, EXTRA_SPEECH_LINES } from '../outputs/first-day-demo/curriculum.js';
import { SPEECH_LINES } from '../outputs/first-day-demo/content.js';
import { buildEvidence } from '../outputs/first-day-demo/evidence.js';

function state(){return {
  version:1, profile:{age:5,level:'beginner',name:'测试'},
  settings:{sound:true,guideVoice:'neural'}, setupDone:true,
  activeUnitId:'picnic',unitRecords:{},relationship:{rewards:{}},
  ...freshLearningState(),
};}

function completeRecord(targets=['apple','banana','milk']){
  const s=freshLearningState();
  s.reader={...s.reader,page:3,pagesSeen:[0,1,2,3],pagesFinished:[0,1,2,3],done:true};
  s.pack={...s.pack,done:true,trialIndex:2,items:[...targets],events:targets.map(target=>({trialId:`pack-${target}`,target,choice:target,correct:true,hintLevel:0}))};
  s.expression={...s.expression,selectedFood:targets[0],done:true,mode:'selection'};
  s.completedAt='2026-11-03T00:00:00.000Z';
  return s;
}

test('fresh learning states are independent and ordinary page visits earn no hearts',()=>{
  const a=state(),b=state();
  a.reader.pagesSeen.push(0,1,2);
  initializeJourney(a);initializeJourney(b);
  assert.equal(totalHearts(a),0);
  assert.equal(happinessValue(a),20);
  assert.deepEqual(b.reader.pagesSeen,[]);
  assert.deepEqual(a.reader.pagesFinished,[]);
});

test('legacy completed picnic migrates to exactly 20 hearts and repeated initialization never duplicates',()=>{
  const old={version:1,profile:{age:5,level:'words'},settings:{sound:true},...completeRecord()};
  delete old.reader.pagesFinished;
  initializeJourney(old);
  assert.equal(old.activeUnitId,'picnic');
  assert.equal(totalHearts(old),20);
  assert.equal(happinessValue(old),40);
  assert.equal(Object.keys(old.relationship.rewards).length,9);
  assert.deepEqual(old.reader.pagesFinished,[0,1,2,3]);
  const ledger=structuredClone(old.relationship.rewards);
  initializeJourney(old);initializeJourney(old);
  assert.equal(totalHearts(old),20);
  assert.deepEqual(old.relationship.rewards,ledger);
});

test('partial migration uses finished pages and supported correct requests, not visits or wrong attempts',()=>{
  const s=state();s.reader.pagesSeen=[0,1,2,3];s.reader.pagesFinished=[0,2,2];
  s.pack.events=[
    {target:'apple',choice:'milk',correct:false},
    {target:'apple',choice:'apple',correct:true,hintLevel:3},
    {target:'apple',choice:'apple',correct:true,hintLevel:0},
    {target:'milk',choice:'apple',correct:false},
  ];
  initializeJourney(s);
  assert.equal(totalHearts(s),6); // two distinct pages + one supported request
  assert.deepEqual(Object.keys(s.relationship.rewards).sort(),['picnic:pack-apple','picnic:reader-page-0','picnic:reader-page-2']);
});

test('switching archives only learning state and keeps each unit independently resumable without aliasing',()=>{
  const s=state();s.reader.page=2;s.reader.pagesFinished=[0,1];s.pack.hints.apple=3;
  s.lastActivity='reader';awardHearts(s,'reader-page-0',2);
  switchUnit(s,'breakfast');
  assert.equal(s.reader.page,0);assert.equal(s.lastActivity,null);assert.deepEqual(s.pack.hints,{});
  assert.equal(s.profile.name,'测试');assert.equal(s.settings.guideVoice,'neural');assert.equal(totalHearts(s),2);
  s.reader.page=1;s.reader.pagesFinished.push(0);s.expression.selectedFood='bread';s.pack.items.push('bread');s.lastActivity='expression';
  awardHearts(s,'reader-page-0',2);
  switchUnit(s,'picnic');
  assert.equal(s.reader.page,2);assert.deepEqual(s.reader.pagesFinished,[0,1]);assert.equal(s.pack.hints.apple,3);
  assert.equal(s.expression.selectedFood,null);assert.equal(s.lastActivity,'reader');
  const breakfast=unitRecord(s,'breakfast');assert.equal(breakfast.reader.page,1);assert.equal(breakfast.expression.selectedFood,'bread');
  s.reader.pagesFinished.push(2);s.pack.items.push('apple');
  assert.deepEqual(breakfast.reader.pagesFinished,[0]);assert.deepEqual(breakfast.pack.items,['bread']);
  switchUnit(s,'breakfast');assert.equal(s.expression.selectedFood,'bread');assert.equal(s.lastActivity,'expression');
  assert.equal(totalHearts(s),4);
});

test('same-named page and food targets in picnic and breakfast are rewarded separately once',()=>{
  const s=state();
  for(const id of ['picnic','breakfast']){
    assert.equal(awardHearts(s,'pack-apple',2,id),2);
    assert.equal(awardHearts(s,'pack-milk',2,id),2);
    assert.equal(awardHearts(s,'reader-page-0',2,id),2);
    assert.equal(awardHearts(s,'pack-apple',2,id),0);
  }
  assert.equal(totalHearts(s),12);
  assert.equal(Object.keys(s.relationship.rewards).length,6);
});

test('replay and restored completed archives do not add rewards beyond two units / 40 hearts',()=>{
  const s=state();Object.assign(s,completeRecord());initializeJourney(s);
  switchUnit(s,'breakfast');Object.assign(s,completeRecord(['bread','apple','milk']));initializeJourney(s);
  assert.equal(totalHearts(s),40);assert.equal(happinessValue(s),60);
  switchUnit(s,'picnic');s.pack.review=true;s.pack.resolved={};s.pack.trialIndex=0;
  assert.equal(awardHearts(s,'pack-apple',2),0);assert.equal(awardHearts(s,'reader-page-3',2),0);
  archiveUnit(s);initializeJourney(s);
  assert.equal(totalHearts(s),40);assert.equal(happinessValue(s),60);
});

test('happiness caps at 100 while the cumulative reward ledger remains intact',()=>{
  const s=state();
  for(let i=0;i<20;i++)assert.equal(awardHearts(s,`completion-${i}`,5),5);
  assert.equal(totalHearts(s),100);assert.equal(happinessValue(s),100);
  assert.equal(awardHearts(s,'completion-0',5),0);
  assert.equal(totalHearts(s),100);assert.equal(Object.keys(s.relationship.rewards).length,20);
  for(const amount of [-3,0,NaN,'invalid'])assert.equal(awardHearts(s,`invalid-${amount}`,amount),0);
  assert.equal(totalHearts(s),100);
});

test('hearts do not alter evidence, and optional recording does not affect reward eligibility',()=>{
  const selected=state();selected.expression={...selected.expression,selectedFood:'apple',done:true,mode:'selection'};
  const before=buildEvidence(selected);
  awardHearts(selected,'expression',3);
  assert.deepEqual(buildEvidence(selected),before);
  assert.match(before.expression.summary,/英文口语本次未观察/);
  const recorded=state();recorded.expression={...recorded.expression,selectedFood:'apple',done:true,mode:'recording',recorded:true};
  assert.equal(awardHearts(recorded,'expression',3),3);
  assert.equal(totalHearts(recorded),totalHearts(selected));
  const encoded=JSON.stringify(buildEvidence(selected));
  assert.doesNotMatch(encoded,/relationship|rewards|happiness|开心值|爱心/);
});

test('two real units provide distinct story / audio keys and valid tasks for 18 profiles each',()=>{
  const knownAudio={...SPEECH_LINES,...EXTRA_SPEECH_LINES};
  const ids=new Set();const storyAudio=new Set();
  assert.deepEqual(UNITS.filter(u=>u.available).map(u=>u.id),['picnic','breakfast']);
  assert.equal(UNITS.filter(u=>!u.available).length,4);
  for(const unit of UNITS){
    assert.ok(!ids.has(unit.id));ids.add(unit.id);
    const pages=getUnitStoryPages(unit.id);
    if(!unit.available){assert.deepEqual(pages,[]);assert.deepEqual(getUnitTrials({},unit.id),[]);continue;}
    assert.equal(pages.length,4);
    for(const p of pages){assert.ok(!storyAudio.has(p.audioKey));storyAudio.add(p.audioKey);assert.ok(knownAudio[p.audioKey]);assert.ok(knownAudio[p.guideAudioKey]);}
    for(const age of [3,4,5,6,7,8])for(const level of ['beginner','words','talk']){
      const trials=getUnitTrials({age,level},unit.id);
      assert.equal(trials.length,3);assert.equal(new Set(trials.map(t=>t.id)).size,3);
      for(const trial of trials){
        assert.ok(trial.choices.includes(trial.target));assert.equal(new Set(trial.choices).size,trial.choices.length);
        assert.equal(trial.choices.length,age<=4?2:age<=6?3:4);
        for(const key of [trial.audioKey,trial.hintAudioKey,trial.demoAudioKey])assert.ok(knownAudio[key],key);
      }
    }
    for(const id of unit.foods)assert.ok(sampleFor(id)?.audioKey);
  }
});
