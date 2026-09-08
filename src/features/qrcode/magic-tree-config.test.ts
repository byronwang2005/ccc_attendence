import { describe, expect, it } from 'vitest';
import { cameraEase, TREE_TRANSITION_SECONDS, advanceTreeTransition, nearestDarkCell, treeRandom, treeTransition, treeWind, qrProtectedCells, qrModuleColors, canopyCoverage, meadowDensity, TREE_PALETTE } from './magic-tree-config';

describe('autumn reveal choreography', () => {
  it('uses a two-second Core Animation ease-in-out camera path', () => {
    expect(TREE_TRANSITION_SECONDS).toBe(2);
    expect(cameraEase(0)).toBe(0);
    expect(cameraEase(.25)).toBeCloseTo(.1291619, 6);
    expect(cameraEase(.5)).toBeCloseTo(.5);
    expect(cameraEase(.75)).toBeCloseTo(.8708381, 6);
    expect(cameraEase(1)).toBe(1);
    expect(advanceTreeTransition(0, 1, 1, false)).toBe(.5);
    expect(advanceTreeTransition(.5, 1, 1, false)).toBe(1);
  });
  it('overlaps gathering with the camera, completes before the last frames and stays continuous during reversal', () => {
    expect(treeTransition(.25).settle).toBe(0);
    expect(treeTransition(.8).settle).toBeGreaterThan(0);
    expect(treeTransition(1)).toEqual({ camera: 1, settle: 1 });
    const forward = advanceTreeTransition(.8, 1, .016, false);
    const reverse = advanceTreeTransition(forward, 0, .016, false);
    expect(reverse).toBeCloseTo(.8);
    expect(advanceTreeTransition(.99, 1, 1, false)).toBe(1);
    expect(advanceTreeTransition(.01, 0, 1, false)).toBe(0);
  });
  it('staggered cohorts finish smoothly before the endpoint', () => {
    expect(treeTransition(.4, 0).settle).toBeGreaterThan(treeTransition(.4, 1).settle);
    expect(treeTransition(.95, 1).settle).toBe(1);
    expect(treeTransition(.94, 1).settle).toBeGreaterThan(.998);
  });
  it('protects finder, timing, format, version and alignment cells', () => {
    const v1 = qrProtectedCells(21);
    expect(v1[3][3]).toBe(true); expect(v1[6][12]).toBe(true); expect(v1[12][12]).toBe(false);
    const v2 = qrProtectedCells(25);
    expect(v2[18][18]).toBe(true); expect(v2[20][20]).toBe(true);
    const v7 = qrProtectedCells(45);
    expect(v7[22][22]).toBe(true); expect(v7[0][35]).toBe(true);
    const v32 = qrProtectedCells(145);
    expect(v32[86][86]).toBe(true);
    expect(qrProtectedCells(177)[170][170]).toBe(true);
  });
  it('jumps directly to either endpoint for reduced motion', () => {
    expect(advanceTreeTransition(.3, 1, 0, true)).toBe(1);
    expect(advanceTreeTransition(.8, 0, 0, true)).toBe(0);
  });
  it('assigns local dark destinations and produces deterministic but varying wind', () => {
    const destination = nearestDarkCell([[false, true], [true, false]], .4, -.4, 2);
    expect(destination).toMatchObject({ x: .5, z: -.5 });
    expect(destination.distance).toBeLessThan(.15);
    const a = treeRandom(), b = treeRandom();
    expect(Array.from({ length: 10 }, a)).toEqual(Array.from({ length: 10 }, b));
    expect(treeWind(0, 1, 2)).not.toBe(treeWind(1, 1, 2));
    expect(treeWind(1, 1, 2)).not.toBe(treeWind(1, 3, 2));
  });
});


describe('autumn distribution and scan colors', () => {
  it('reduces grass to 6% under the canopy and blends into the open meadow', () => {
    const centers = [{ x: 0, z: 0 }];
    expect(canopyCoverage(0, 0, centers)).toBe(1);
    expect(meadowDensity(0, 0, centers)).toBeCloseTo(.06);
    expect(meadowDensity(1.2, 0, centers)).toBe(1);
    expect(meadowDensity(.7, 0, centers)).toBeGreaterThan(.06);
    expect(meadowDensity(.7, 0, centers)).toBeLessThan(1);
    expect(meadowDensity(.701, 0, centers) - meadowDensity(.7, 0, centers)).toBeLessThan(.005);
    expect(meadowDensity(0, 0, [...centers, ...centers])).toBeCloseTo(.06);
  });
  it('places soft gold on the top-left/bottom-right and warm leaves on the opposite diagonal', () => {
    const colors = qrModuleColors(177);
    const brightness = (x: number, y: number) => {
      const channels = [1, 3, 5].map(offset => parseInt(colors[y][x].slice(offset, offset + 2), 16));
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const redness = (x: number, y: number) => parseInt(colors[y][x].slice(1, 3), 16) - parseInt(colors[y][x].slice(3, 5), 16);
    // Honey gold stays darker than the rejected pale yellow, lighter than the meadow.
    // Reuse the softer canopy brown instead of the more saturated Pantone maple.
    expect(TREE_PALETTE.scanLeaf[1]).toBe(TREE_PALETTE.leaf[2]);
    expect(redness(65, 65)).toBeLessThan(65);
    expect(redness(65, 111)).toBeGreaterThan(45);
    expect(redness(0, 0)).toBeLessThan(38);
    for (const [x, y] of [[65, 65], [111, 111]]) expect(brightness(x, y)).toBeGreaterThan(145);
    for (const [x, y] of [[65, 111], [111, 65]]) expect(brightness(x, y)).toBeLessThan(130);
    // Band midpoint mixes the families; no abrupt brightness jump across the center line.
    expect(brightness(88, 65)).toBeGreaterThan(125);
    expect(brightness(88, 65)).toBeLessThan(145);
    expect(Math.abs(brightness(87, 65) - brightness(89, 65))).toBeLessThan(20);
    expect(Math.abs(brightness(65, 87) - brightness(65, 89))).toBeLessThan(20);
  });
  it.each([21, 37, 41, 45, 177])('uses deterministic, contrasting neighbors with leaf centers and grass edges at size %i', size => {
    const colors = qrModuleColors(size);
    expect(colors).toEqual(qrModuleColors(size));
    colors.forEach((row, y) => row.forEach((color, x) => {
      const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
      const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      expect(luminance).toBeGreaterThan(108); expect(luminance).toBeLessThan(156);
      for (const neighbor of [row[x - 1], colors[y - 1]?.[x]].filter(Boolean)) {
        const other = [1, 3, 5].map(offset => parseInt(neighbor.slice(offset, offset + 2), 16));
        // A one-channel rounding difference is not enough: the jump must remain visible.
        expect(Math.hypot(...rgb.map((value, i) => value - other[i]))).toBeGreaterThanOrEqual(14);
      }
      if (y && x) expect(color).not.toBe(colors[y - 1][x - 1]);
      if (y && x < size - 1) expect(color).not.toBe(colors[y - 1][x + 1]);
      if (!x || !y || x === size - 1 || y === size - 1) expect(TREE_PALETTE.scanGrass).toContain(color);
    }));
  });
});
