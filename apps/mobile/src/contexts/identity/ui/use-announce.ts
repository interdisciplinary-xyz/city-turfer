import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Says a message out loud when it appears or changes. Android reads the text's
 * `accessibilityLiveRegion`; iOS ignores live regions, so VoiceOver is told here (iOS only, so
 * TalkBack doesn't hear it twice). `everywhere`: the text is hidden from the accessibility tree
 * (no live region to read), so TalkBack is told here too.
 */
export function useAnnounce(message: string | null | undefined | false, everywhere = false): void {
  useEffect(() => {
    if (message && (everywhere || Platform.OS === 'ios')) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message, everywhere]);
}
