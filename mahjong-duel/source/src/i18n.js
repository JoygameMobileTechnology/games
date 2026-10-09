import common from './locales/tr-common.js';
import achievements from './locales/tr-achievements.js';
import economy from './locales/tr-economy.js';
import collection from './locales/tr-collection.js';

export const LANGUAGE_STORAGE_KEY = 'porcelain:language';
export const LANGUAGES = Object.freeze([{ id: 'tr', label: 'Türkçe' }, { id: 'en', label: 'English' }]);
export const TURKISH_MESSAGES = Object.freeze({ ...common, ...achievements, ...economy, ...collection });
export const normalizeLanguage = value => value === 'en' ? 'en' : 'tr';
export function loadLanguage(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeLanguage(raw === 'en' || raw === 'tr' ? raw : JSON.parse(raw ?? 'null'));
  } catch { return 'tr'; }
}
let language = loadLanguage();
const listeners = new Set();
export const getLanguage = () => language;
export const locale = () => language === 'tr' ? 'tr-TR' : 'en-US';
export function subscribeLanguage(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setLanguage(value, storage) {
  const next = normalizeLanguage(value);
  try { (storage ?? globalThis.localStorage)?.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(next)); } catch { /* The choice still applies during this visit. */ }
  if (next !== language) { language = next; listeners.forEach(listener => listener()); }
}
export function formatNumber(value, options = {}) { return new Intl.NumberFormat(locale(), options).format(value); }
export function formatDate(value, options = {}) { return new Intl.DateTimeFormat(locale(), options).format(new Date(value)); }
export function formatMoney(value, currency = 'USD') { return formatNumber(value, { style: 'currency', currency }); }
export function countryName(code) {
  if (!code) return t('Global');
  try { return new Intl.DisplayNames([locale()], { type: 'region' }).of(code); } catch { return code; }
}
/** English source copy doubles as the key. IDs and saved game data never change. */
export function t(source, values = {}) {
  if (source == null) return '';
  const text = String(source);
  const translated = language === 'tr' && Object.hasOwn(TURKISH_MESSAGES, text) ? TURKISH_MESSAGES[text] : text;
  return translated.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key)
    ? typeof values[key] === 'number' ? formatNumber(values[key]) : String(values[key])
    : match);
}
