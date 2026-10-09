import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_STORAGE_KEY, LANGUAGES, TURKISH_MESSAGES, normalizeLanguage, loadLanguage,
  getLanguage, setLanguage, subscribeLanguage, locale, t, formatNumber, formatDate, formatMoney, countryName,
} from '../src/i18n.js';
import common from '../src/locales/tr-common.js';
import achievements from '../src/locales/tr-achievements.js';
import economy from '../src/locales/tr-economy.js';
import collection from '../src/locales/tr-collection.js';
import { ACHIEVEMENTS } from '../src/achievements.js';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENT_SHELVES } from '../src/achievement-milestones.js';
import { AVATAR_FRAMES } from '../src/avatar-frames.js';
import { LEAGUES } from '../src/leaderboards.js';
import { DAILY_QUEST_POOL } from '../src/daily-quests.js';
import { getDailyEncouragement } from '../src/daily-encouragement.js';
import { SHOP_CURRENCY_PACKS, SHOP_BOOSTER_PACKS } from '../src/economy.js';
import { themes, rulesetForTheme } from '../src/themes.js';
import { themeTileSets } from '../src/tile-data.js';
import { tileDescription } from '../src/tile-descriptions.js';
import { RARITIES } from '../src/rarity.js';
import { AI_MODES } from '../src/opponent-ai.js';
import { PAIR_CHAIN_NAMES, TURNING_POINTS } from '../src/duel-progress.js';
import { DEFAULT_PROFILE, profileError } from '../src/profile-store.js';

