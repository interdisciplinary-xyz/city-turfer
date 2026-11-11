import { showSharePrompt } from '../share-prompt';

describe('showSharePrompt', () => {
  it("shows right after Finish while Don't ask again is off", () => {
    expect(showSharePrompt({ justFinished: true, neverAsk: false, handled: false })).toBe(true);
  });

  it('never from History', () => {
    expect(showSharePrompt({ justFinished: false, neverAsk: false, handled: false })).toBe(false);
  });

  it("not after Don't ask again, and not while the flag is loading", () => {
    expect(showSharePrompt({ justFinished: true, neverAsk: true, handled: false })).toBe(false);
    expect(showSharePrompt({ justFinished: true, neverAsk: null, handled: false })).toBe(false);
  });

  it('not after Not now or a choice on this visit', () => {
    expect(showSharePrompt({ justFinished: true, neverAsk: false, handled: true })).toBe(false);
  });
});
