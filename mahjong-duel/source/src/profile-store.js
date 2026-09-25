export const PROFILE_STORAGE_KEY = 'porcelain:profile';
export const AVATAR_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `avatar-${index + 1}`));
export const DEFAULT_PROFILE = Object.freeze({ version: 1, name: 'Player', avatarId: 'avatar-1', countryCode: '' });

const countryCodes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const countrySet = new Set(countryCodes);
let regionNames;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* Country codes remain readable on older browsers. */ }

export function countryFlag(code) {
  if (!countrySet.has(code)) return '🌐';
  return [...code].map(letter => String.fromCodePoint(0x1f1e6 + letter.charCodeAt(0) - 65)).join('');
}

export const COUNTRIES = Object.freeze(countryCodes.map(code => Object.freeze({
  code, name: regionNames?.of(code) || code, flag: countryFlag(code),
})).sort((first, second) => first.name.localeCompare(second.name, 'en')));

function cleanName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim() : '';
}

export function profileError(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Please choose your player details.';
  const name = cleanName(value.name);
  if (!name) return 'Enter a player name.';
  if (Array.from(name).length > 16) return 'Keep your name to 16 characters.';
  if (!AVATAR_IDS.includes(value.avatarId)) return 'Choose one of the eight avatars.';
  if (value.countryCode !== '' && !countrySet.has(value.countryCode)) return 'Choose a country from the list.';
  return '';
}

export function normalizeProfile(value) {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    version: 1,
    name: Array.from(cleanName(candidate.name)).slice(0, 16).join('') || DEFAULT_PROFILE.name,
    avatarId: AVATAR_IDS.includes(candidate.avatarId) ? candidate.avatarId : DEFAULT_PROFILE.avatarId,
    countryCode: countrySet.has(candidate.countryCode) ? candidate.countryCode : '',
  };
}

export function loadProfile(storage) {
  try {
    const raw = JSON.parse((storage ?? globalThis.localStorage)?.getItem(PROFILE_STORAGE_KEY) ?? 'null');
    return raw?.version === 1 ? normalizeProfile(raw) : { ...DEFAULT_PROFILE };
  } catch { return { ...DEFAULT_PROFILE }; }
}

/** Returns false if validation or browser persistence fails. Never clears other keys. */
export function saveProfile(value, storage) {
  if (profileError(value)) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizeProfile(value)));
    return true;
  } catch { return false; }
}
