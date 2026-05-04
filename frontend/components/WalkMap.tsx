/**
 * 🗺️ WalkMap
 * ==========
 *
 * Cross-platform map wrapper around expo-maps. Renders an Apple map on iOS and
 * a Google map on Android. Used by the active walk screen, the walk detail
 * screen, and the public walks discovery screen.
 *
 * The web build does not include expo-maps; we render a lightweight
 * placeholder so screens still mount in Expo Go / web without crashing.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, typography } from '../theme/colors';

let AppleMaps: any = null;
let GoogleMaps: any = null;
try {
  const expoMaps = require('expo-maps');
  AppleMaps = expoMaps.AppleMaps;
  GoogleMaps = expoMaps.GoogleMaps;
} catch {
  // expo-maps not available (e.g. web build).
}

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  tintColor?: string;
}

export interface WalkMapProps {
  style?: ViewStyle;
  route?: MapPoint[];
  markers?: MapMarker[];
  centerOn?: MapPoint;
  zoom?: number;
  showUserLocation?: boolean;
  followUser?: boolean;
  routeColor?: string;
  routeWidth?: number;
  /** Enable pinch / pan / rotate on the map (default false for backward compatibility). */
  interactive?: boolean;
  /** Fired when the user taps a marker. Receives the marker's `id` so the
   *  caller can look up the underlying entity (e.g. a photo). */
  onMarkerPress?: (markerId: string) => void;
}

export const WalkMap = React.forwardRef<any, WalkMapProps>(function WalkMap(
  {
    style,
    route,
    markers,
    centerOn,
    zoom = 16,
    showUserLocation = true,
    routeColor = colors.primary,
    routeWidth = 6,
    interactive = false,
    onMarkerPress,
  },
  ref,
) {
  // Both AppleMaps and GoogleMaps in expo-maps fire `onMarkerClick` with an
  // event whose shape varies by version — sometimes `{ id }`, sometimes the
  // full marker object. Read defensively and pass the id back to the caller.
  const handleMarkerClick = React.useCallback(
    (event: any) => {
      if (!onMarkerPress) return;
      const id =
        event?.id ??
        event?.markerId ??
        event?.marker?.id ??
        event?.nativeEvent?.id ??
        null;
      if (typeof id === 'string') onMarkerPress(id);
    },
    [onMarkerPress],
  );
  if (!AppleMaps && !GoogleMaps) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderTitle}>Map preview</Text>
        <Text style={styles.placeholderHint}>
          Open this build on an iOS or Android device to see the map.
        </Text>
        {route && route.length > 0 && (
          <Text style={styles.placeholderHint}>
            {route.length} GPS points captured
          </Text>
        )}
      </View>
    );
  }

  const camera = centerOn
    ? { coordinates: { latitude: centerOn.lat, longitude: centerOn.lng }, zoom }
    : route && route.length > 0
      ? { coordinates: { latitude: route[0].lat, longitude: route[0].lng }, zoom }
      : undefined;

  if (Platform.OS === 'ios' && AppleMaps) {
    const polylines =
      route && route.length > 1
        ? [
            {
              id: 'walk-route',
              coordinates: route.map((p) => ({ latitude: p.lat, longitude: p.lng })),
              color: routeColor,
              width: routeWidth,
            },
          ]
        : undefined;
    const appleMarkers = (markers || []).map((m) => ({
      id: m.id,
      coordinates: { latitude: m.lat, longitude: m.lng },
      title: m.title,
      tintColor: m.tintColor || colors.primary,
      systemImage: 'mappin.circle.fill',
    }));
    const appleUi = interactive
      ? {
          compassEnabled: true,
          scaleBarEnabled: true,
          rotationGesturesEnabled: true,
          scrollGesturesEnabled: true,
          zoomGesturesEnabled: true,
          tiltGesturesEnabled: true,
        }
      : { compassEnabled: true, scaleBarEnabled: true };
    return (
      <AppleMaps.View
        ref={ref}
        style={[styles.map, style]}
        cameraPosition={camera}
        polylines={polylines}
        markers={appleMarkers.length ? appleMarkers : undefined}
        properties={{ isMyLocationEnabled: showUserLocation }}
        uiSettings={appleUi}
        onMarkerClick={onMarkerPress ? handleMarkerClick : undefined}
      />
    );
  }

  if (Platform.OS === 'android' && GoogleMaps) {
    const polylines =
      route && route.length > 1
        ? [
            {
              id: 'walk-route',
              coordinates: route.map((p) => ({ latitude: p.lat, longitude: p.lng })),
              color: routeColor,
              width: routeWidth,
            },
          ]
        : undefined;
    const googleMarkers = (markers || []).map((m) => ({
      id: m.id,
      coordinates: { latitude: m.lat, longitude: m.lng },
      title: m.title,
    }));
    const googleUi = interactive
      ? {
          compassEnabled: true,
          scaleBarEnabled: true,
          rotationGesturesEnabled: true,
          scrollGesturesEnabled: true,
          zoomGesturesEnabled: true,
          tiltGesturesEnabled: true,
          zoomControlsEnabled: true,
        }
      : undefined;
    return (
      <GoogleMaps.View
        ref={ref}
        style={[styles.map, style]}
        cameraPosition={camera}
        polylines={polylines}
        markers={googleMarkers.length ? googleMarkers : undefined}
        properties={{ isMyLocationEnabled: showUserLocation }}
        uiSettings={googleUi}
        onMarkerClick={onMarkerPress ? handleMarkerClick : undefined}
      />
    );
  }

  return <View style={[styles.placeholder, style]} />;
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: 4,
  },
  placeholderHint: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
