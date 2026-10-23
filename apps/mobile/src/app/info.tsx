import { NAME, RADIUS, SPACE, TAGLINE } from '@cityturfer/brand';
import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useGapEstimationSetting } from '@/contexts/activity-log/ui/hooks';
import { BackupDeveloperCard } from '@/contexts/cloud-backup/ui/backup-developer-card';
import { CloudBackupCard } from '@/contexts/cloud-backup/ui/cloud-backup-card';
import { AppleHealthCard } from '@/contexts/health-sync/ui/apple-health-card';
import { removeDemoHistory, seedDemoHistory } from '@/dev/demo-history';
import { seedHealthWorkouts } from '@/dev/health-seed';
import { LANGUAGE_SETTINGS, type LanguageSetting, type Locale, useLanguageSetting, useT } from '@/i18n';
import { useContainer } from '@/ui-kit/app-context';
import { Button, Card, tint } from '@/ui-kit/components';
import { AppSymbol } from '@/ui-kit/symbol';
import { usePalette } from '@/ui-kit/theme';

/** Long-presses on the version text needed to reveal developer tools in release builds. */
const DEV_TAPS = 5;

/**
 * System · English · Polski. The language names are always in their own language; System shows
 * what it resolves to on this phone. A choice applies at once.
 */
function LanguageCard() {
  const p = usePalette();
  const t = useT('common');
  const [language, setLanguage] = useLanguageSetting();
  const name = (l: Locale) => (l === 'pl' ? t('language.polish') : t('language.english'));
  const label = (o: LanguageSetting) => (o === 'system' ? t('language.system') : name(o));
  const choose = (o: LanguageSetting) =>
    setLanguage(o).catch(() => Alert.alert(t('couldNotSave'), t('language.saveFailed')));
  return (
    <Card style={{ gap: 10 }}>
      <Text style={[s.h2, { color: p.text }]} accessibilityRole='header'>
        {t('language.title')}
      </Text>
      <View testID='language-row' style={s.options} accessibilityRole='radiogroup'>
        {LANGUAGE_SETTINGS.map((o) => {
          const selected = language.setting === o;
          return (
            <Pressable
              key={o}
              testID={`language-${o}`}
              accessibilityRole='radio'
              accessibilityLabel={
                o === 'system' ? t('language.systemOptionLabel', { language: name(language.system) }) : label(o)
              }
              accessibilityState={{ selected, checked: selected }}
              onPress={() => void choose(o)}
              style={[
                s.option,
                { borderColor: selected ? ACCENT : p.border, backgroundColor: selected ? tint(ACCENT) : 'transparent' },
              ]}
            >
              <View style={s.optionTitle}>
                {selected && <AppSymbol name='checkmark' fallback='✓' size={14} color={p.text} />}
                <Text style={[s.optionText, { color: p.text, fontWeight: selected ? '800' : '600' }]} numberOfLines={1}>
                  {label(o)}
                </Text>
              </View>
              {o === 'system' && (
                <Text style={{ color: p.muted, fontSize: 13 }} numberOfLines={1}>
                  {name(language.system)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export default function InfoScreen() {
  const p = usePalette();
  const c = useContainer();
  const [seeding, setSeeding] = useState<string | null>(null);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const taps = useRef(0);
  const showDevTools = __DEV__ || devUnlocked;
  const [checking, setChecking] = useState<string | null>(null);
  const [estimateGaps, setEstimateGaps] = useGapEstimationSetting();

  const seed = async () => {
    try {
      setSeeding('Finding your location…');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const n = await seedDemoHistory(c, { lat: pos.coords.latitude, lon: pos.coords.longitude }, 90, (d, t) =>
        setSeeding(`Importing ${d}/${t}…`)
      );
      Alert.alert('Demo history added', `${n} activities around your location. Open the Turf tab.`);
    } catch (e) {
      Alert.alert('Could not seed', String((e as Error).message ?? e));
    } finally {
      setSeeding(null);
    }
  };

  const seedHealth = async () => {
    try {
      setSeeding('Writing to Apple Health…');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const n = await seedHealthWorkouts({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      Alert.alert('Health workouts added', `${n} workouts with routes are in Apple Health. Tap Import now.`);
    } catch (e) {
      Alert.alert('Could not seed Health', String((e as Error).message ?? e));
    } finally {
      setSeeding(null);
    }
  };

  const removeDemo = () =>
    Alert.alert('Remove demo data?', 'Deletes all demo activities and releases the turf they claimed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSeeding('Removing demo data…');
            const n = await removeDemoHistory(c);
            Alert.alert('Demo data removed', `${n} demo activities deleted.`);
          } catch (e) {
            Alert.alert('Could not remove', String((e as Error).message ?? e));
          } finally {
            setSeeding(null);
          }
        },
      },
    ]);

  const onVersionLongPress = () => {
    if (++taps.current >= DEV_TAPS && !devUnlocked) {
      setDevUnlocked(true);
      Alert.alert('Developer tools', 'Developer tools are now visible on this screen.');
    }
  };

  const checkForUpdates = async () => {
    try {
      setChecking('Checking…');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setChecking('Up to date');
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      Alert.alert('Update failed', String((e as Error).message ?? e));
      setChecking(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: SPACE.lg, gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>App version</Text>
        <Pressable testID='app-version-press' accessibilityRole='text' onLongPress={onVersionLongPress}>
          <Text testID='app-version' style={{ color: p.muted, fontSize: 13 }}>
            {Updates.isEnabled
              ? `Update ${Updates.updateId?.slice(0, 8) ?? 'embedded'} · ${Updates.createdAt ? Updates.createdAt.toLocaleString() : 'built in'}${Updates.channel ? ` · ${Updates.channel}` : ''}`
              : 'Development build (updates come from Metro)'}
          </Text>
        </Pressable>
        {Updates.isEnabled && (
          <Button
            testID='check-updates'
            label={checking ?? 'Check for updates'}
            color={p.border}
            textColor={p.text}
            busy={checking === 'Checking…'}
            onPress={checkForUpdates}
          />
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>Your data</Text>
        <Text style={{ color: p.muted }}>
          Activities and turf live on this phone; they reach our server only if you turn on Cloud backup below. When GPS
          drops out, just the two ends of the gap are sent to the OpenStreetMap router to estimate the street route —
          never your whole track.
        </Text>
        <View style={s.row}>
          <Text style={[s.label, { color: p.text }]}>Estimate GPS gaps along streets</Text>
          <Switch
            testID='estimate-gaps-switch'
            accessibilityLabel='Estimate GPS gaps along streets'
            value={estimateGaps ?? false}
            disabled={estimateGaps == null}
            onValueChange={(on) =>
              setEstimateGaps(on).catch((e) => Alert.alert('Could not save', String((e as Error).message ?? e)))
            }
            trackColor={{ true: ACCENT, false: p.border }}
          />
        </View>
        <Text style={{ color: p.muted, fontSize: 13 }}>
          Off: no requests leave the phone; gaps stay as dashed straight lines.
        </Text>
      </Card>
      <AppleHealthCard />
      <CloudBackupCard />
      <LanguageCard />
      {showDevTools && (
        <Card style={{ gap: 10 }}>
          <Text style={[s.h2, { color: p.text }]}>Developer tools</Text>
          <Text style={{ color: p.muted }}>
            Generate 90 days of walks, runs and rides around your current location to preview the Turf map.
          </Text>
          <Button
            testID='seed-demo'
            label={seeding ?? 'Seed demo history'}
            color={p.border}
            textColor={p.text}
            onPress={seed}
            busy={!!seeding}
          />
          {Platform.OS === 'ios' && (
            <Button
              testID='seed-health'
              label='Add sample workouts to Apple Health'
              color={p.border}
              textColor={p.text}
              onPress={seedHealth}
              disabled={!!seeding}
            />
          )}
          <Button
            testID='remove-demo'
            label='Remove demo data'
            color={p.border}
            textColor={p.danger}
            onPress={removeDemo}
            disabled={!!seeding}
          />
        </Card>
      )}
      {showDevTools && <BackupDeveloperCard />}
      <Text style={{ color: p.muted, textAlign: 'center', fontSize: 12 }}>{`${NAME} · ${TAGLINE}`}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  options: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 2,
    gap: 2,
  },
  optionTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionText: { fontSize: 15 },
});
