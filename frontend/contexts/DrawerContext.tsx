import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppDrawer } from '../components/AppDrawer';

type DrawerContextValue = {
  open: () => void;
  close: () => void;
};

const DrawerContext = createContext<DrawerContextValue>({
  open: () => {},
  close: () => {},
});

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <AppDrawer visible={visible} onClose={close} />
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  return useContext(DrawerContext);
}
