// Blood moon event slide. Plan/slides.md § Special events — blood moon.
//
//   Body fields: peak time in user's local time · visibility text.
//   Background:  the same translucent dark-glass "window tint" the
//                weather slides use (rgba(15,23,42,0.92)) so the desktop
//                shows faintly through — NOT an opaque celestial
//                gradient — with a faint blood-moon disc layered on top,
//                centred behind the content. The disc is a red sphere
//                gradient multiplied with a grayscale lunar-surface
//                texture, so it shows craters/maria while staying red.
//   Motion:      none — the disc and tint are static.
//
// Blood moon slides only appear alongside total lunar eclipses (see
// computeActiveEvents) — every blood moon shares its date with an
// eclipse slide, so the user sees both stacked back-to-back. The
// centred red disc over the glass tint makes the totality reading
// distinct from the surrounding eclipse silhouette.

import moonTexture from '../assets/moon.jpg';
import type { TimeFormat } from '../../../shared/settings-store';
import type { BloodMoonEvent } from '../../../shared/special-events';
import { formatLocalClock } from '../../../shared/time-format';
import { EventSlideShell } from './event-slide-shell';

// Same translucent slate glass the weather slides paint (see
// slide-deck BG_DARK_GLASS) so the blood-moon slide carries the app's
// window-tint look instead of an opaque event gradient.
const BG_TINT = 'rgba(15, 23, 42, 0.92)';

export type BloodMoonSlideProps = {
  event: BloodMoonEvent;
  timeFormat: TimeFormat;
};

export function BloodMoonSlide({
  event,
  timeFormat,
}: BloodMoonSlideProps): JSX.Element {
  const isTomorrow = event.dayOffset === 1;
  const { eclipse } = event;
  const peak = eclipse.peakTimeUtc
    ? formatLocalClock(eclipse.peakTimeUtc, timeFormat)
    : null;
  const start = eclipse.startTimeUtc
    ? formatLocalClock(eclipse.startTimeUtc, timeFormat)
    : null;
  const end = eclipse.endTimeUtc
    ? formatLocalClock(eclipse.endTimeUtc, timeFormat)
    : null;
  const magnitudePct =
    eclipse.magnitude !== undefined
      ? Math.round(eclipse.magnitude * 100)
      : null;

  return (
    <EventSlideShell
      title="Blood moon"
      isTomorrow={isTomorrow}
      testIdToken="blood-moon"
      motionOverlay={<BloodMoonBackground />}
    >
      <div
        data-testid="blood-moon-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: '100%',
          textAlign: 'center',
        }}
      >
        {peak ? (
          <div
            data-testid="blood-moon-peak-time"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            Peak {peak}
          </div>
        ) : null}
        {start && end ? (
          <div
            data-testid="blood-moon-start-end"
            style={{ fontSize: 11, opacity: 0.75 }}
          >
            {start} – {end}
          </div>
        ) : null}
        {eclipse.visibility ? (
          <div
            data-testid="blood-moon-visibility"
            style={{
              fontSize: 11,
              opacity: 0.85,
              marginTop: 4,
              maxWidth: '92%',
            }}
          >
            {eclipse.visibility}
          </div>
        ) : null}
        {magnitudePct !== null ? (
          <div
            data-testid="blood-moon-magnitude"
            data-magnitude={String(eclipse.magnitude)}
            style={{ fontSize: 11, opacity: 0.7 }}
          >
            Magnitude {magnitudePct}%
          </div>
        ) : null}
      </div>
    </EventSlideShell>
  );
}

function BloodMoonBackground(): JSX.Element {
  return (
    <>
      {/* Window tint — the same translucent slate glass the weather
          slides use, so the desktop shows faintly through rather than
          an opaque celestial gradient. */}
      <div
        data-testid="blood-moon-bg-tint"
        style={{ position: 'absolute', inset: 0, background: BG_TINT }}
      />
      {/* Faint blood-moon disc, centred and layered over the tint but
          behind the content. Low opacity so it reads as a subtle
          backdrop, not a foreground graphic. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          data-testid="blood-moon-disc"
          style={{
            width: '55%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            // Red sphere shading MULTIPLIED with the grayscale moon
            // texture: red × gray keeps the hue red while the craters
            // and maria modulate brightness, so it reads as a red moon
            // with surface detail. The radial also darkens the limb for
            // a spherical feel.
            backgroundImage: `radial-gradient(circle at 50% 42%, rgba(210, 85, 50, 1) 0%, rgba(150, 40, 22, 1) 58%, rgba(80, 18, 10, 1) 100%), url(${moonTexture})`,
            backgroundBlendMode: 'multiply',
            backgroundSize: 'cover, cover',
            backgroundPosition: 'center, center',
            backgroundRepeat: 'no-repeat, no-repeat',
            boxShadow: '0 0 30px rgba(170, 50, 25, 0.5)',
            opacity: 0.4,
          }}
        />
      </div>
    </>
  );
}
