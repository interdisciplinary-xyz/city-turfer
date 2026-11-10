import { Card, DayStrip, type DayStripDay } from '@cityturfer/ui';
import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const NAMES = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
const LONG = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Today'];

/** A week of minutes against a 30-minute goal; `null` = no goal that day. */
const week = (minutes: number[], goals: (number | null)[] = minutes.map(() => 30)): DayStripDay[] =>
  minutes.map((done, i) => {
    const goal = goals[i];
    const met = goal != null && done >= goal;
    return {
      key: `day-${i}`,
      label: NAMES[i],
      progress: goal ? done / goal : 0,
      met,
      noTarget: goal == null,
      current: i === minutes.length - 1,
      accessibilityLabel:
        goal == null
          ? `${LONG[i]}: ${done} minutes, no goal set`
          : `${LONG[i]}: ${done} of ${goal} minutes${met ? ', goal met' : ''}`,
      testID: `goal-day-${i}`,
    };
  });

const meta = {
  title: 'App/DayStrip',
  component: DayStrip,
  args: { days: week([35, 12, 0, 48, 30, 5, 18]), style: { maxWidth: 360 } },
  parameters: {
    docs: {
      description: {
        component:
          'The last 7 days of the daily goal, oldest first, today last (bold label). Each column fills from the bottom by its share of that day’s goal; a met day is full with a check mark, an empty one an outline (`borderControl`), a day without a goal the same `borderControl` outline, dashed (quiet by its dash, not a fainter colour, so it keeps 3:1). A day under the goal is a partly filled day, never red. Each day is one element for a screen reader, units spelled out.',
      },
    },
  },
} satisfies Meta<typeof DayStrip>;

export default meta;

export const Default: StoryObj<typeof meta> = {};

/** Goal set on Saturday: the days before it have no goal. */
export const NewGoal: StoryObj<typeof meta> = {
  args: { days: week([20, 0, 45, 31, 0, 12, 0], [null, null, null, 30, 30, 30, 30]) },
};

export const AllMet: StoryObj<typeof meta> = { args: { days: week([30, 41, 35, 60, 32, 30, 44]) } };

/** In Polish: weekday names come from Intl in the app (`pon.`, `wt.`). */
export const Polish: StoryObj<typeof meta> = {
  args: {
    days: week([35, 12, 0, 48, 30, 5, 18]).map((d, i) => ({
      ...d,
      label: ['śr.', 'czw.', 'pt.', 'sob.', 'niedz.', 'pon.', 'wt.'][i],
    })),
  },
};

/** On a card, as on the Start tab. */
export const InACard: StoryObj<typeof meta> = {
  render: (args) => (
    <Card style={{ maxWidth: 360 }}>
      <DayStrip {...args} style={undefined} />
    </Card>
  ),
};
