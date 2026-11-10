import { router } from 'expo-router';

import { GoalEditor } from '@/contexts/goals/ui/goal-editor';

/** Start tab card or Me › Daily goal → the Daily goal editor (modal). */
export default function GoalScreen() {
  return <GoalEditor onDone={() => router.back()} />;
}
