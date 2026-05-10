/**
 * Activity tab — Runs / Walks / Journeys as one pillar, three segments.
 * Drill-downs (RunSummary, WalkDetail, JourneyDetail, etc.) live on
 * ActivityStack (see App.tsx).
 *
 * The active journey, when present, also sits as a quiet strip above the
 * Runs and Walks segments so the runner sees it while picking their next
 * activity.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader } from '../components/AppHeader';
import { RunsTabScreen } from './RunsTabScreen';
import { WalkScreen } from './WalkScreen';
import { JourneysScreen } from './JourneysScreen';
import { JourneyActiveCard } from '../components/JourneyActiveCard';
import { AppleHealthBanner } from '../components/AppleHealthBanner';
import { colors, spacing, typography, radius } from '../theme/colors';

type Segment = 'runs' | 'walks' | 'journeys';

export function ActivityScreen({ navigation, route }: { navigation: any; route: any }) {
  const [segment, setSegment] = useState<Segment>('runs');

  useFocusEffect(
    useCallback(() => {
      const s = route?.params?.segment;
      if (s === 'runs' || s === 'walks' || s === 'journeys') setSegment(s);
    }, [route?.params?.segment]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader />

      <View style={styles.segRow}>
        {(['runs', 'walks', 'journeys'] as const).map((s) => (
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
              {s === 'runs' ? 'Runs' : s === 'walks' ? 'Walks' : 'Journeys'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 🌅 Active journey peeks over the Runs/Walks segments so the runner
       * sees it while choosing their next activity. The Journeys segment
       * has its own card inside, so we suppress this strip there. */}
      {segment !== 'journeys' && (
        <View style={styles.journeyStripWrap}>
          <JourneyActiveCard
            onPress={(j) => navigation.navigate('JourneyDetail', { journeyId: j.id })}
          />
        </View>
      )}

      {/* 🍎 Apple Health import nudge — only renders on iOS when the user
       * has new HK workouts not yet in ZenRun. Self-hides otherwise. */}
      <AppleHealthBanner surface="activity" />


      <View style={styles.body}>
        {segment === 'runs' ? (
          <RunsTabScreen navigation={navigation} route={route} embedded />
        ) : segment === 'walks' ? (
          <WalkScreen navigation={navigation} route={route} embedded />
        ) : (
          <JourneysScreen navigation={navigation} embedded />
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
  journeyStripWrap: {
    paddingHorizontal: spacing.lg,
  },
  body: { flex: 1 },
});
