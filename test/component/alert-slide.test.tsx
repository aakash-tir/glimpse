import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AlertSlide } from '../../src/renderer/src/components/alert-slide';
import type { WeatherAlert } from '../../src/shared/alerts';

afterEach(cleanup);

function alert(over: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'a1',
    severity: 'warning',
    title: 'Severe thunderstorm warning',
    areas: ['Central Okanagan'],
    riskColour: 'orange',
    expiresAtUtc: '2026-08-11T05:30:00Z',
    ...over,
  };
}

describe('AlertSlide — content', () => {
  it('shows the alert name as the slide title', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.getByTestId('slide-title').textContent).toBe(
      'Severe thunderstorm warning',
    );
  });

  it('shows the severity label', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.getByTestId('alert-severity').textContent).toBe('Warning');
    cleanup();
    render(
      <AlertSlide
        alert={alert({ severity: 'watch' })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(screen.getByTestId('alert-severity').textContent).toBe('Watch');
  });

  it('names the affected region', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.getByTestId('alert-areas').textContent).toBe(
      'Central Okanagan',
    );
  });

  it('lists every region of a deduped group', () => {
    render(
      <AlertSlide
        alert={alert({ areas: ['North Okanagan', 'Central Okanagan'] })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(screen.getByTestId('alert-areas').textContent).toBe(
      'North Okanagan, Central Okanagan',
    );
  });

  it('omits the region row when the feed named no region', () => {
    render(
      <AlertSlide
        alert={alert({ areas: [] })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(screen.queryByTestId('alert-areas')).toBeNull();
  });

  it('never renders the bulletin body, however long the feed makes it', () => {
    // The whole point of the slide redesign: what / where / until when.
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.queryByTestId('alert-description')).toBeNull();
    expect(
      screen.getByTestId('alert-content').textContent?.length ?? 0,
    ).toBeLessThan(120);
  });

  it('exposes the severity for the deck to key off', () => {
    render(
      <AlertSlide
        alert={alert({ severity: 'advisory' })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(
      screen.getByTestId('alert-content').getAttribute('data-severity'),
    ).toBe('advisory');
  });
});

describe('AlertSlide — expiry time', () => {
  // plan/slides.md § Time rendering: the forecast location's zone.
  it('renders the expiry in the forecast timezone, not the host zone', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.getByTestId('alert-expires').textContent).toBe('Until 05:30');
    cleanup();
    render(
      <AlertSlide alert={alert()} timeFormat="24h" timeZone="Asia/Tokyo" />,
    );
    expect(screen.getByTestId('alert-expires').textContent).toBe('Until 14:30');
  });

  it('respects the 12 h setting', () => {
    render(<AlertSlide alert={alert()} timeFormat="12h" timeZone="UTC" />);
    expect(screen.getByTestId('alert-expires').textContent).toBe(
      'Until 5:30 AM',
    );
  });

  it('omits the expiry row for an open-ended alert', () => {
    render(
      <AlertSlide
        alert={alert({ expiresAtUtc: null })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(screen.queryByTestId('alert-expires')).toBeNull();
  });
});

describe('AlertSlide — background', () => {
  it('tints from the Environment Canada risk colour', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    const bg = screen.getByTestId('alert-bg');
    expect(bg.getAttribute('data-risk-colour')).toBe('orange');
  });

  it('marks a missing risk colour rather than guessing one', () => {
    render(
      <AlertSlide
        alert={alert({ riskColour: null })}
        timeFormat="24h"
        timeZone="UTC"
      />,
    );
    expect(
      screen.getByTestId('alert-bg').getAttribute('data-risk-colour'),
    ).toBe('none');
  });

  it('carries no motion — a pulsing warning would read as an alarm', () => {
    // plan/data-sources.md: the app is strictly passive.
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    const bg = screen.getByTestId('alert-bg');
    expect(bg.getAttribute('data-pulse-duration-s')).toBeNull();
    expect(bg.getAttribute('style')).not.toContain('animation');
  });

  it('never shows a Tomorrow badge — alerts are always current', () => {
    render(<AlertSlide alert={alert()} timeFormat="24h" timeZone="UTC" />);
    expect(screen.queryByTestId('event-tomorrow-badge')).toBeNull();
  });
});
