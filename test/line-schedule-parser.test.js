'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseScheduleInput:parse}=require('../lib/line-schedule-parser');
test('same-day formats have the same Taipei timestamps',()=>{
 for(const text of ['20261116\n8:00-10:00','2026/11/16 8:00~10:00','2026.11.16 8:00至10:00','２０２６／１１／１６ ８：００～１０：００','2026年11月16日 上午8點-上午10點']){
  const result=parse(text);
  assert.equal(result.success,true,text);
  assert.equal(result.start_at,'2026-11-16T00:00:00.000Z',text);
  assert.equal(result.end_at,'2026-11-16T02:00:00.000Z',text);
 }
});
test('cross-day and permanent requests preserve meaning',()=>{
 assert.equal(parse('20261116\n8:00-\n20261119\n10:00').end_at,'2026-11-19T02:00:00.000Z');
 assert.equal(parse('永久').kind,'permanent');
 assert.equal(parse('20261116 下午2點半-晚上8點').start_at,'2026-11-16T06:30:00.000Z');
 assert.equal(parse('明天 8:00-10:00',{now:Date.parse('2026-11-15T17:00:00Z')}).start_at,'2026-11-17T00:00:00.000Z');
});
test('reject impossible, ambiguous, reversed and partial inputs',()=>{
 for(const text of ['20260230 8:00-10:00','20261116 24:00-25:00','20261116 8:60-10:00','20261116 10:00-8:00','11/16 8:00-10:00','20261116 8:00','20261116 8:00-10:00 任意文字','20261116 13pm-14pm','20261116 8:00:30-10:00'])assert.equal(parse(text).success,false,text);
});
