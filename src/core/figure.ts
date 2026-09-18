/**
 * Geometry of the body figure (components/BodyFigure.svelte): a front-view silhouette
 * whose height follows the person's height and whose width follows their body mass index.
 * Pure so it can be unit-tested; the component only draws the paths it returns.
 */
import type { Sex } from './types.ts';
import { bmi } from './weight.ts';

export const FIGURE_WIDTH = 200;
export const FIGURE_HEIGHT = 400;

/** Reference person: 175 cm, BMI 22. */
const REFERENCE_HEIGHT_CM = 175;
const REFERENCE_BMI = 22;

export interface FigureInput {
  sex: Sex;
  heightCm: number;
  weightKg: number;
}

export interface Limb {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface Figure {
  head: { cx: number; cy: number; r: number };
  neck: { x: number; y: number; width: number; height: number };
  /** SVG path of the torso, from the shoulders to the crotch. */
  torso: string;
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  /** Overall scale factors, useful for labels and tests. */
  heightScale: number;
  widthScale: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;

export function buildFigure({ sex, heightCm, weightKg }: FigureInput): Figure {
  // Height differences between people are modest; keep the figure inside the canvas.
  const heightScale = clamp(heightCm / REFERENCE_HEIGHT_CM, 0.8, 1.12);
  const widthScale = clamp((bmi(weightKg, heightCm) ?? REFERENCE_BMI) / REFERENCE_BMI, 0.7, 2.2);

  const female = sex === 'female';
  const centre = FIGURE_WIDTH / 2;
  const bottom = FIGURE_HEIGHT - 12;
  const total = 340 * heightScale;
  const top = bottom - total;

  const headR = 22 * clamp(heightScale, 0.95, 1.05);
  const neckH = 10;
  const shoulderY = top + headR * 2 + neckH;
  const torsoH = total * 0.38;
  const chestY = shoulderY + torsoH * 0.3;
  const waistY = shoulderY + torsoH * 0.62;
  const hipY = shoulderY + torsoH * 0.9;
  const crotchY = shoulderY + torsoH;

  // Half-widths. Fat accumulates mostly around the waist, so it grows fastest.
  const wide = (base: number, exponent: number) => base * widthScale ** exponent;
  const shoulder = wide(female ? 34 : 40, 0.5);
  const chest = wide(female ? 32 : 36, 0.9);
  const waist = wide(female ? 22 : 27, 1.45);
  const hip = wide(female ? 34 : 30, 1.05);
  const crotch = hip * 0.55;

  const neckHalf = 7;
  const neckBottom = shoulderY - 4;
  const r = round;
  // Rounded shoulders, then smooth curves through the chest, waist and hips.
  const side = (sign: 1 | -1) => {
    const x = (value: number) => r(centre + sign * value);
    return [
      `C${x(shoulder * 0.55)},${r(neckBottom)} ${x(shoulder)},${r(shoulderY)} ${x(shoulder)},${r(shoulderY + 14)}`,
      `C${x(chest)},${r(chestY)} ${x(waist)},${r(waistY - 12)} ${x(waist)},${r(waistY)}`,
      `C${x(waist)},${r(waistY + 12)} ${x(hip)},${r(hipY - 14)} ${x(hip)},${r(hipY)}`,
      `C${x(hip)},${r(hipY + 16)} ${x(crotch * 1.3)},${r(crotchY)} ${x(crotch)},${r(crotchY)}`,
    ];
  };
  const left = side(-1);
  const torso = [
    `M${r(centre - neckHalf)},${r(neckBottom)}`,
    ...left,
    `L${r(centre + crotch)},${r(crotchY)}`,
    // Mirror: walk the right side upwards by reversing the curve order and control points.
    `C${r(centre + crotch * 1.3)},${r(crotchY)} ${r(centre + hip)},${r(hipY + 16)} ${r(centre + hip)},${r(hipY)}`,
    `C${r(centre + hip)},${r(hipY - 14)} ${r(centre + waist)},${r(waistY + 12)} ${r(centre + waist)},${r(waistY)}`,
    `C${r(centre + waist)},${r(waistY - 12)} ${r(centre + chest)},${r(chestY)} ${r(centre + shoulder)},${r(shoulderY + 14)}`,
    `C${r(centre + shoulder)},${r(shoulderY)} ${r(centre + shoulder * 0.55)},${r(neckBottom)} ${r(centre + neckHalf)},${r(neckBottom)}`,
    'Z',
  ].join(' ');

  const armWidth = wide(14, 0.75);
  const legWidth = wide(20, 0.85);
  const armLength = total * 0.4;
  const handY = shoulderY + 14 + armLength;
  // Arms hang just outside the torso and drift slightly outwards towards the hands.
  const armTop = shoulder + armWidth * 0.55;
  // Keep the hands inside the canvas for very heavy figures.
  const armBottom = Math.min(armTop + 6 + waist * 0.2, centre - armWidth / 2 - 2);
  const legX = crotch * 0.6 + legWidth * 0.35;

  const limb = (x1: number, y1: number, x2: number, y2: number, width: number): Limb => ({
    x1: round(x1),
    y1: round(y1),
    x2: round(x2),
    y2: round(y2),
    width: round(width),
  });

  return {
    head: { cx: centre, cy: round(top + headR), r: round(headR) },
    neck: { x: round(centre - 7), y: round(top + headR * 2 - 4), width: 14, height: neckH + 4 },
    torso,
    arms: [
      limb(centre - armTop, shoulderY + 14, centre - armBottom, handY, armWidth),
      limb(centre + armTop, shoulderY + 14, centre + armBottom, handY, armWidth),
    ],
    legs: [
      limb(centre - legX, crotchY - 8, centre - legX - 3, bottom - legWidth / 2, legWidth),
      limb(centre + legX, crotchY - 8, centre + legX + 3, bottom - legWidth / 2, legWidth),
    ],
    heightScale,
    widthScale,
  };
}
