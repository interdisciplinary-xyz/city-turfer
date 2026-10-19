import { ActivityRow as ActivityRowView } from '@cityturfer/ui';

import { TYPE_GLYPH } from '@/constants/activity';
import { distanceText, formatDate, formatDuration, formatPaceOrSpeed } from '@/ui-kit/format';

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
  const pace = formatPaceOrSpeed(item.type, item.distanceM, item.movingS);
  const estimated = item.estimatedDistanceM > 0;
  return (
    <ActivityRowView
      type={item.type}
      glyph={TYPE_GLYPH[item.type]}
      title={item.name}
      subtitle={formatDate(item.startedAt)}
      value={`${estimated ? '≈ ' : ''}${distanceText(item.distanceM)}`}
      detail={`${formatDuration(item.movingS)} · ${pace.value}${pace.unit}`}
      accessibilityLabel={`${item.name}, ${formatDate(item.startedAt)}, ${estimated ? 'about ' : ''}${distanceText(item.distanceM)}`}
      onPress={onPress}
      testID={testID}
    />
  );
}
