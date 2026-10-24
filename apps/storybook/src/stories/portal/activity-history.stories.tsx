import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useLocale } from 'next-intl';
import { useState } from 'react';

import { ActivitiesEmpty } from '@/app/[locale]/account/_portal/activities-empty';
import type { HistoryEmptyKind } from '@/app/[locale]/account/_portal/activities-empty/activities-empty.constants';
import { ActivityDetailView } from '@/app/[locale]/account/_portal/activity-detail';
import { ActivityFilter } from '@/app/[locale]/account/_portal/activity-filter';
import type { HistoryFilter } from '@/app/[locale]/account/_portal/activity-filter/activity-filter.constants';
import { ActivityList } from '@/app/[locale]/account/_portal/activity-list';
import { ActivityState } from '@/app/[locale]/account/_portal/activity-state';
import { ActivityTotals } from '@/app/[locale]/account/_portal/activity-totals';
import { PortalFrame } from '@/app/[locale]/account/_portal/portal-frame';
import { PortalNav } from '@/app/[locale]/account/_portal/portal-nav';
import { previewLines, routeShape, simplifyLines, trackLines } from '@/app/[locale]/account/_portal/route-shape';
import { RouteSvg } from '@/app/[locale]/account/_portal/route-svg';
import { DETAIL_BOX, ROW_BOX } from '@/app/[locale]/account/_portal/route-svg/route-svg.constants';
import { SignOutButton } from '@/app/[locale]/account/_portal/sign-out-button';
import { Unreachable } from '@/app/[locale]/account/_portal/unreachable';
import type { Locale } from '@/i18n/routing';

import { ACTIVITIES, DETAIL, TOTALS, TRACK } from './fixtures';

type Props = {
  view:
    | 'list'
    | 'detail'
    | 'detail-preview'
    | 'detail-loading'
    | 'detail-not-found'
    | 'detail-deleted'
    | 'empty'
    | 'unreachable';
  empty: HistoryEmptyKind;
};

/**
 * The activity history from its pieces (the real pages add the data hooks and the session gate):
 * the list with totals and filter, one activity, its empty states. Made-up activities.
 */
function ActivityHistory({ view, empty }: Props) {
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const items = filter === 'all' ? ACTIVITIES : ACTIVITIES.filter((a) => a.type === filter);
  const detail = view.startsWith('detail');
  const state =
    view === 'detail-loading'
      ? ({ kind: 'loading' } as const)
      : view === 'detail-not-found'
        ? ({ kind: 'not-found' } as const)
        : view === 'detail-deleted'
          ? ({ kind: 'deleted' } as const)
          : null;
  return (
    <PortalFrame
      locale={locale}
      path={detail ? '/account/activity?id=act_1' : '/account/activities'}
      nav={<PortalNav locale={locale} section='activities' exact={!detail} />}
      headerActions={<SignOutButton onSignOut={() => undefined} pending={false} />}
    >
      {state ? (
        <ActivityState view={state} locale={locale} onRetry={() => undefined} />
      ) : detail ? (
        <ActivityDetailView
          activity={DETAIL}
          track={view === 'detail' ? TRACK : null}
          trackFailed={view === 'detail-preview'}
          locale={locale}
          browserZone='Europe/Warsaw'
        />
      ) : (
        <div className='portal-page'>
          <h1 className='portal-title'>{locale === 'pl' ? 'Aktywności' : 'Activities'}</h1>
          {view === 'list' ? (
            <>
              <ActivityTotals totals={TOTALS} locale={locale} />
              <ActivityFilter value={filter} onChange={setFilter} />
              {items.length > 0 ? (
                <ActivityList items={items} locale={locale} fallbackZone='Europe/Warsaw' />
              ) : (
                <ActivitiesEmpty kind='filter' type={filter === 'all' ? null : filter} />
              )}
            </>
          ) : null}
          {view === 'empty' ? <ActivitiesEmpty kind={empty} type={empty === 'filter' ? 'cycle' : null} /> : null}
          {view === 'unreachable' ? <Unreachable onRetry={() => undefined} /> : null}
        </div>
      )}
    </PortalFrame>
  );
}

const meta = {
  title: 'Portal/ActivityHistory',
  component: ActivityHistory,
  globals: { scheme: 'light' },
  args: { view: 'list', empty: 'never' },
  argTypes: {
    view: {
      control: 'inline-radio',
      options: [
        'list',
        'detail',
        'detail-preview',
        'detail-loading',
        'detail-not-found',
        'detail-deleted',
        'empty',
        'unreachable',
      ],
    },
    empty: { control: 'inline-radio', options: ['never', 'withdrawn', 'nothing-yet', 'filter'] },
  },
} satisfies Meta<typeof ActivityHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = { name: 'Activities (totals, filter, list by month)' };
export const Detail: Story = { name: 'Activity (stats, route with a GPS gap, splits)', args: { view: 'detail' } };
export const DetailPreviewOnly: Story = {
  name: 'Activity, full route failed (simplified shape)',
  args: { view: 'detail-preview' },
};
export const DetailLoading: Story = { name: 'Activity, loading', args: { view: 'detail-loading' } };
export const DetailNotFound: Story = {
  name: 'Activity not found (unknown id, or not yours)',
  args: { view: 'detail-not-found' },
};
export const DetailDeleted: Story = { name: 'Activity deleted on the phone', args: { view: 'detail-deleted' } };
export const BackupNeverOn: Story = { name: 'Empty: backup never turned on', args: { view: 'empty', empty: 'never' } };
export const BackupWithdrawn: Story = { name: 'Empty: backup withdrawn', args: { view: 'empty', empty: 'withdrawn' } };
export const NothingYet: Story = {
  name: 'Empty: backup on, nothing yet',
  args: { view: 'empty', empty: 'nothing-yet' },
};
export const FilterNoMatch: Story = { name: 'Empty: no rides', args: { view: 'empty', empty: 'filter' } };
export const Unreachable_: Story = { name: 'API unreachable', args: { view: 'unreachable' } };

/** The route shape alone: a list thumbnail (from the summary's preview) and the detail (full track, simplified). */
function RouteShapes() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      <div className='portal-activity-shape' style={{ width: 64 }}>
        <RouteSvg shape={routeShape(previewLines(ACTIVITIES[2].preview), ROW_BOX)} type='cycle' dot={ROW_BOX.dot} />
      </div>
      <div className='portal-route-frame'>
        <RouteSvg
          shape={routeShape(simplifyLines(trackLines(TRACK.points, DETAIL.gapRoutes)), DETAIL_BOX)}
          type='run'
          dot={DETAIL_BOX.dot}
          label='The shape of the route, without a map.'
        />
      </div>
    </div>
  );
}

export const RouteShape: StoryObj<typeof RouteShapes> = {
  name: 'Route shape (row and detail)',
  render: () => <RouteShapes />,
  parameters: { layout: 'padded' },
};
