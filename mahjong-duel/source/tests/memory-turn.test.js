import test from 'node:test';
import assert from 'node:assert/strict';
import { flipMemoryTile, MATCH_VIEW_MS, MISS_VIEW_MS } from '../src/memory-turn.js';
const tile = (id, key, x, z=0) => ({id, matchKey:key, x, y:0, z, removed:false});
test('a side-surrounded tile can be the first memory flip', () => {
  const tiles=[tile('a','a',0),tile('b','b',1),tile('c','a',2)];
  assert.deepEqual(flipMemoryTile(tiles,[],'b').revealed,['b']);
});
test('top-covered, duplicate, removed, and third flips are rejected', () => {
  const tiles=[tile('a','a',0),tile('b','b',1),tile('cover','a',0,1),{...tile('gone','a',4),removed:true}];
  assert.equal(flipMemoryTile(tiles,[],'a'),null);
  assert.equal(flipMemoryTile(tiles,[],'gone'),null);
  assert.equal(flipMemoryTile(tiles,['b'],'b'),null);
  assert.equal(flipMemoryTile(tiles,['b','cover'],'a'),null);
});
test('matching and mismatching pairs get an explicit viewing interval without immediate removal', () => {
  const tiles=[tile('a','same',0),tile('b','other',1),tile('c','same',2)];
  assert.deepEqual(flipMemoryTile(tiles,['a'],'c'),{revealed:['a','c'],match:true,duration:MATCH_VIEW_MS});
  assert.deepEqual(flipMemoryTile(tiles,['a'],'b'),{revealed:['a','b'],match:false,duration:MISS_VIEW_MS});
  assert.ok(tiles.every(tile=>!tile.removed));
});
test('difficulty gives mismatches less study time while matching faces keep a consistent reveal', () => {
  const tiles=[tile('a','same',0),tile('b','other',1),tile('c','same',2)];
  const before=structuredClone(tiles);
  for(const [difficulty,duration] of [['calm',900],['balanced',700],['intricate',550]]) {
    assert.deepEqual(flipMemoryTile(tiles,['a'],'b',difficulty),{revealed:['a','b'],match:false,duration});
    assert.deepEqual(flipMemoryTile(tiles,['a'],'c',difficulty),{revealed:['a','c'],match:true,duration:240});
    assert.deepEqual(flipMemoryTile(tiles,[],'a',difficulty),{revealed:['a'],match:null,duration:0});
    assert.equal(flipMemoryTile(tiles,['a'],'a',difficulty),null,'the same tile cannot be flipped twice');
    assert.equal(flipMemoryTile(tiles,['a','b'],'c',difficulty),null,'difficulty never permits a third flip');
  }
  assert.equal(MISS_VIEW_MS,700);
  assert.equal(MATCH_VIEW_MS,240);
  assert.deepEqual(tiles,before,'flip decisions do not remove or mutate tiles');
});
test('unrecognized memory difficulty is rejected', () => {
  const tiles=[tile('a','same',0),tile('b','other',1)];
  assert.throws(()=>flipMemoryTile(tiles,['a'],'b','unknown'),/Unknown difficulty/);
  assert.throws(()=>flipMemoryTile(tiles,['a'],'b','toString'),/Unknown difficulty/);
});
