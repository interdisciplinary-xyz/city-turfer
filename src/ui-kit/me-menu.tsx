import { type Href, router } from 'expo-router';
import { type SFSymbol, SymbolView } from 'expo-symbols';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACCENT, ON_ACCENT } from '@/constants/colors';

import { useApp } from './app-context';
import { usePalette } from './theme';

const ITEMS: { label: string; href: Href; symbol: SFSymbol; glyph: string; testID: string }[] = [
  { label: 'Profile', href: '/profile', symbol: 'person.crop.circle', glyph: '◉', testID: 'me-menu-profile' },
  { label: 'Account', href: '/account', symbol: 'key', glyph: '⚿', testID: 'me-menu-account' },
  { label: 'Info', href: '/info', symbol: 'info.circle', glyph: 'ⓘ', testID: 'me-menu-info' },
];

const DURATION_MS = 220;
const CLOSE_DRAG_PX = 80;

/** The "Me" tab: slides in a drawer from the right instead of opening a screen. */
export function MeTabButton({ testID }: { testID?: string }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const color = open ? ACCENT : p.muted;
  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
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
      <MeDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function MeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(320, Math.round(screenW * 0.82));
  const { auth } = useApp();
  const user = auth.status === 'signed-in' ? auth.user : null;

  // Stay mounted until the slide-out finishes.
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(0)).current; // 0 closed … 1 open
  const drag = useRef(new Animated.Value(0)).current; // px dragged to the right while open

  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx > CLOSE_DRAG_PX || g.vx > 0.5) onClose();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  const translateX = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }), drag);
  const name = user?.displayName ?? 'You';

  return (
    <Modal visible={mounted} transparent animationType='none' onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        {/* Sibling, not parent, of the drawer: an accessible parent would hide the items from VoiceOver. */}
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel='Close menu' />
        </Animated.View>
        <Animated.View
          testID='me-drawer'
          accessibilityViewIsModal
          {...pan.panHandlers}
          style={[
            s.drawer,
            {
              width,
              backgroundColor: p.card,
              borderColor: p.border,
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateX }],
            },
          ]}
        >
          <Pressable
            testID='me-drawer-header'
            onPress={() => go('/profile')}
            accessibilityRole='button'
            accessibilityLabel={`${name}, ${user?.email ?? ''}. Open profile.`}
            style={s.header}
          >
            <View style={s.avatar}>
              <Text style={s.initial}>{name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={[s.name, { color: p.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: p.muted }} numberOfLines={1}>
              {user?.email}
            </Text>
          </Pressable>
          <View style={[s.list, { borderTopColor: p.border }]} accessibilityRole='menu'>
            {ITEMS.map((it) => (
              <Pressable
                key={it.label}
                testID={it.testID}
                onPress={() => go(it.href)}
                accessibilityRole='menuitem'
                style={({ pressed }) => [s.item, pressed && { backgroundColor: p.bg }]}
              >
                <SymbolView
                  name={it.symbol}
                  tintColor={ACCENT}
                  size={22}
                  fallback={<Text style={{ fontSize: 20, color: ACCENT }}>{it.glyph}</Text>}
                />
                <Text style={[s.itemLabel, { color: p.text }]}>{it.label}</Text>
                <Text style={{ color: p.muted, fontSize: 20 }}>›</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[s.footer, { color: p.muted }]}>
            CityTurfer
            {Updates.isEnabled && Updates.updateId ? ` · update ${Updates.updateId.slice(0, 8)}` : ''}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: -4, height: 0 },
    elevation: 16,
  },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 4 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  initial: { color: ON_ACCENT, fontSize: 28, fontWeight: '900' },
  name: { fontSize: 20, fontWeight: '900' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  itemLabel: { flex: 1, fontSize: 17, fontWeight: '600' },
  footer: { marginTop: 'auto', paddingHorizontal: 20, fontSize: 12 },
});
