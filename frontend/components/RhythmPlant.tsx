import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
import { colors } from '../theme/colors';

interface RhythmPlantProps {
  weeks: number;
  paused?: boolean;
  size?: 'small' | 'large';
}

function getStage(weeks: number) {
  if (weeks >= 10) return 'blooming';
  if (weeks >= 9)  return 'budding';
  if (weeks >= 6)  return 'maturing';
  if (weeks >= 4)  return 'growing';
  if (weeks >= 2)  return 'seedling';
  if (weeks >= 1)  return 'sprout';
  return 'seed';
}

export function RhythmPlant({ weeks, paused = false, size = 'large' }: RhythmPlantProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const stage = getStage(weeks);
  const dim = size === 'small' ? 32 : 64;

  const stemCol  = paused ? '#B0A89F' : '#6BA386';
  const leafCol  = paused ? '#C5BDB5' : '#7EC8A0';
  const rootCol  = paused ? '#C5BDB580' : '#8B7355';
  const soilCol  = paused ? '#C5BDB5' : '#A0896E';
  const bloomCol = paused ? '#C5BDB5' : colors.primary;
  const budCol   = paused ? '#C5BDB5' : '#8DD4A8';
  const centerCol = '#FFE4B5';

  useEffect(() => {
    scaleAnim.setValue(0.85);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [weeks]);

  // viewBox is 48x64, scaled to dim
  return (
    <Animated.View style={{ width: dim, height: dim, transform: [{ scale: scaleAnim }] }}>
      <Svg width={dim} height={dim} viewBox="0 0 48 64">
        {/* Soil */}
        <Ellipse cx="24" cy="38" rx="18" ry="3" fill={soilCol} opacity={0.35} />
        <Path d="M6 37 Q24 40 42 37" stroke={soilCol} strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Roots */}
        {stage !== 'seed' && (
          <G>
            {/* Center root */}
            <Path d="M24 38 Q24 46 23 52" stroke={rootCol} strokeWidth="1.2" fill="none" strokeLinecap="round" />
            {(stage === 'seedling' || stage === 'growing' || stage === 'maturing' || stage === 'budding' || stage === 'blooming') && (
              <>
                <Path d="M24 39 Q20 44 17 49" stroke={rootCol} strokeWidth="1" fill="none" strokeLinecap="round" />
                <Path d="M24 39 Q28 44 31 49" stroke={rootCol} strokeWidth="1" fill="none" strokeLinecap="round" />
              </>
            )}
            {(stage === 'growing' || stage === 'maturing' || stage === 'budding' || stage === 'blooming') && (
              <>
                <Path d="M24 40 Q18 46 14 53" stroke={rootCol} strokeWidth="0.8" fill="none" strokeLinecap="round" />
                <Path d="M24 40 Q30 46 34 53" stroke={rootCol} strokeWidth="0.8" fill="none" strokeLinecap="round" />
              </>
            )}
            {(stage === 'maturing' || stage === 'budding' || stage === 'blooming') && (
              <>
                <Path d="M22 42 Q16 48 12 56" stroke={rootCol} strokeWidth="0.7" fill="none" strokeLinecap="round" />
                <Path d="M26 42 Q32 48 36 56" stroke={rootCol} strokeWidth="0.7" fill="none" strokeLinecap="round" />
                <Path d="M20 44 Q19 50 20 55" stroke={rootCol} strokeWidth="0.6" fill="none" strokeLinecap="round" />
                <Path d="M28 44 Q29 50 28 55" stroke={rootCol} strokeWidth="0.6" fill="none" strokeLinecap="round" />
              </>
            )}
          </G>
        )}

        {/* Seed */}
        {stage === 'seed' && (
          <G>
            <Ellipse cx="24" cy="36" rx="3" ry="2.5" fill={rootCol} />
            <Path d="M24 33.5 Q25 32 24.5 30" stroke={stemCol} strokeWidth="0.8" fill="none" strokeLinecap="round" />
          </G>
        )}

        {/* Stem */}
        {stage === 'sprout' && (
          <Path d="M24 37 Q24 32 24.5 28" stroke={stemCol} strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {stage === 'seedling' && (
          <Path d="M24 37 Q24 30 24 22" stroke={stemCol} strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {stage === 'growing' && (
          <Path d="M24 37 Q24 28 24 18" stroke={stemCol} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
        {(stage === 'maturing' || stage === 'budding' || stage === 'blooming') && (
          <Path d="M24 37 Q23.5 26 24 13" stroke={stemCol} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* Leaves */}
        {stage === 'sprout' && (
          <G>
            <Path d="M24.5 29 Q22 26 19 27 Q21 30 24 29" fill={leafCol} />
          </G>
        )}
        {stage === 'seedling' && (
          <G>
            <Path d="M24 26 Q20 22 16 24 Q19 27 24 26" fill={leafCol} />
            <Path d="M24 22 Q28 19 31 21 Q28 24 24 22" fill={leafCol} />
          </G>
        )}
        {stage === 'growing' && (
          <G>
            <Path d="M24 28 Q19 23 14 25 Q18 29 24 28" fill={leafCol} />
            <Path d="M24 22 Q29 17 34 19 Q30 23 24 22" fill={leafCol} />
            <Path d="M24 18 Q20 15 17 17 Q20 20 24 18" fill={leafCol} opacity={0.85} />
          </G>
        )}
        {(stage === 'maturing' || stage === 'budding' || stage === 'blooming') && (
          <G>
            <Path d="M24 30 Q18 25 13 27 Q17 31 24 30" fill={leafCol} />
            <Path d="M24 24 Q30 19 35 21 Q31 25 24 24" fill={leafCol} />
            <Path d="M24 19 Q18 14 14 17 Q18 21 24 19" fill={leafCol} />
            <Path d="M24 15 Q29 11 33 14 Q29 17 24 15" fill={leafCol} opacity={0.85} />
          </G>
        )}

        {/* Bud */}
        {(stage === 'budding' || (stage === 'blooming' && paused)) && (
          <G>
            <Path d="M24 13 Q21 9 22 6 Q24 8 24 6 Q24 8 26 6 Q27 9 24 13" fill={budCol} />
          </G>
        )}

        {/* Bloom */}
        {stage === 'blooming' && !paused && (
          <G>
            {/* Petals */}
            <Ellipse cx="24" cy="5.5" rx="3.5" ry="4" fill={bloomCol} opacity={0.9} />
            <Ellipse cx="19.5" cy="8" rx="3.5" ry="3" fill={bloomCol} opacity={0.8} transform="rotate(-30 19.5 8)" />
            <Ellipse cx="28.5" cy="8" rx="3.5" ry="3" fill={bloomCol} opacity={0.8} transform="rotate(30 28.5 8)" />
            <Ellipse cx="20.5" cy="12" rx="3" ry="2.5" fill={bloomCol} opacity={0.7} transform="rotate(-15 20.5 12)" />
            <Ellipse cx="27.5" cy="12" rx="3" ry="2.5" fill={bloomCol} opacity={0.7} transform="rotate(15 27.5 12)" />
            {/* Center */}
            <Circle cx="24" cy="9" r="2.8" fill={centerCol} />
            <Circle cx="24" cy="9" r="1.5" fill={bloomCol} opacity={0.3} />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}
