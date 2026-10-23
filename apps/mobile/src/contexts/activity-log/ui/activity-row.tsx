import { ActivityRow as ActivityRowView, usePalette } from '@cityturfer/ui';

import { TYPE_GLYPH } from '@/constants/activity';
import { useT } from '@/i18n';
import { distanceText, formatDate, formatDuration, formatPaceOrSpeed } from '@/ui-kit/format';
import { ActivitySymbol } from '@/ui-kit/symbol';

import type { ActivityListItem } from '../contract';

/** One activity in History and on the Dashboard: formats the item for the design-system row. */
export function ActivityRow({
  item,
  onPress,
  testID,
}: {
  item: ActivityListItem;
  onPress: () => void;
  testID?: string;
}) {
  const p = usePalette();
  const t = useT('activity');
  const pace = formatPaceOrSpeed(item.type, item.distanceM, item.movingS);
  const estimated = item.estimatedDistanceM > 0;
  return (
    <ActivityRowView
      type={item.type}
      glyph={TYPE_GLYPH[item.type]}
      icon={<ActivitySymbol type={item.type} size={20} color={p.text} />}
      title={item.name}
      subtitle={formatDate(item.startedAt)}
      value={`${estimated ? '≈ ' : ''}${distanceText(item.distanceM)}`}
      detail={`${formatDuration(item.movingS)} · ${pace.value}${pace.unit}`}
      accessibilityLabel={t('rowLabel', {
        estimated: estimated ? 'yes' : 'no',
        name: item.name,
        date: formatDate(item.startedAt),
        distance: distanceText(item.distanceM),
      })}
      onPress={onPress}
      testID={testID}
    />
  );
}
