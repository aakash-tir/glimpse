import { describe, it, expect } from 'vitest';
import { shouldRegisterAutoLaunch } from '../../src/shared/auto-launch';

describe('shouldRegisterAutoLaunch', () => {
  it('registers on the first packaged launch (packaged + not yet registered)', () => {
    expect(
      shouldRegisterAutoLaunch({ isPackaged: true, alreadyRegistered: false }),
    ).toBe(true);
  });

  it('does not register again once already registered', () => {
    expect(
      shouldRegisterAutoLaunch({ isPackaged: true, alreadyRegistered: true }),
    ).toBe(false);
  });

  it('never registers in development (unpackaged), regardless of the flag', () => {
    expect(
      shouldRegisterAutoLaunch({ isPackaged: false, alreadyRegistered: false }),
    ).toBe(false);
    expect(
      shouldRegisterAutoLaunch({ isPackaged: false, alreadyRegistered: true }),
    ).toBe(false);
  });
});
