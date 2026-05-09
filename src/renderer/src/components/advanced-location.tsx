import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { LocationOverride } from '../../../shared/settings-store';

// "Advanced location" form — surfaced in the Settings slide when the
// user toggles `advancedLocationEnabled` and the window is wide enough
// to fit the inputs (the toggle row itself is hidden in compact mode
// over in settings-slide.tsx).
//
// Two ways to set an override:
//   1. Type a city, click Look up. We geocode via Open-Meteo and fill
//      the lat / lon inputs so the user can verify before saving.
//   2. Type lat / lon directly and click Save.
//
// In both cases Save commits the override entry keyed by the
// IP-detected city. Reset clears the entry for the current detected
// city (other cities' entries stay intact — see locationOverrides
// docstring in settings-store.ts).

export type AdvancedLocationPalette = {
  text: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
  errorText: string;
  divider: string;
};

export type AdvancedLocationProps = {
  /** IP-detected city — the lookup key for any saved override. */
  detectedCity: string | null;
  /** Active override for the detected city, if any. Pre-fills the form. */
  currentOverride: LocationOverride | null;
  palette: AdvancedLocationPalette;
};

export function AdvancedLocation({
  detectedCity,
  currentOverride,
  palette,
}: AdvancedLocationProps): JSX.Element {
  const [cityInput, setCityInput] = useState(currentOverride?.city ?? '');
  const [latInput, setLatInput] = useState(
    currentOverride ? currentOverride.latitude.toString() : '',
  );
  const [lonInput, setLonInput] = useState(
    currentOverride ? currentOverride.longitude.toString() : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Re-sync the form when the underlying override changes from outside
  // (e.g. after a Save or after travelling to a different city). Using
  // primitive deps so React's shallow-equality check doesn't re-fire
  // on every parent re-render with a fresh object literal.
  const cityProp = currentOverride?.city ?? null;
  const latProp = currentOverride?.latitude ?? null;
  const lonProp = currentOverride?.longitude ?? null;
  useEffect(() => {
    setCityInput(cityProp ?? '');
    setLatInput(latProp !== null ? latProp.toString() : '');
    setLonInput(lonProp !== null ? lonProp.toString() : '');
    setError(null);
  }, [cityProp, latProp, lonProp]);

  const handleLookup = useCallback(async () => {
    const trimmed = cityInput.trim();
    if (trimmed.length === 0) {
      setError('Enter a city name first.');
      return;
    }
    setError(null);
    setIsLookingUp(true);
    try {
      const match = await window.glimpse?.geocodeLocation(trimmed);
      if (!match) {
        setError(`Couldn't find "${trimmed}". Check spelling.`);
        return;
      }
      // Fill the form with the canonical name + coords so the user
      // can verify before saving. Latitude/longitude rounded to 4 dp
      // (~11 m precision) — coords don't need more than that for a
      // weather-grid lookup.
      setCityInput(match.name);
      setLatInput(match.latitude.toFixed(4));
      setLonInput(match.longitude.toFixed(4));
    } catch {
      setError("Couldn't reach the geocoding service. Try again.");
    } finally {
      setIsLookingUp(false);
    }
  }, [cityInput]);

  const handleSave = useCallback((): void => {
    if (!detectedCity) {
      setError('Detecting your location — try again in a moment.');
      return;
    }
    const lat = Number.parseFloat(latInput);
    const lon = Number.parseFloat(lonInput);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError('Latitude must be a number between −90 and 90.');
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setError('Longitude must be a number between −180 and 180.');
      return;
    }
    setError(null);
    void window.glimpse?.setLocationOverride({
      detectedCity,
      // Empty city falls back to the detected city so we always have a
      // non-empty display label. The user can still leave it blank
      // if they prefer the auto-detected name.
      city: cityInput.trim() || detectedCity,
      latitude: lat,
      longitude: lon,
    });
  }, [detectedCity, cityInput, latInput, lonInput]);

  const handleReset = useCallback((): void => {
    if (!detectedCity) return;
    void window.glimpse?.clearLocationOverride(detectedCity);
    setCityInput('');
    setLatInput('');
    setLonInput('');
    setError(null);
  }, [detectedCity]);

  const labelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 500,
    color: palette.textMuted,
    flex: '0 0 56px',
  };

  const inputStyle: CSSProperties = {
    flex: '1 1 auto',
    minWidth: 0,
    fontSize: 11,
    padding: '4px 6px',
    background: palette.inputBg,
    border: `1px solid ${palette.inputBorder}`,
    borderRadius: 4,
    color: palette.inputText,
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  };

  const inlineButtonStyle: CSSProperties = {
    flex: '0 0 auto',
    fontSize: 10,
    padding: '4px 8px',
    background: palette.buttonBg,
    color: palette.buttonText,
    border: `1px solid ${palette.buttonBorder}`,
    borderRadius: 4,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
    letterSpacing: 0.2,
  };

  return (
    <div
      data-testid="advanced-location"
      data-detected-city={detectedCity ?? ''}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${palette.divider}`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span style={labelStyle}>City</span>
        <input
          type="text"
          data-testid="advanced-location-city"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={detectedCity ?? 'e.g. Kelowna'}
          style={inputStyle}
        />
        <button
          type="button"
          data-testid="advanced-location-lookup"
          data-looking-up={isLookingUp ? 'on' : 'off'}
          disabled={isLookingUp || cityInput.trim().length === 0}
          onClick={(e) => {
            e.stopPropagation();
            void handleLookup();
          }}
          style={{
            ...inlineButtonStyle,
            opacity: isLookingUp || cityInput.trim().length === 0 ? 0.5 : 1,
            cursor:
              isLookingUp || cityInput.trim().length === 0
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {isLookingUp ? '…' : 'Look up'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span style={labelStyle}>Lat</span>
        <input
          type="text"
          inputMode="decimal"
          data-testid="advanced-location-lat"
          value={latInput}
          onChange={(e) => setLatInput(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="49.8830"
          style={inputStyle}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span style={labelStyle}>Lon</span>
        <input
          type="text"
          inputMode="decimal"
          data-testid="advanced-location-lon"
          value={lonInput}
          onChange={(e) => setLonInput(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="-119.4857"
          style={inputStyle}
        />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 6,
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          data-testid="advanced-location-reset"
          disabled={currentOverride === null}
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          style={{
            ...inlineButtonStyle,
            opacity: currentOverride === null ? 0.5 : 1,
            cursor: currentOverride === null ? 'not-allowed' : 'pointer',
          }}
        >
          Reset
        </button>
        <button
          type="button"
          data-testid="advanced-location-save"
          disabled={!detectedCity}
          onClick={(e) => {
            e.stopPropagation();
            handleSave();
          }}
          style={{
            ...inlineButtonStyle,
            opacity: !detectedCity ? 0.5 : 1,
            cursor: !detectedCity ? 'not-allowed' : 'pointer',
          }}
        >
          Save
        </button>
      </div>

      {error ? (
        <div
          data-testid="advanced-location-error"
          style={{
            fontSize: 10,
            color: palette.errorText,
            padding: '2px 4px',
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
