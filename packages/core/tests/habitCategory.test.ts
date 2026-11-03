import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, categoryOf, doneGoodHabits, goodIds, parseCategory, parseCategoryMap, splitHabits } from '../src/habitCategory.ts';

test('categoryOf: the saved value wins', () => {
  assert.equal(categoryOf({ name: 'Beer', category: 'people' }), 'people');
});

test('categoryOf: guesses from the habit icon', () => {
  const cases = {
    Gym: 'move', 'Rock climbing': 'move', Yoga: 'wellbeing', Creatine: 'wellbeing', Read: 'mind',
    Guitar: 'mind', 'Date night': 'people', Beer: 'bad', Wine: 'bad', Vape: 'bad', Coffee: 'other', Games: 'other', Laundry: 'other',
  };
  for (const [name, want] of Object.entries(cases)) assert.equal(categoryOf({ name }), want, name);
});

test('categoryOf: bad words with no icon', () => {
  for (const name of ['Doomscrolling', 'Scroll TikTok', 'Junk food', 'Sweets']) assert.equal(categoryOf({ name }), 'bad', name);
});

test('parseCategory keeps only known values', () => {
  assert.equal(parseCategory(' Bad '), 'bad');
  assert.equal(parseCategory('wellbeing'), 'wellbeing');
  assert.equal(parseCategory('good'), undefined);
  assert.equal(parseCategory(''), undefined);
  assert.equal(parseCategory(null), undefined);
});

test('an unknown stored value falls back to the name', () => {
  assert.equal(categoryOf({ name: 'Beer', category: parseCategory('nonsense') }), 'bad');
});

test('goodIds leaves bad habits out', () => {
  const list = [{ id: 'a', name: 'Gym' }, { id: 'b', name: 'Beer' }, { id: 'c', name: 'Gym', category: 'bad' as const }];
  assert.deepEqual([...goodIds(list)], ['a']);
});

test('splitHabits keeps order inside each side', () => {
  const r = splitHabits([{ name: 'Beer' }, { name: 'Gym' }, { name: 'Wine' }, { name: 'Read' }]);
  assert.deepEqual(r.good.map((h) => h.name), ['Gym', 'Read']);
  assert.deepEqual(r.bad.map((h) => h.name), ['Beer', 'Wine']);
});

test('parseCategoryMap: valid, invalid, too long', () => {
  assert.deepEqual(parseCategoryMap({ a: 'move' }), { a: 'move' });
  assert.equal(parseCategoryMap({ a: 'nope' }), null);
  assert.equal(parseCategoryMap(['move']), null);
  assert.equal(parseCategoryMap(null), null);
  assert.equal(parseCategoryMap(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`i${i}`, 'move']))), null);
});

test('doneGoodHabits leaves a ticked bad habit off the Today tile', () => {
  const logs = [{ activityId: 'a', completed: true }, { activityId: 'b', completed: true }];
  const list = [{ id: 'b', name: 'Beer' }, { id: 'a', name: 'Gym' }];
  assert.deepEqual(doneGoodHabits(logs, list, 0).map((h) => h.label), ['Gym']);
});

test('the move category is shown as Body', () => {
  assert.equal(CATEGORIES.find((c) => c.id === 'move')?.label, 'Body');
});
