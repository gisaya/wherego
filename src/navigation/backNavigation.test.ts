import { backDestination } from './backNavigation';

describe('native back navigation', () => {
  it('returns through question and origin screens instead of closing the app', () => {
    expect(backDestination('question', 3, false)).toBe('previousQuestion');
    expect(backDestination('question', 0, false)).toBe('origin');
    expect(backDestination('origin', 0, false)).toBe('intro');
    expect(backDestination('result', 6, false)).toBe('intro');
    expect(backDestination('quota', 0, false)).toBe('intro');
  });
  it('does not edit answers after a recommendation credit is reserved', () => {
    expect(backDestination('question', 6, true)).toBe('exit');
    expect(backDestination('rewardGate', 6, true)).toBe('exit');
    expect(backDestination('intro', 0, false)).toBe('exit');
  });
});
