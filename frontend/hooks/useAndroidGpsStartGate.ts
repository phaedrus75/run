import { useCallback, useRef, useState } from 'react';
import {
  dismissAndroidBackgroundTip,
  isAndroidBackgroundTipDismissed,
  shouldOfferAndroidBackgroundTip,
} from '../services/androidBackgroundTip';

/**
 * Shows the MIUI background-tip modal once before the first GPS
 * start on Android, then runs the pending navigation action.
 */
export function useAndroidGpsStartGate() {
  const [tipVisible, setTipVisible] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const runGpsStart = useCallback(async (action: () => void) => {
    if (!shouldOfferAndroidBackgroundTip()) {
      action();
      return;
    }
    const dismissed = await isAndroidBackgroundTipDismissed();
    if (dismissed) {
      action();
      return;
    }
    pendingAction.current = action;
    setTipVisible(true);
  }, []);

  const onTipContinue = useCallback(() => {
    setTipVisible(false);
    const fn = pendingAction.current;
    pendingAction.current = null;
    fn?.();
  }, []);

  const onTipCancel = useCallback(() => {
    setTipVisible(false);
    pendingAction.current = null;
  }, []);

  return {
    tipVisible,
    runGpsStart,
    onTipContinue,
    onTipCancel,
  };
}
