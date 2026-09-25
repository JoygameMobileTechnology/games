const X_DEPTH = .07;
const Y_DEPTH = .10;
const TILE_HEIGHT = 1.3;
const PADDING = .10;

// Include removed stones so the view never zooms or shifts during a match.
export function boardMetrics(tiles = []) {
  if (!tiles.length) return { left: 0, top: 0, width: 6.2, height: 9.5 };
  const xs = tiles.map(tile => tile.x - tile.z * X_DEPTH);
  const ys = tiles.map(tile => tile.y * TILE_HEIGHT - tile.z * Y_DEPTH);
  const left = Math.min(...xs) - PADDING, top = Math.min(...ys) - PADDING;
  return { left, top, width: Math.max(...xs) + 1 + PADDING - left,
    height: Math.max(...ys) + TILE_HEIGHT + PADDING * 2 - top };
}

export function tilePosition(tile, board) {
  return { left: `${(tile.x - tile.z * X_DEPTH - board.left) / board.width * 100}%`,
    top: `${(tile.y * TILE_HEIGHT - tile.z * Y_DEPTH - board.top) / board.height * 100}%`,
    width: `${100 / board.width}%`, height: `${TILE_HEIGHT / board.height * 100}%` };
}
