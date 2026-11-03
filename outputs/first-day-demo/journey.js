// Learning records and companion hearts are separate: hearts reward participation,
// never correctness, pronunciation, speed, or a decision to use the microphone.
const FIELDS=['reader','pack','expression','completedAt','helpEvents','activityEvents','lastActivity'];
const copy=value=>JSON.parse(JSON.stringify(value));
export const HEART_RULES=Object.freeze({baseline:20,maximum:100,readerPage:2,request:2,expression:3,memory:3});

export function freshLearningState(){return {
  lastActivity:null,
  reader:{page:0,pagesSeen:[],pagesFinished:[],audioPlayed:[],audioEnded:[],done:false},
  pack:{trialIndex:0,done:false,review:false,resolved:{},events:[],items:[],hints:{},replays:{}},
  expression:{mode:null,selectedFood:null,recorded:false,done:false,samplePlayed:false},
  completedAt:null,helpEvents:[],activityEvents:[]
};}
export function archiveUnit(state){
  state.unitRecords??={};
  state.unitRecords[state.activeUnitId||'picnic']=copy(Object.fromEntries(FIELDS.map(key=>[key,state[key]])));
}
export function unitRecord(state,id){return id===(state.activeUnitId||'picnic')?state:state.unitRecords?.[id]||null;}
export function switchUnit(state,id){
  archiveUnit(state);
  const record=state.unitRecords[id];
  Object.assign(state,record?copy(record):freshLearningState());
  state.activeUnitId=id;
}
export function awardHearts(state,eventId,amount,unitId=state.activeUnitId||'picnic'){
  state.relationship??={rewards:{}};state.relationship.rewards??={};
  const key=`${unitId}:${eventId}`;
  if(Object.hasOwn(state.relationship.rewards,key))return 0;
  const hearts=Math.max(0,Math.min(5,Math.floor(Number(amount)||0)));
  if(!hearts)return 0;
  state.relationship.rewards[key]={amount:hearts,at:new Date().toISOString()};
  return hearts;
}
export function totalHearts(state){return Object.values(state.relationship?.rewards||{}).reduce((sum,event)=>sum+(Number.isFinite(event?.amount)?event.amount:0),0);}
export function happinessValue(state){return Math.min(HEART_RULES.maximum,HEART_RULES.baseline+totalHearts(state));}
export function initializeJourney(state){
  state.activeUnitId??='picnic';state.unitRecords??={};state.relationship??={rewards:{}};
  // Restore only product completion that actually exists in the old record.
  // Page visits alone do not qualify as finished-page participation.
  for(const [id,record] of Object.entries({...state.unitRecords,[state.activeUnitId]:state})){
    const reader=record.reader||{};
    const pages=reader.done?[0,1,2,3]:reader.pagesFinished||[];
    for(const page of pages)awardHearts(state,`reader-page-${page}`,HEART_RULES.readerPage,id);
    const targets=new Set((record.pack?.events||[]).filter(event=>event.correct===true).map(event=>event.target));
    for(const target of targets)awardHearts(state,`pack-${target}`,HEART_RULES.request,id);
    if(record.expression?.done)awardHearts(state,'expression',HEART_RULES.expression,id);
    if(record.completedAt)awardHearts(state,'memory',HEART_RULES.memory,id);
  }
  state.reader.pagesFinished??=state.reader.done?[0,1,2,3]:[];
}
