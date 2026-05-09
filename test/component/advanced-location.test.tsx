import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  AdvancedLocation,
  type AdvancedLocationPalette,
} from '../../src/renderer/src/components/advanced-location';
import type { LocationOverride } from '../../src/shared/settings-store';

const PALETTE: AdvancedLocationPalette = {
  text: 'white',
  textMuted: 'rgba(255,255,255,0.6)',
  inputBg: 'rgba(0,0,0,0.25)',
  inputBorder: 'rgba(255,255,255,0.12)',
  inputText: 'white',
  buttonBg: 'rgba(255,255,255,0.06)',
  buttonText: 'white',
  buttonBorder: 'rgba(255,255,255,0.12)',
  errorText: 'rgba(255,120,120,0.95)',
  divider: 'rgba(255,255,255,0.12)',
};

type Stub = {
  geocodeLocation: ReturnType<typeof vi.fn>;
  setLocationOverride: ReturnType<typeof vi.fn>;
  clearLocationOverride: ReturnType<typeof vi.fn>;
};

function installStub(): Stub {
  const stub: Stub = {
    geocodeLocation: vi.fn(),
    setLocationOverride: vi.fn().mockResolvedValue(undefined),
    clearLocationOverride: vi.fn().mockResolvedValue(undefined),
  };
  (window as unknown as { glimpse: Stub }).glimpse = stub;
  return stub;
}

beforeEach(() => {
  installStub();
});

afterEach(() => {
  cleanup();
  delete (window as unknown as { glimpse?: unknown }).glimpse;
});

const KELOWNA_OVERRIDE: LocationOverride = {
  detectedCity: 'Kelowna',
  city: 'Kelowna Airport',
  latitude: 49.96,
  longitude: -119.38,
};

