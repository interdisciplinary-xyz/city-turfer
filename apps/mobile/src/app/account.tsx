import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/ui-kit/app-context';
import { Button, Card } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

export default function AccountScreen() {
  const p = usePalette();
  const { auth, signOut } = useApp();
  const user = auth.status === 'signed-in' ? auth.user : null;
  const rows: [string, string][] = [
    ['Email', user?.email ?? '—'],
    ['Sign-in', 'Demo account (proof of concept)'],
    ['Data', 'Stored on this phone only'],
  ];
  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Card>
        {rows.map(([k, v], i) => (
          <View
            key={k}
            style={[s.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }]}
          >
            <Text style={[s.key, { color: p.muted }]}>{k}</Text>
            <Text style={[s.value, { color: p.text }]}>{v}</Text>
          </View>
        ))}
      </Card>
      <Button
        testID='sign-out'
        label='Sign out'
        color={p.border}
        textColor={p.text}
        onPress={async () => {
          if ((await signOut()) === 'recording-in-progress') {
            Alert.alert('Recording in progress', 'Finish or discard your recording first.');
          }
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: 12, gap: 2 },
  key: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontSize: 16 },
});
