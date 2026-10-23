import { NAME, RADIUS, SPACE } from '@cityturfer/brand';
import * as Updates from 'expo-updates';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ACCENT } from '@/constants/colors';
import { useGapEstimationSetting } from '@/contexts/activity-log/ui/hooks';
import { BackupDeveloperCard } from '@/contexts/cloud-backup/ui/backup-developer-card';
import { CloudBackupCard } from '@/contexts/cloud-backup/ui/cloud-backup-card';
import { AppleHealthCard } from '@/contexts/health-sync/ui/apple-health-card';
import { announceDeveloperTools, DeveloperToolsCard } from '@/dev/developer-tools';
import { LANGUAGE_SETTINGS, type LanguageSetting, type Locale, useLanguageSetting, useT } from '@/i18n';
import { Button, Card, tint } from '@/ui-kit/components';
import { formatDateTime } from '@/ui-kit/format';
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

/** What the update button shows: its label, a check running, or the check found nothing new. */
type UpdateCheck = 'idle' | 'checking' | 'upToDate';

export default function InfoScreen() {
  const p = usePalette();
  const t = useT('info');
  const tc = useT('common');
  const [devUnlocked, setDevUnlocked] = useState(false);
  const taps = useRef(0);
  const showDevTools = __DEV__ || devUnlocked;
  const [check, setCheck] = useState<UpdateCheck>('idle');
  const [estimateGaps, setEstimateGaps] = useGapEstimationSetting();

  const onVersionLongPress = () => {
    if (++taps.current >= DEV_TAPS && !devUnlocked) {
      setDevUnlocked(true);
      announceDeveloperTools();
    }
  };

  const checkForUpdates = async () => {
    try {
      setCheck('checking');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setCheck('upToDate');
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      Alert.alert(t('updateFailedTitle'), t('updateFailedBody'));
      setCheck('idle');
    }
  };

  const versionLine = t('versionLine', {
    id: Updates.updateId?.slice(0, 8) ?? 'embedded',
    created: Updates.createdAt ? formatDateTime(Updates.createdAt.getTime()) : 'builtIn',
    channel: Updates.channel || 'none',
  });

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={{ padding: SPACE.lg, gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>{t('appVersion')}</Text>
        <Pressable testID='app-version-press' accessibilityRole='text' onLongPress={onVersionLongPress}>
          <Text testID='app-version' style={{ color: p.muted, fontSize: 13 }}>
            {Updates.isEnabled ? versionLine : t('developmentBuild')}
          </Text>
        </Pressable>
        {Updates.isEnabled && (
          <Button
            testID='check-updates'
            label={t(check === 'idle' ? 'checkForUpdates' : check)}
            color={p.border}
            textColor={p.text}
            busy={check === 'checking'}
            onPress={checkForUpdates}
          />
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={[s.h2, { color: p.text }]}>{t('yourData')}</Text>
        <Text style={{ color: p.muted }}>{t('yourDataBody')}</Text>
        <View style={s.row}>
          <Text style={[s.label, { color: p.text }]}>{t('estimateGaps')}</Text>
          <Switch
            testID='estimate-gaps-switch'
            accessibilityRole='switch'
            accessibilityLabel={t('estimateGaps')}
            accessibilityState={{ checked: estimateGaps ?? false, disabled: estimateGaps == null }}
            value={estimateGaps ?? false}
            disabled={estimateGaps == null}
            onValueChange={(on) =>
              setEstimateGaps(on).catch(() => Alert.alert(tc('couldNotSave'), t('settingNotSaved')))
            }
            trackColor={{ true: ACCENT, false: p.border }}
          />
        </View>
        <Text style={{ color: p.muted, fontSize: 13 }}>{t('estimateGapsOff')}</Text>
      </Card>
      <AppleHealthCard />
      <CloudBackupCard />
      <LanguageCard />
      {showDevTools && <DeveloperToolsCard />}
      {showDevTools && <BackupDeveloperCard />}
      <Text style={{ color: p.muted, textAlign: 'center', fontSize: 12 }}>{t('footer', { name: NAME })}</Text>
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
