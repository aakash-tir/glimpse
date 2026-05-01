// Internal weather-condition union used by the renderer.
// The full WMO-code → Condition mapping arrives in M5 / data-sources.md;
// for M1 the renderer just needs a stable shape to drive the icon glyph.
export type Condition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'sleet'
  | 'thunderstorm';

export type IconGlyphName =
  | 'WiDaySunny'
  | 'WiNightClear'
  | 'WiDayCloudy'
  | 'WiNightAltCloudy'
  | 'WiCloudy'
  | 'WiDayFog'
  | 'WiNightFog'
  | 'WiDayShowers'
  | 'WiNightAltShowers'
  | 'WiDayRain'
  | 'WiNightAltRain'
  | 'WiDaySnow'
  | 'WiNightAltSnow'
  | 'WiDaySleet'
  | 'WiNightAltSleet'
  | 'WiDayThunderstorm'
  | 'WiNightAltThunderstorm';

export function conditionToGlyph(condition: Condition, isDay: boolean): IconGlyphName {
  switch (condition) {
    case 'clear':
      return isDay ? 'WiDaySunny' : 'WiNightClear';
    case 'partly-cloudy':
      return isDay ? 'WiDayCloudy' : 'WiNightAltCloudy';
    case 'cloudy':
      return 'WiCloudy';
    case 'fog':
      return isDay ? 'WiDayFog' : 'WiNightFog';
    case 'drizzle':
      return isDay ? 'WiDayShowers' : 'WiNightAltShowers';
    case 'rain':
      return isDay ? 'WiDayRain' : 'WiNightAltRain';
    case 'snow':
      return isDay ? 'WiDaySnow' : 'WiNightAltSnow';
    case 'sleet':
      return isDay ? 'WiDaySleet' : 'WiNightAltSleet';
    case 'thunderstorm':
      return isDay ? 'WiDayThunderstorm' : 'WiNightAltThunderstorm';
  }
}
