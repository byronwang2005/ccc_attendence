const rgb = (color: string) => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
const hex = (channels: number[]) => '#' + channels.map(value => Math.round(value).toString(16).padStart(2, '0')).join('').toUpperCase();
const blend = (a: number[], b: number[], amount: number) => a.map((value, i) => value * (1 - amount) + b[i] * amount);
const leafColors = ['#E6B65B', '#D99350', '#BC713C', '#ECCB75', '#C98347'] as const;

// Vary hue within each family while keeping luminance stable for local QR thresholding.
const scanVariants = (color: string) => Array.from({ length: 9 }, (_, i) => {
  const angle = i * Math.PI * 2 / 9;
  const red = Math.cos(angle) * 20, blue = Math.sin(angle) * 20;
  const offsets = [red, -(red * .2126 + blue * .0722) / .7152, blue];
  return hex(rgb(color).map((value, channel) => value + offsets[channel]));
});
const colorDistance = (a: string, b: string) => Math.hypot(...rgb(a).map((value, i) => value - rgb(b)[i]));

/** Pantone Golden Apricot / Autumn Maple inspired screen colors, not official conversions. */
export const TREE_PALETTE = {
  background: '#F6F1E7',
  leaf: leafColors,
  grass: ['#CBB666', '#DDC681', '#A69A5D', '#D2B259', '#E2D49C'],
  // Screen samples of the approved TCX chips, with small same-family variations:
  // Honey Mustard 17-1047 (#B59051) and the existing canopy brown,
  // Dried Herb 17-0627 (#847A59). These are not certified Pantone RGB conversions.
  // Preserve their different brightnesses; equalizing them makes gold look like grass.
  scanLeaf: ['#B59051', leafColors[2], leafColors[1], '#BD9859', leafColors[4]],
  scanGrass: scanVariants('#847A59'),
  stone: ['#E2DAC6', '#DED5BD', '#E8DFCC'],
  bark: '#78543D'
} as const;

/** Soft canopy coverage in ground coordinates, independent of the encoded QR. */
export function canopyCoverage(x: number, z: number, centers: ReadonlyArray<{ x: number; z: number }>) {
  let open = 1;
  for (const center of centers) {
    const distance = Math.hypot(x - center.x, z - center.z);
    const t = Math.max(0, Math.min(1, (1.02 - distance) / .64));
    open *= 1 - t * t * (3 - 2 * t);
  }
  return 1 - open;
}

export function meadowDensity(x: number, z: number, centers: ReadonlyArray<{ x: number; z: number }>) {
  return 1 - .94 * canopyCoverage(x, z, centers);
}

// Nine visibly different, low-amplitude variants per family; never reshuffle per frame.
const goldVariants = scanVariants(TREE_PALETTE.scanLeaf[0]).map(rgb);
const warmVariants = scanVariants(TREE_PALETTE.scanLeaf[1]).map(rgb);

/** Two diagonal leaf-color regions soften across 15%-wide bands, then fade to meadow edges. */
export function qrModuleColors(size: number) {
  const random = treeRandom();
  const colors: string[][] = [];
  for (let y = 0; y < size; y++) {
    colors[y] = [];
    for (let x = 0; x < size; x++) {
      const nx = size > 1 ? x / (size - 1) : .5;
      const ny = size > 1 ? y / (size - 1) : .5;
      const horizontal = smooth((nx - .425) / .15);
      const vertical = smooth((ny - .425) / .15);
      const warm = horizontal * (1 - vertical) + (1 - horizontal) * vertical;
      const radius = Math.max(Math.abs(nx - .5), Math.abs(ny - .5)) * 2;
      const meadow = smooth((radius - .45) / .4);
      const neighbors = [colors[y][x - 1], colors[y - 1]?.[x]].filter((color): color is string => !!color);
      const diagonals = [colors[y - 1]?.[x - 1], colors[y - 1]?.[x + 1]];
      const candidates = goldVariants.map((gold, variant) => {
        const leaf = blend(gold, warmVariants[variant], warm);
        return hex(blend(leaf, rgb(TREE_PALETTE.scanGrass[variant]), meadow));
      }).filter(color => !diagonals.includes(color));
      // Comparing final RGB values also protects neighbors inside the blended boundaries.
      const distinct = candidates.filter(color => neighbors.every(neighbor => colorDistance(color, neighbor) >= 14));
      const choices = distinct.length ? distinct : candidates.filter(color => !neighbors.includes(color));
      colors[y][x] = choices[Math.floor(random() * choices.length)];
    }
  }
  return colors;
}

