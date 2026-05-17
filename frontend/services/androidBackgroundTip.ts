import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DISMISS_KEY = '@zenrun/android_background_tip_dismissed';

export function shouldOfferAndroidBackgroundTip(): boolean {
  return Platform.OS === 'android';
}

export async function isAndroidBackgroundTipDismissed(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(DISMISS_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function dismissAndroidBackgroundTip(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISS_KEY, '1');
  } catch {}
}
