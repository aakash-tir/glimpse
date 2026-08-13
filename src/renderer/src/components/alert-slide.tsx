// Severe-weather alert slide. Plan/slides.md § Severe weather alerts.
//
//   Content:    alert name as the title · severity label · affected
//               region · expiry in the forecast location's zone.
//
//               The bulletin body is deliberately NOT shown. MSC's
//               alert_text_en runs to thousands of characters of health
//               advice and phone numbers; on a corner-glance slide it
//               buried the three facts that matter. What / where /
//               until when, then go read the full bulletin elsewhere.
//   Background: a dark tint derived from Environment Canada's own
//               risk colour, rather than a severity palette we invent.
//   Motion:     none, deliberately. These slides are read, not
//               admired, and a pulsing warning would read as an alarm
//               — the app is passive (plan/data-sources.md).
//
// Ordering lives in shared/slides.ts: a `warning` promotes the whole
// alert group to the front of the deck. This component is unaware of
// its own position.

import {
  alertBackground,
  formatAlertAreas,
  severityLabel,
  type WeatherAlert,
} from '../../../shared/alerts';
import type { TimeFormat } from '../../../shared/settings-store';
import { formatLocalClock } from '../../../shared/time-format';
import { EventSlideShell } from './event-slide-shell';

export type AlertSlideProps = {
  alert: WeatherAlert;
  timeFormat: TimeFormat;
  /** Forecast location's IANA zone — see plan/slides.md § Time rendering. */
  timeZone: string | null;
};

export function AlertSlide({
  alert,
  timeFormat,
  timeZone,
}: AlertSlideProps): JSX.Element {
  const expires = alert.expiresAtUtc
    ? formatLocalClock(alert.expiresAtUtc, timeFormat, timeZone)
    : null;
  const areas = formatAlertAreas(alert.areas);

  return (
    <EventSlideShell
      title={alert.title}
      isTomorrow={false}
      testIdToken="alert"
      motionOverlay={
        <div
          data-testid="alert-bg"
          data-risk-colour={alert.riskColour ?? 'none'}
          style={{
            position: 'absolute',
            inset: 0,
            background: alertBackground(alert),
          }}
        />
      }
    >
      <div
        data-testid="alert-content"
        data-severity={alert.severity}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          height: '100%',
          textAlign: 'center',
          padding: '0 10px',
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="alert-severity"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.35)',
            color: 'rgba(255, 255, 255, 0.92)',
            flex: '0 0 auto',
          }}
        >
          {severityLabel(alert.severity)}
        </div>

        {/* Region and expiry sit together in the middle of the slide —
            the two facts that qualify the title. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flex: '1 1 auto',
            minHeight: 0,
          }}
        >
          {areas ? (
            <div
              data-testid="alert-areas"
              style={{ fontSize: 13, fontWeight: 500, opacity: 0.95 }}
            >
              {areas}
            </div>
          ) : null}

          {expires ? (
            <div
              data-testid="alert-expires"
              style={{ fontSize: 11, opacity: 0.7 }}
            >
              Until {expires}
            </div>
          ) : null}
        </div>
      </div>
    </EventSlideShell>
  );
}