describe('AdvancedLocation — initial render', () => {
  it('pre-fills the form from the current override', () => {
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={KELOWNA_OVERRIDE}
        palette={PALETTE}
      />,
    );
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('Kelowna Airport');
    expect(
      (screen.getByTestId('advanced-location-lat') as HTMLInputElement).value,
    ).toBe('49.96');
    expect(
      (screen.getByTestId('advanced-location-lon') as HTMLInputElement).value,
    ).toBe('-119.38');
  });

  it('starts with empty fields when no override exists', () => {
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('advanced-location-lat') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('advanced-location-lon') as HTMLInputElement).value,
    ).toBe('');
  });

  it('uses the detected city as the city-field placeholder when no override is set', () => {
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    const cityInput = screen.getByTestId(
      'advanced-location-city',
    ) as HTMLInputElement;
    expect(cityInput.placeholder).toBe('Kelowna');
  });

  it('disables Save when detectedCity is null (snapshot still loading)', () => {
    render(
      <AdvancedLocation
        detectedCity={null}
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    const save = screen.getByTestId(
      'advanced-location-save',
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('disables Reset when no override exists', () => {
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    const reset = screen.getByTestId(
      'advanced-location-reset',
    ) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
  });
});

describe('AdvancedLocation — Look up', () => {
  it('disables Look up when the city field is empty', () => {
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    const button = screen.getByTestId(
      'advanced-location-lookup',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('on success, fills lat / lon with the geocoded coords (rounded to 4 dp)', async () => {
    const stub = installStub();
    stub.geocodeLocation.mockResolvedValue({
      name: 'Kelowna',
      latitude: 49.88307,
      longitude: -119.48568,
      country: 'Canada',
      admin1: 'British Columbia',
    });
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    const cityInput = screen.getByTestId(
      'advanced-location-city',
    ) as HTMLInputElement;
    fireEvent.change(cityInput, { target: { value: 'Kelowna' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('advanced-location-lookup'));
    });

    expect(stub.geocodeLocation).toHaveBeenCalledWith('Kelowna');
    expect(
      (screen.getByTestId('advanced-location-lat') as HTMLInputElement).value,
    ).toBe('49.8831');
    expect(
      (screen.getByTestId('advanced-location-lon') as HTMLInputElement).value,
    ).toBe('-119.4857');
  });

  it('shows an inline error in red when no match is found', async () => {
    const stub = installStub();
    stub.geocodeLocation.mockResolvedValue(null);
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-city'), {
      target: { value: 'Atlantis' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('advanced-location-lookup'));
    });
    const error = screen.getByTestId('advanced-location-error');
    expect(error.textContent).toContain("Couldn't find");
    expect(error.style.color).toContain('120');
  });

  it('shows a network-error message on geocoding API failure', async () => {
    const stub = installStub();
    stub.geocodeLocation.mockRejectedValue(new Error('HTTP 503'));
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-city'), {
      target: { value: 'Kelowna' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('advanced-location-lookup'));
    });
    expect(screen.getByTestId('advanced-location-error').textContent).toMatch(
      /reach the geocoding service/,
    );
  });
});

describe('AdvancedLocation — Save', () => {
  it('writes the override entry keyed by detectedCity', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-city'), {
      target: { value: 'Kelowna Airport' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lat'), {
      target: { value: '49.96' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lon'), {
      target: { value: '-119.38' },
    });
    fireEvent.click(screen.getByTestId('advanced-location-save'));

    expect(stub.setLocationOverride).toHaveBeenCalledWith({
      detectedCity: 'Kelowna',
      city: 'Kelowna Airport',
      latitude: 49.96,
      longitude: -119.38,
    });
  });

  it('falls back to detectedCity for the city field when blank', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-lat'), {
      target: { value: '49.96' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lon'), {
      target: { value: '-119.38' },
    });
    fireEvent.click(screen.getByTestId('advanced-location-save'));

    expect(stub.setLocationOverride).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Kelowna' }),
    );
  });

  it('rejects out-of-range latitude with an inline error', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-lat'), {
      target: { value: '95' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lon'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('advanced-location-save'));
    expect(stub.setLocationOverride).not.toHaveBeenCalled();
    expect(screen.getByTestId('advanced-location-error').textContent).toMatch(
      /Latitude/,
    );
  });

  it('rejects out-of-range longitude with an inline error', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-lat'), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lon'), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByTestId('advanced-location-save'));
    expect(stub.setLocationOverride).not.toHaveBeenCalled();
    expect(screen.getByTestId('advanced-location-error').textContent).toMatch(
      /Longitude/,
    );
  });

  it('rejects non-numeric coords with an inline error', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    fireEvent.change(screen.getByTestId('advanced-location-lat'), {
      target: { value: 'abc' },
    });
    fireEvent.change(screen.getByTestId('advanced-location-lon'), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByTestId('advanced-location-save'));
    expect(stub.setLocationOverride).not.toHaveBeenCalled();
  });
});

describe('AdvancedLocation — Reset', () => {
  it('calls clearLocationOverride and clears all form fields', () => {
    const stub = installStub();
    render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={KELOWNA_OVERRIDE}
        palette={PALETTE}
      />,
    );
    fireEvent.click(screen.getByTestId('advanced-location-reset'));
    expect(stub.clearLocationOverride).toHaveBeenCalledWith('Kelowna');
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('advanced-location-lat') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByTestId('advanced-location-lon') as HTMLInputElement).value,
    ).toBe('');
  });
});

describe('AdvancedLocation — re-sync on prop change', () => {
  it('updates form when the active override changes (e.g. user travelled and came back)', () => {
    const { rerender } = render(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={null}
        palette={PALETTE}
      />,
    );
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('');

    rerender(
      <AdvancedLocation
        detectedCity="Kelowna"
        currentOverride={KELOWNA_OVERRIDE}
        palette={PALETTE}
      />,
    );
    expect(
      (screen.getByTestId('advanced-location-city') as HTMLInputElement).value,
    ).toBe('Kelowna Airport');
  });
});
