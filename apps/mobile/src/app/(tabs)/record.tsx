import { router } from 'expo-router';

import { RecordView } from '@/contexts/recording/ui/record-view';

export default function RecordScreen() {
  return <RecordView onFinished={(id) => router.push(`/activity/${id}`)} />;
}
