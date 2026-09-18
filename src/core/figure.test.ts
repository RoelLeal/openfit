import { describe, expect, it } from 'vitest';
import { buildFigure, FIGURE_HEIGHT, FIGURE_WIDTH } from './figure.ts';

const base = { sex: 'male' as const, heightCm: 175, weightKg: 67 };

describe('buildFigure', () => {
  it('uses the reference scale for the reference person', () => {
    const figure = buildFigure(base);
    expect(figure.heightScale).toBeCloseTo(1, 2);
    expect(figure.widthScale).toBeCloseTo(1, 1);
  });

  it('grows taller with height and wider with weight, within the canvas', () => {
    const tall = buildFigure({ ...base, heightCm: 195 });
    const short = buildFigure({ ...base, heightCm: 150 });
    expect(tall.head.cy).toBeLessThan(short.head.cy);

    const heavy = buildFigure({ ...base, weightKg: 120 });
    expect(heavy.widthScale).toBeGreaterThan(1.5);
    expect(heavy.legs[0].width).toBeGreaterThan(buildFigure(base).legs[0].width);
    for (const figure of [
      heavy,
      tall,
      short,
      buildFigure({ ...base, heightCm: 210, weightKg: 200 }),
    ]) {
      expect(figure.head.cy - figure.head.r).toBeGreaterThanOrEqual(0);
      expect(figure.legs[1].y2 + figure.legs[1].width / 2).toBeLessThanOrEqual(FIGURE_HEIGHT);
      expect(figure.arms[1].x2 + figure.arms[1].width / 2).toBeLessThanOrEqual(FIGURE_WIDTH);
    }
  });

  it('gives female and male figures different proportions', () => {
    const female = buildFigure({ ...base, sex: 'female' });
    const male = buildFigure(base);
    expect(female.torso).not.toBe(male.torso);
    // Wider hips relative to shoulders for the female figure.
    expect(female.legs[1].x1 - female.legs[0].x1).toBeGreaterThan(
      male.legs[1].x1 - male.legs[0].x1,
    );
  });

  it('tolerates nonsense input by clamping', () => {
    const figure = buildFigure({ ...base, heightCm: 1, weightKg: 1000 });
    expect(figure.widthScale).toBe(2.2);
    expect(figure.heightScale).toBe(0.8);
  });
});
