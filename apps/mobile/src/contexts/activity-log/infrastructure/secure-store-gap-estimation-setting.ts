import * as SecureStore from 'expo-secure-store';

import type { GapEstimationSetting } from '../application/use-cases';

const KEY = 'cityturfer.settings.estimate-gaps';

/** One device-wide on/off value. Unset means on: the user opted in to street estimates. */
export class SecureStoreGapEstimationSetting implements GapEstimationSetting {
  private cached: boolean | null = null;

  async isEnabled(): Promise<boolean> {
    if (this.cached != null) {
      return this.cached;
    }
    let raw: string | null;
    try {
      raw = await SecureStore.getItemAsync(KEY);
    } catch {
      return false; // unreadable: do not risk ignoring an "off", ask again next time
    }
    this.cached = raw !== '0';
    return this.cached;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(KEY, enabled ? '1' : '0');
    this.cached = enabled;
  }
}
