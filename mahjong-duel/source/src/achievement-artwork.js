import { STANDALONE_TROPHY_ART } from './achievement-standalone-art.js';
import { MILESTONE_TROPHY_ART } from './achievement-milestone-art.js';

const atlas = './assets/remake/achievement-trophies.png';
const imageUrls = new Map();
const preparations = new Map();
const preparedImages = new Map();

/** Keep one short image URL for the page lifetime, including the offline build. */
function getArtworkUrl(source) {
  if (imageUrls.has(source)) return imageUrls.get(source);
  if (!source.startsWith('data:') || typeof URL.createObjectURL !== 'function') return source;
  // Packaging embeds each image once. Do not copy that entire data URL into every
  // trophy's inline style: CSS parsing then stalls every gallery mount.
  const binary = atob(source.slice(source.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  const type = source.slice(5, source.indexOf(';'));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  imageUrls.set(source, url);
  return url;
}

export function getTrophyAtlasUrl() {
  return getArtworkUrl(atlas);
}

export function getStandaloneTrophyUrl(artKey) {
  return Object.hasOwn(STANDALONE_TROPHY_ART, artKey) ? getArtworkUrl(STANDALONE_TROPHY_ART[artKey]) : null;
}

export function getMilestoneTrophyUrl(artKey) {
  return Object.hasOwn(MILESTONE_TROPHY_ART, artKey) ? getArtworkUrl(MILESTONE_TROPHY_ART[artKey]) : null;
}

/** Warm once during menu idle time; failure must never block opening the page. */
function prepareArtwork(source) {
  if (preparedImages.has(source)) return Promise.resolve(true);
  if (preparations.has(source)) return preparations.get(source);
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'low';
  let loaded;
  if (typeof image.decode === 'function') {
    image.src = getArtworkUrl(source);
    loaded = image.decode();
  } else {
    loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = getArtworkUrl(source);
    });
  }
  const preparation = loaded.then(() => {
    // Retain the prepared image so reopening can reuse its decoded artwork.
    preparedImages.set(source, image);
    return true;
  }, () => {
    preparations.delete(source);
    return false;
  });
  preparations.set(source, preparation);
  return preparation;
}

export function prepareAchievementArtwork() {
  // Other standalone trophies stay lazy with their shelves.
  return Promise.all([atlas, STANDALONE_TROPHY_ART['unassisted-win'], STANDALONE_TROPHY_ART['strong-finish'], STANDALONE_TROPHY_ART['front-runner']]
    .map(prepareArtwork)).then(results => results.every(Boolean));
}
