import { router } from 'expo-router';

import { RecordView } from '@/contexts/recording/ui/RecordView';

export default function RecordScreen() {
  return <RecordView onFinished={(id) => router.push(`/activity/${id}`)} />;
}
