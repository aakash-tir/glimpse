import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocationPrompt } from '../../src/renderer/src/components/location-prompt';
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '../../src/shared/settings-store';

type Stub = {
  setSettings: ReturnType<typeof vi.fn>;
};

function installStub(): Stub {
  const stub: Stub = {
    setSettings: vi.fn().mockResolvedValue(undefined),
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

function settings(overrides?: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('LocationPrompt — visibility gating', () => {
  it('renders nothing while settings are still loading (null)', () => {
    const { container } = render(<LocationPrompt settings={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing once locationPermissionAsked is true', () => {
    const { container } = render(
      <LocationPrompt settings={settings({ locationPermissionAsked: true })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the prompt when locationPermissionAsked is false', () => {
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    expect(screen.getByTestId('location-prompt')).toBeInTheDocument();
    expect(screen.getByTestId('location-prompt-title').textContent).toContain(
      'Set your location',
    );
  });
});

describe('LocationPrompt — actions', () => {
  it('"Set location" enables advancedLocation AND marks permission asked', () => {
    const stub = installStub();
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    fireEvent.click(screen.getByTestId('location-prompt-accept'));
    expect(stub.setSettings).toHaveBeenCalledWith({
      advancedLocationEnabled: true,
      locationPermissionAsked: true,
    });
  });

  it('"Maybe later" only marks permission asked (advanced stays off)', () => {
    const stub = installStub();
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    fireEvent.click(screen.getByTestId('location-prompt-skip'));
    expect(stub.setSettings).toHaveBeenCalledWith({
      locationPermissionAsked: true,
    });
    expect(stub.setSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ advancedLocationEnabled: true }),
    );
  });

  it("stops click propagation so panel double-click doesn't fire while open", () => {
    const onPanelClick = vi.fn();
    render(
      <div onClick={onPanelClick} onDoubleClick={onPanelClick}>
        <LocationPrompt
          settings={settings({ locationPermissionAsked: false })}
        />
      </div>,
    );
    fireEvent.click(screen.getByTestId('location-prompt'));
    expect(onPanelClick).not.toHaveBeenCalled();
  });
});

describe('LocationPrompt — z-index', () => {
  it('sits above slide content (z-index ≥ 50)', () => {
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    const overlay = screen.getByTestId('location-prompt') as HTMLElement;
    expect(Number(overlay.style.zIndex)).toBeGreaterThanOrEqual(50);
  });
});

describe('LocationPrompt — fits-or-scrolls layout', () => {
  it('caps the card at the overlay height and scrolls only when overflowing', () => {
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    const card = screen.getByTestId('location-prompt-card') as HTMLElement;
    // overflowY: auto means the browser shows a scrollbar only when
    // the card's content actually exceeds maxHeight. When everything
    // fits, the card renders normally with no scroll affordance.
    expect(card.style.overflowY).toBe('auto');
    expect(card.style.maxHeight).toBe('100%');
  });

  it('hides the native scrollbar when scrolling is necessary', () => {
    render(
      <LocationPrompt
        settings={settings({ locationPermissionAsked: false })}
      />,
    );
    const card = screen.getByTestId('location-prompt-card') as HTMLElement;
    expect(card.style.scrollbarWidth).toBe('none');
  });
});