export const TREE_TRANSITION_SECONDS = 2;
export const TREE_SETTLE_START = .25;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
/** Core Animation easeInEaseOut: cubic-bezier(.42, 0, .58, 1). */
export function cameraEase(value: number) {
  const x = Math.max(0, Math.min(1, value));
  let t = x;
  // Invert the Bezier x coordinate before evaluating its y coordinate.
  for (let i = 0; i < 5; i++) {
    t -= (t * (1.26 + t * (-.78 + .52 * t)) - x) / (1.26 + t * (-1.56 + 1.56 * t));
  }
  return t * t * (3 - 2 * t);
}

export function treeTransition(progress: number, cohort = 0) {
  const delay = (.08 + Math.max(0, Math.min(1, cohort)) * .1) / TREE_TRANSITION_SECONDS;
  return {
    camera: cameraEase(progress),
    settle: smooth((progress - TREE_SETTLE_START - delay) / (.95 - TREE_SETTLE_START - delay))
  };
}

/** Continuous across reversals; clamp time jumps when a hidden page resumes. */
export function advanceTreeTransition(current: number, target: number, delta: number, reduced: boolean) {
  return reduced ? target : current + Math.sign(target - current) * Math.min(Math.max(0, delta) / TREE_TRANSITION_SECONDS, Math.abs(target - current));
}

export function treeWind(time: number, x: number, z: number) {
  const gust = .65 + .35 * Math.sin(time * .47);
  return gust * (Math.sin(time * 1.1 + x * 1.4 + z * .65) + .3 * Math.sin(time * 2.3 + z * 2.3));
}

export function treeRandom() {
  let seed = 74819;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

export function nearestDarkCell(modules: boolean[][], x: number, z: number, side: number) {
  const cell = side / modules.length;
  let bestX = 0, bestZ = 0, distance = Infinity;
  modules.forEach((row, iz) => row.forEach((dark, ix) => {
    if (!dark) return;
    const px = (ix - (modules.length - 1) / 2) * cell;
    const pz = (iz - (modules.length - 1) / 2) * cell;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < distance) { distance = d; bestX = px; bestZ = pz; }
  }));
  return { x: bestX, z: bestZ, distance: Math.sqrt(distance) };
}

/** Conservative protection for QR functional patterns, including format/version areas. */
export function qrProtectedCells(size: number) {
  const version = (size - 17) / 4;
  const protectedCells = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const rect = (x: number, y: number, width: number, height: number) => {
    for (let j = Math.max(0, y); j < Math.min(size, y + height); j++)
      for (let i = Math.max(0, x); i < Math.min(size, x + width); i++) protectedCells[j][i] = true;
  };
  rect(0, 0, 9, 9); rect(size - 8, 0, 8, 9); rect(0, size - 8, 9, 8);
  rect(6, 0, 1, size); rect(0, 6, size, 1);
  rect(8, 0, 1, size); rect(0, 8, size, 1);
  if (version >= 7) { rect(size - 11, 0, 3, 6); rect(0, size - 11, 6, 3); }
  if (version > 1) {
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.floor((version * 4 + count * 2 + 1) / (count * 2 - 2)) * 2;
    const centers = [6];
    for (let p = size - 7; centers.length < count; p -= step) centers.splice(1, 0, p);
    centers.forEach((y, j) => centers.forEach((x, i) => {
      if ((i === 0 && j === 0) || (i === 0 && j === count - 1) || (i === count - 1 && j === 0)) return;
      rect(x - 2, y - 2, 5, 5);
    }));
  }
  return protectedCells;
}


/** Fix targets once at construction: nearest cells first, then fill holes from locally redundant particles. */
export function naturalQrTargets(points: ReadonlyArray<{ x: number; z: number }>, modules: boolean[][], side: number) {
  const size = modules.length, cell = side / size;
  const cells: Array<{ x: number; z: number }> = [];
  modules.forEach((row, z) => row.forEach((dark, x) => {
    if (dark) cells.push({ x: (x - (size - 1) / 2) * cell, z: (z - (size - 1) / 2) * cell });
  }));
  if (points.length < cells.length) throw new Error('Not enough foliage to cover the QR');
  const counts = new Int32Array(cells.length);
  const assignment = points.map(point => {
    let best = 0, distance = Infinity;
    cells.forEach((target, index) => {
      const d = (point.x - target.x) ** 2 + (point.z - target.z) ** 2;
      if (d < distance) { best = index; distance = d; }
    });
    counts[best]++;
    return best;
  });
  cells.forEach((target, index) => {
    if (counts[index]) return;
    let best = -1, distance = Infinity;
    points.forEach((point, i) => {
      if (counts[assignment[i]] < 2) return;
      const d = (point.x - target.x) ** 2 + (point.z - target.z) ** 2;
      if (d < distance) { best = i; distance = d; }
    });
    if (best < 0) throw new Error('QR foliage assignment failed');
    counts[assignment[best]]--; counts[index]++; assignment[best] = index;
  });
  return assignment.map(index => cells[index]);
}
