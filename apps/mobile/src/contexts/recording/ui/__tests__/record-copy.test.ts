import { translator } from '@/i18n/translator';

// The English text Maestro flows match (e2e/02, 04, 13) and the Android notification, plus Polish.
describe('record copy', () => {
  const en = translator('record', 'en');
  const pl = translator('record', 'pl');

  it('keeps the English the flows match', () => {
    expect(en('startButton', { type: 'run' })).toBe('Start run');
    expect(en('startButton', { type: 'cycle' })).toBe('Start ride');
    expect(en('status.paused')).toBe('Paused');
    expect(en('tooShortTitle')).toBe('Too short to save');
    expect(en('discard')).toBe('Discard');
    expect(en('cityLabel', { city: 'Kraków' })).toBe('City: Kraków');
  });

  it('inflects the activity type in Polish', () => {
    expect(['walk', 'run', 'cycle'].map((type) => pl('startButton', { type }))).toEqual([
      'Zacznij spacer',
      'Zacznij bieg',
      'Zacznij jazdę',
    ]);
  });

  it('builds the recording notification in both languages', () => {
    expect(en('notification.title', { type: 'cycle' })).toBe('Recording your ride');
    expect(en('notification.body', { app: 'CityTurfer' })).toBe('CityTurfer is claiming your streets. Tap to open.');
    expect(pl('notification.title', { type: 'walk' })).toBe('Nagrywam Twój spacer');
  });

  it('labels the live banner as before', () => {
    const values = { status: 'recording', type: 'walk', distance: '1.20 km' };
    expect(en('banner.label', values)).toBe('Recording Walk, 1.20 km. Open Record.');
    expect(en('banner.label', { ...values, status: 'paused' })).toBe('Paused Walk, 1.20 km. Open Record.');
  });
});
