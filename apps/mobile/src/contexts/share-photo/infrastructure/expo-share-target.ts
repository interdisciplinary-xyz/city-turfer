import * as Sharing from 'expo-sharing';

import type { ShareTarget } from '../domain/ports';

/** The system share sheet (Instagram, WhatsApp, Save Image, AirDrop… whatever the phone offers). */
export class ExpoShareTarget implements ShareTarget {
  isAvailable(): Promise<boolean> {
    return Sharing.isAvailableAsync();
  }
  share(uri: string): Promise<void> {
    return Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  }
}
