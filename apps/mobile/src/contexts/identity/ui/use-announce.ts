import { useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Says an error out loud when it appears or changes. Android reads the text's
 * `accessibilityLiveRegion`; iOS ignores live regions, so VoiceOver is told here (iOS only, so
 * TalkBack doesn't hear it twice).
 */
export function useAnnounce(message: string | null | undefined | false): void {
  useEffect(() => {
    if (message && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
