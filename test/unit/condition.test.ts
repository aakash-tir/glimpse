import { describe, it, expect } from 'vitest';
import { conditionToGlyph, type Condition } from '../../src/shared/condition';

const cases: Array<{ condition: Condition; day: string; night: string }> = [
  { condition: 'clear', day: 'WiDaySunny', night: 'WiNightClear' },
  { condition: 'partly-cloudy', day: 'WiDayCloudy', night: 'WiNightAltCloudy' },
  { condition: 'cloudy', day: 'WiCloudy', night: 'WiCloudy' },
  { condition: 'fog', day: 'WiDayFog', night: 'WiNightFog' },
  { condition: 'drizzle', day: 'WiDayShowers', night: 'WiNightAltShowers' },
  { condition: 'rain', day: 'WiDayRain', night: 'WiNightAltRain' },
  { condition: 'snow', day: 'WiDaySnow', night: 'WiNightAltSnow' },
  { condition: 'sleet', day: 'WiDaySleet', night: 'WiNightAltSleet' },
  {
    condition: 'thunderstorm',
    day: 'WiDayThunderstorm',
    night: 'WiNightAltThunderstorm',
  },
];

describe('conditionToGlyph', () => {
  for (const { condition, day, night } of cases) {
    it(`${condition} (day) → ${day}`, () => {
      expect(conditionToGlyph(condition, true)).toBe(day);
    });
    it(`${condition} (night) → ${night}`, () => {
      expect(conditionToGlyph(condition, false)).toBe(night);
    });
  }
});
