import { createNavigationContainerRef } from '@react-navigation/native';

/** Global ref so the slide-out drawer can navigate without being a screen. */
export const navigationRef = createNavigationContainerRef<any>();
