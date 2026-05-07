import { describe, it, expect } from 'vitest';
import { conditionToGlyph } from '../../src/shared/condition';
import { WMO_CODES, wmoToCondition } from '../../src/shared/wmo';

describe('wmoToCondition', () => {
  for (const code of WMO_CODES) {
    it(`code ${code} maps to a defined Condition that resolves to non-empty glyphs`, () => {
      const condition = wmoToCondition(code);
      // The mapping must produce a Condition that conditionToGlyph
      // recognises in both day and night variants — i.e. the icon
      // pipeline can actually render this code.
      const dayGlyph = conditionToGlyph(condition, true);
      const nightGlyph = conditionToGlyph(condition, false);
      expect(dayGlyph.length).toBeGreaterThan(0);
      expect(nightGlyph.length).toBeGreaterThan(0);
    });
  }

  it('falls back to cloudy for unknown codes', () => {
    expect(wmoToCondition(-1)).toBe('cloudy');
    expect(wmoToCondition(7)).toBe('cloudy');
    expect(wmoToCondition(101)).toBe('cloudy');
  });

  it('clear-sky family resolves to clear', () => {
    expect(wmoToCondition(0)).toBe('clear');
    expect(wmoToCondition(1)).toBe('clear');
  });

  it('overcast (3) resolves to cloudy, partly-cloudy (2) to partly-cloudy', () => {
    expect(wmoToCondition(2)).toBe('partly-cloudy');
    expect(wmoToCondition(3)).toBe('cloudy');
  });

  it('freezing variants resolve to sleet', () => {
    expect(wmoToCondition(56)).toBe('sleet');
    expect(wmoToCondition(57)).toBe('sleet');
    expect(wmoToCondition(66)).toBe('sleet');
    expect(wmoToCondition(67)).toBe('sleet');
  });

  it('thunderstorm with hail still classified as thunderstorm', () => {
    expect(wmoToCondition(95)).toBe('thunderstorm');
    expect(wmoToCondition(96)).toBe('thunderstorm');
    expect(wmoToCondition(99)).toBe('thunderstorm');
  });
});
