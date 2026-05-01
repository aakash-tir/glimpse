import {
  WiCloudy,
  WiDayCloudy,
  WiDayFog,
  WiDayRain,
  WiDayShowers,
  WiDaySleet,
  WiDaySnow,
  WiDaySunny,
  WiDayThunderstorm,
  WiNightAltCloudy,
  WiNightAltRain,
  WiNightAltShowers,
  WiNightAltSleet,
  WiNightAltSnow,
  WiNightAltThunderstorm,
  WiNightClear,
  WiNightFog,
} from 'react-icons/wi';
import type { IconType } from 'react-icons';
import type { IconGlyphName } from '../../../shared/condition';

const GLYPHS: Record<IconGlyphName, IconType> = {
  WiDaySunny,
  WiNightClear,
  WiDayCloudy,
  WiNightAltCloudy,
  WiCloudy,
  WiDayFog,
  WiNightFog,
  WiDayShowers,
  WiNightAltShowers,
  WiDayRain,
  WiNightAltRain,
  WiDaySnow,
  WiNightAltSnow,
  WiDaySleet,
  WiNightAltSleet,
  WiDayThunderstorm,
  WiNightAltThunderstorm,
};

export function IconGlyph({
  name,
  size = 64,
}: {
  name: IconGlyphName;
  size?: number;
}): JSX.Element {
  const Component = GLYPHS[name];
  return (
    <span
      data-testid="icon-glyph"
      data-icon-name={name}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        color: 'white',
      }}
    >
      <Component size={size} aria-hidden="true" />
    </span>
  );
}
