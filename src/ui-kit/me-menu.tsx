import { type Href, router } from 'expo-router';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT } from '@/constants/colors';

import { usePalette } from './theme';

const ITEMS: { label: string; href: Href; symbol: SFSymbol; glyph: string; testID: string }[] = [
  { label: 'Profile', href: '/profile', symbol: 'person.crop.circle', glyph: '◉', testID: 'me-menu-profile' },
  { label: 'Account', href: '/account', symbol: 'key', glyph: '⚿', testID: 'me-menu-account' },
  { label: 'Info', href: '/info', symbol: 'info.circle', glyph: 'ⓘ', testID: 'me-menu-info' },
];

/** The "Me" tab: opens a small menu above the tab bar instead of a screen. */
export function MeTabButton({ testID }: { testID?: string }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const color = open ? ACCENT : p.muted;
  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole='button'
        accessibilityLabel='Me'
        accessibilityState={{ expanded: open }}
        style={s.tab}
      >
        <SymbolView
          name='person.crop.circle'
          tintColor={color}
          size={24}
          fallback={<Text style={{ fontSize: 20, color }}>◉</Text>}
        />
        <Text style={[s.tabLabel, { color }]}>Me</Text>
      </Pressable>
      <Modal visible={open} transparent animationType='fade' onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          {/* Sibling, not parent, of the menu: an accessible parent would hide the items from VoiceOver. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel='Close menu' />
          <View
            style={[s.menu, { backgroundColor: p.card, borderColor: p.border, bottom: insets.bottom + 92 }]}
            accessibilityRole='menu'
          >
            {ITEMS.map((it, i) => (
              <Pressable
                key={it.label}
                testID={it.testID}
                onPress={() => go(it.href)}
                accessibilityRole='menuitem'
                style={({ pressed }) => [
                  s.item,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
                  pressed && { backgroundColor: p.bg },
                ]}
              >
                <SymbolView
                  name={it.symbol}
                  tintColor={ACCENT}
                  size={20}
                  fallback={<Text style={{ fontSize: 18, color: ACCENT }}>{it.glyph}</Text>}
                />
                <Text style={[s.itemLabel, { color: p.text }]}>{it.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute',
    right: 12,
    width: 220,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  itemLabel: { fontSize: 16, fontWeight: '600' },
});