const languageAtImport = getLanguage();
const dictionaryGroups = { common, achievements, economy, collection };
function memoryStorage(initial) {
  const values = new Map(initial == null ? [] : [[LANGUAGE_STORAGE_KEY, initial]]);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function covered(source, context) {
  assert.equal(typeof source, 'string', `${context}: source exists`);
  assert.ok(Object.hasOwn(TURKISH_MESSAGES, source), `${context}: ${source}`);
  assert.ok(TURKISH_MESSAGES[source].trim(), `${context}: nonempty translation`);
}
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
afterEach(() => setLanguage('tr', memoryStorage()));

test('new profiles start in Turkish and only Turkish and English are selectable', () => {
  assert.equal(languageAtImport, 'tr');
  assert.equal(loadLanguage(memoryStorage()), 'tr');
  assert.equal(locale(), 'tr-TR');
  assert.deepEqual(LANGUAGES, [{ id: 'tr', label: 'Türkçe' }, { id: 'en', label: 'English' }]);
  assert.equal(t('Achievements'), 'Başarımlar');
  assert.equal(t('AP'), 'BP');
});

test('English selection persists and a fresh locale module restores it on reload', async () => {
  const storage = memoryStorage();
  setLanguage('en', storage);
  assert.equal(getLanguage(), 'en');
  assert.equal(locale(), 'en-US');
  assert.equal(storage.getItem(LANGUAGE_STORAGE_KEY), '"en"');
  assert.equal(loadLanguage(storage), 'en');
  assert.equal(t('Achievements'), 'Achievements');
  assert.equal(t('{count} AP', { count: 1500 }), '1,500 AP');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const reloaded = await import('../src/i18n.js?test=english-reload');
    assert.equal(reloaded.getLanguage(), 'en');
    assert.equal(reloaded.t('AP'), 'AP');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
  setLanguage('tr', storage);
  assert.equal(loadLanguage(storage), 'tr');
  assert.equal(t('{count} AP', { count: 1500 }), '1.500 BP');
});

test('unsupported, malformed and non-string stored preferences safely resolve to Turkish', () => {
  for (const raw of ['fr', 'EN', '"de"', '{', '{}', '[]', 'null', 'true', '42', '"tr-TR"', '"__proto__"']) {
    assert.equal(loadLanguage(memoryStorage(raw)), 'tr', raw);
  }
  for (const raw of ['en', '"en"']) assert.equal(loadLanguage(memoryStorage(raw)), 'en');
  for (const raw of ['tr', '"tr"']) assert.equal(loadLanguage(memoryStorage(raw)), 'tr');
  for (const value of [null, undefined, '', 'EN', 'fr', 1, {}, ['en']]) {
    assert.equal(normalizeLanguage(value), 'tr');
    setLanguage(value, memoryStorage());
    assert.equal(getLanguage(), 'tr');
  }
});

test('blocked storage never prevents changing the language for the current visit', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadLanguage(blocked), 'tr');
  assert.doesNotThrow(() => setLanguage('en', blocked));
  assert.equal(getLanguage(), 'en');
  assert.doesNotThrow(() => setLanguage('tr', blocked));
  assert.equal(getLanguage(), 'tr');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked property'); } });
    assert.equal(loadLanguage(), 'tr');
    assert.doesNotThrow(() => setLanguage('en'));
    assert.equal(getLanguage(), 'en');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('language subscribers update once per actual change and stop after unsubscribe', () => {
  const storage = memoryStorage(), changes = [];
  const unsubscribe = subscribeLanguage(() => changes.push(getLanguage()));
  try {
    setLanguage('tr', storage);
    setLanguage('en', storage);
    setLanguage('en', storage);
    setLanguage('tr', storage);
    assert.deepEqual(changes, ['en', 'tr']);
    unsubscribe();
    setLanguage('en', storage);
    assert.deepEqual(changes, ['en', 'tr']);
  } finally { unsubscribe(); }
});

test('locale formatting covers numbers, dates, money and country names', () => {
  const date = Date.UTC(2026, 9, 9), options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  assert.equal(formatNumber(12345.6), '12.345,6');
  assert.equal(formatDate(date, options), '9 Ekim 2026');
  assert.equal(formatMoney(1234.5, 'TRY'), '₺1.234,50');
  assert.equal(formatMoney(4.99), '$4,99');
  assert.equal(countryName('DE'), 'Almanya');
  assert.equal(countryName('TR'), 'Türkiye');
  assert.equal(countryName(''), 'Dünya');
  assert.equal(countryName('bad_region'), 'bad_region');
  setLanguage('en', memoryStorage());
  assert.equal(formatNumber(12345.6), '12,345.6');
  assert.equal(formatDate(date, options), 'October 9, 2026');
  assert.equal(formatMoney(4.99), '$4.99');
  assert.equal(countryName('DE'), 'Germany');
  assert.equal(countryName(''), 'Global');
});

test('interpolation formats numbers, preserves supplied names, and falls back safely', () => {
  assert.equal(t('{count} AP', { count: 7500 }), '7.500 BP');
  assert.equal(t('Next: {name}', { name: 'Ada_42' }), 'Sıradaki: Ada_42');
  assert.equal(t('Next: {name}'), 'Sıradaki: {name}');
  assert.equal(t('Unknown {value}', { value: 'unchanged' }), 'Unknown unchanged');
  assert.equal(t(null), '');
  assert.equal(t(undefined), '');
  assert.equal(t('Dancheong'), 'Dancheong');
  assert.equal(t('{count} AP', Object.create({ count: 12 })), '{count} BP');
});

test('all locale dictionaries preserve interpolation variables and agree on shared keys', () => {
  const seen = new Map(), conflicts = [];
  for (const [group, messages] of Object.entries(dictionaryGroups)) {
    for (const [source, translated] of Object.entries(messages)) {
      assert.equal(typeof translated, 'string', `${group}: ${source}`);
      assert.ok(translated.trim(), `${group}: ${source} is empty`);
      assert.deepEqual(placeholders(translated), placeholders(source), `${group}: ${source}`);
      const previous = seen.get(source);
      if (previous && previous.translated !== translated) conflicts.push({ source, first: previous.group, second: group, values: [previous.translated, translated] });
      else seen.set(source, { group, translated });
    }
  }
  assert.deepEqual(conflicts, [], 'A shared source string must not change meaning with dictionary merge order');
});

test('all 74 achievement milestones, 43 families and frame rewards have complete Turkish copy', () => {
  assert.equal(ACHIEVEMENTS.length, 74);
  assert.equal(ACHIEVEMENT_FAMILIES.length, 43);
  for (const item of ACHIEVEMENTS) for (const field of ['name', 'description']) covered(item[field], `${item.id} ${field}`);
  for (const family of ACHIEVEMENT_FAMILIES) for (const field of ['name', 'description', 'category']) covered(family[field], `${family.id} ${field}`);
  for (const shelf of ACHIEVEMENT_SHELVES) for (const field of ['name', 'description']) covered(shelf[field], `${shelf.id} ${field}`);
  for (const frame of AVATAR_FRAMES) for (const field of ['name', 'description']) covered(frame[field], `${frame.id} frame ${field}`);
  for (const league of LEAGUES) covered(league.name, `${league.id} league`);
});

test('every daily quest and purchasable package has Turkish display copy', () => {
  for (const quest of DAILY_QUEST_POOL) {
    covered(quest.title, `${quest.id} title`);
    covered(quest.description, `${quest.id} description`);
    covered(quest.difficulty[0].toUpperCase() + quest.difficulty.slice(1), `${quest.id} difficulty`);
  }
  for (const pack of [...SHOP_CURRENCY_PACKS, ...SHOP_BOOSTER_PACKS]) {
    covered(pack.name, `${pack.id} name`);
    covered(pack.description, `${pack.id} description`);
  }
});

test('every active theme, rarity and all 160 collectible names and descriptions are translated', () => {
  let tiles = 0;
  for (const theme of themes) {
    covered(theme.name, `${theme.id} name`);
    covered(theme.caption, `${theme.id} caption`);
    const ruleset = rulesetForTheme(theme.id);
    for (const tile of themeTileSets[theme.id][ruleset]) {
      covered(tile.name, `${tile.matchKey} name`);
      covered(tileDescription(theme.id, ruleset, tile.id), `${tile.matchKey} description`);
      tiles++;
    }
  }
  assert.equal(tiles, 160);
  for (const rarity of RARITIES) covered(rarity.label, `${rarity.id} rarity`);
});

test('the full daily greeting rotation stays translated and never repeats a complete message', () => {
  const greetings = new Set();
  for (let day = 1; day <= 4096; day++) {
    const { line1, line2 } = getDailyEncouragement(day);
    covered(line1, `day ${day} opening`);
    covered(line2, `day ${day} invitation`);
    greetings.add(`${t(line1)}\n${t(line2)}`);
  }
  assert.equal(greetings.size, 4096);
  covered('Make day {day} your own.', 'greetings beyond the fixed rotation');
  assert.notEqual(t('Make day {day} your own.', { day: 4097 }), t('Make day {day} your own.', { day: 4098 }));
});

test('dynamic common copy covers every AI profile, streak and profile validation message', () => {
  for (const mode of AI_MODES) {
    covered(mode.label, `${mode.id} AI name`);
    covered(mode.description, `${mode.id} AI description`);
  }
  for (const name of PAIR_CHAIN_NAMES) covered(name, 'pair-chain celebration');
  for (const [id, turningPoint] of Object.entries(TURNING_POINTS)) {
    covered(turningPoint.name, `${id} title`);
    covered(turningPoint.subtitle, `${id} subtitle`);
  }
  const invalidProfiles = [null, { ...DEFAULT_PROFILE, name: '' }, { ...DEFAULT_PROFILE, name: 'a'.repeat(17) },
    { ...DEFAULT_PROFILE, avatarId: 'missing' }, { ...DEFAULT_PROFILE, countryCode: 'invalid' },
    { ...DEFAULT_PROFILE, frameId: 'missing' }, { ...DEFAULT_PROFILE, frameId: 'celestial' }];
  for (const profile of invalidProfiles) covered(profileError(profile, 0), 'profile validation');
});
