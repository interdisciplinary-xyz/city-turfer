import { useTranslations } from 'next-intl';

import { type TabKey, TABS } from './hero-screens.constants';

/** The iOS status bar: time on the left; signal, Wi-Fi and battery on the right. */
export function StatusBar() {
  const t = useTranslations('screens.proto');
  return (
    <div className='proto-status'>
      <span className='proto-time'>{t('time')}</span>
      <svg className='proto-status-icons' viewBox='0 0 68 13' aria-hidden='true'>
        <rect x='0' y='8' width='3' height='5' rx='1' fill='currentColor' />
        <rect x='5' y='6' width='3' height='7' rx='1' fill='currentColor' />
        <rect x='10' y='3.5' width='3' height='9.5' rx='1' fill='currentColor' />
        <rect x='15' y='1' width='3' height='12' rx='1' fill='currentColor' />
        <path
          d='M24 4.6a10 10 0 0 1 14 0M26.4 7.2a6.4 6.4 0 0 1 9.2 0M28.8 9.8a3 3 0 0 1 4.4 0'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.7'
          strokeLinecap='round'
        />
        <rect x='44' y='1.5' width='21' height='10' rx='3' fill='none' stroke='currentColor' strokeOpacity='0.5' />
        <rect x='46' y='3.5' width='15' height='6' rx='1.5' fill='currentColor' />
        <rect x='66' y='5' width='1.6' height='3.4' rx='0.8' fill='currentColor' fillOpacity='0.5' />
      </svg>
    </div>
  );
}

/** The settings button the app puts top right on the Dashboard and the Turf Map. */
export function SettingsButton() {
  return (
    <span className='proto-settings' aria-hidden='true'>
      <svg viewBox='0 0 24 24'>
        <path
          fill='currentColor'
          d='M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z'
        />
      </svg>
    </span>
  );
}

/** Tab icons, outlined like the app's tab bar. */
function TabIcon({ tab }: { tab: Exclude<TabKey, 'record'> }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  return (
    <svg className='proto-tab-icon' viewBox='0 0 24 24' aria-hidden='true'>
      {tab === 'dashboard' && <path {...common} d='M3.5 11 12 4l8.5 7M6 9.5V20h4.5v-5h3v5H18V9.5' />}
      {tab === 'turf' && <path {...common} d='M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6z' />}
      {tab === 'stats' && <path {...common} d='M4.5 20V12.5h3.5V20zM10.25 20V8h3.5v12zM16 20V4.5h3.5V20z' />}
      {tab === 'me' && (
        <>
          <circle {...common} cx='12' cy='12' r='8.5' />
          <circle {...common} cx='12' cy='10' r='3' />
          <path {...common} d='M6.6 18.2a6.4 6.4 0 0 1 10.8 0' />
        </>
      )}
    </svg>
  );
}

/** The app's tab bar with the raised Record button in the middle. */
export function TabBar({ active }: { active: Exclude<TabKey, 'record'> }) {
  const t = useTranslations('screens.proto.tabs');
  return (
    <div className='proto-tabs'>
      {TABS.map((tab) =>
        tab === 'record' ? (
          <span key={tab} className='proto-tab proto-tab-record'>
            <span className='proto-record'>
              <span className='proto-record-dot' />
            </span>
            {t(tab)}
          </span>
        ) : (
          <span key={tab} className={`proto-tab${tab === active ? ' proto-tab-active' : ''}`}>
            <TabIcon tab={tab} />
            {t(tab)}
          </span>
        )
      )}
    </div>
  );
}
