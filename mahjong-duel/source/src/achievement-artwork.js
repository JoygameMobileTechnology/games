const atlas = './assets/remake/achievement-trophies.png';
let atlasUrl;
let preparation;
let preparedImage;

/** Keep one short image URL for the page lifetime, including the offline build. */
export function getTrophyAtlasUrl() {
  if (atlasUrl) return atlasUrl;
  if (!atlas.startsWith('data:') || typeof URL.createObjectURL !== 'function') return (atlasUrl = atlas);
  // Packaging embeds the PNG once. Do not copy that entire data URL into every
  // trophy's inline style: CSS parsing then stalls every gallery mount.
  const binary = atob(atlas.slice(atlas.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  atlasUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  return atlasUrl;
}

/** Warm once during menu idle time; failure must never block opening the page. */
export function prepareAchievementArtwork() {
  if (preparedImage) return Promise.resolve(true);
  if (preparation) return preparation;
  const image = new Image();
  image.decoding = 'async';
  image.fetchPriority = 'low';
  let loaded;
  if (typeof image.decode === 'function') {
    image.src = getTrophyAtlasUrl();
    loaded = image.decode();
  } else {
    loaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = getTrophyAtlasUrl();
    });
  }
  preparation = loaded.then(() => {
    // Retain the prepared image so reopening can reuse its decoded artwork.
    preparedImage = image;
    return true;
  }, () => {
    preparation = null;
    return false;
  });
  return preparation;
}
