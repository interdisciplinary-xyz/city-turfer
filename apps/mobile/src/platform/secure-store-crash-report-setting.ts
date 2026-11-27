import * as SecureStore from 'expo-secure-store';

import type { CrashReportSetting } from './error-reporter';

const KEY = 'cityturfer.settings.crash-reports';

/**
 * "Send crash reports": one device-wide on/off value, read before crash reporting starts. Unset
 * means on (legitimate interest, with this opt-out); '0' means the Turfer turned it off.
 */
export class SecureStoreCrashReportSetting implements CrashReportSetting {
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
