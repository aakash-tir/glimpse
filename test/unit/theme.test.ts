import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../../src/shared/theme';

describe('resolveTheme', () => {
  it("override='light' wins regardless of system preference", () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
  });

  it("override='dark' wins regardless of system preference", () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it("override='auto' follows the OS dark-mode flag", () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });
});
