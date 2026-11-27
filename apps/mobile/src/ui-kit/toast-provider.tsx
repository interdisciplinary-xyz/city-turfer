import { SPACE } from '@cityturfer/brand';
import { Toast } from '@cityturfer/ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { translator } from '@/i18n';

import { wordMessage } from './toast-message';
import {
  type QueuedToast,
  TOAST_FADE_MS,
  TOAST_MS,
  TOAST_QUEUE_MAX,
  type ToastApi,
  type ToastProviderProps,
  type ToastRequest,
} from './toast-provider.constants';

const Ctx = createContext<ToastApi | null>(null);

/**
 * Toasts for the whole app (root layout): a queue, one toast at a time under the status bar, each
 * closing by itself after a few seconds or on a tap. VoiceOver is told the message here (iOS ignores
 * live regions); TalkBack reads the toast's own live region. With Reduce Motion it appears without
 * a fade. On iOS the host is a full-window overlay, so it also shows over modal screens (Share photo).
 */
export function ToastProvider({ reporter, children }: ToastProviderProps) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((request: ToastRequest) => {
    const text = wordMessage(request.message);
    setQueue((q) => {
      if (q.some((t) => t.text === text && t.variant === request.variant)) {
        return q; // the same message is already showing or waiting
      }
      const next = [...q, { id: nextId.current++, variant: request.variant, text }];
      // The one on screen stays; the oldest waiting ones give way.
      return next.length > TOAST_QUEUE_MAX + 1 ? [next[0], ...next.slice(-TOAST_QUEUE_MAX)] : next;
    });
  }, []);

  const dismiss = useCallback((id: number) => setQueue((q) => q.filter((t) => t.id !== id)), []);
  const api = useMemo<ToastApi>(() => ({ show, reporter }), [show, reporter]);
  const current = queue[0];

  return (
    <Ctx.Provider value={api}>
      {children}
      {current && <ToastHost key={current.id} toast={current} onDone={dismiss} />}
    </Ctx.Provider>
  );
}

function ToastHost({ toast, onDone }: { toast: QueuedToast; onDone: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduceMotion(on))
      .catch(() => live && setReduceMotion(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(toast.text);
    }
    const timer = setTimeout(() => onDone(toast.id), TOAST_MS[toast.variant]);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, { toValue: 1, duration: TOAST_FADE_MS, useNativeDriver: true }).start();
  }, [reduceMotion, opacity]);

  const body = (
    <View pointerEvents='box-none' style={[s.layer, { paddingTop: insets.top + SPACE.sm }]}>
      <Animated.View style={[s.slot, { opacity }]} pointerEvents='box-none'>
        <Toast
          testID={`toast-${toast.variant}`}
          variant={toast.variant}
          message={toast.text}
          onDismiss={() => onDone(toast.id)}
          dismissHint={translator('common')('toast.dismissHint')}
        />
      </Animated.View>
    </View>
  );
  // iOS: a window above native modals (Share photo is a full-screen modal). Android draws the last
  // child of the root on top of the stack's screens anyway.
  return Platform.OS === 'ios' ? <FullWindowOverlay>{body}</FullWindowOverlay> : body;
}

/** The toast queue (inside ToastProvider). */
export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error('useToast outside ToastProvider');
  }
  return v;
}

const s = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingHorizontal: SPACE.lg },
  slot: { width: '100%', alignItems: 'center' },
});
