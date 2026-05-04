/**
 * Activity tab — Runs and Walks as one pillar, two segments.
 * Drill-downs live on ActivityStack (see App.tsx).
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../components/AppHeader';
import { RunsTabScreen } from './RunsTabScreen';
import { WalkScreen } from './WalkScreen';
import { colors, spacing, typography, radius } from '../theme/colors';

type Segment = 'runs' | 'walks';

export function ActivityScreen({ navigation, route }: { navigation: any; route: any }) {
  const [segment, setSegment] = useState<Segment>('runs');

  useFocusEffect(
    useCallback(() => {
      const s = route?.params?.segment;
      if (s === 'runs' || s === 'walks') setSegment(s);
    }, [route?.params?.segment]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />

      <View style={styles.segRow}>
        {(['runs', 'walks'] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.segBtn, segment === s && styles.segBtnOn]}
            onPress={() => {
              setSegment(s);
              try {
                navigation.setParams({ segment: s, focusRunId: undefined });
              } catch {}
            }}
          >
            <Text style={[styles.segTxt, segment === s && styles.segTxtOn]}>
              {s === 'runs' ? 'Runs' : 'Walks'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {segment === 'runs' ? (
          <RunsTabScreen navigation={navigation} route={route} embedded />
        ) : (
          <WalkScreen navigation={navigation} route={route} embedded />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  segBtnOn: { backgroundColor: colors.primary },
  segTxt: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  segTxtOn: { color: '#fff' },
  body: { flex: 1 },
});
