/**
 * 🏃 RUN TYPE BUTTON
 * ==================
 * 
 * A beautiful button for selecting run distances.
 * 
 * 🎓 LEARNING NOTES:
 * - This is a "reusable component" - we can use it many times
 * - Props are like function arguments - they customize behavior
 * - StyleSheet.create() is more efficient than inline styles
 */

import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ViewStyle 
} from 'react-native';
import { colors, shadows, radius, spacing, typography } from '../theme/colors';

// 📋 Props interface - what can be passed to this component
interface RunTypeButtonProps {
  type: string;           // "3k", "5k", etc.
  selected?: boolean;     // Is this button currently selected?
  onPress: () => void;    // Function to call when pressed
  style?: ViewStyle;      // Optional additional styles
  size?: 'small' | 'medium' | 'large';
}

export function RunTypeButton({ 
  type, 
  selected = false, 
  onPress,
  style,
  size = 'medium',
}: RunTypeButtonProps) {
  // 🎨 Get the color for this run type
  const typeColor = colors.runTypes[type] || colors.primary;
  
  // 📐 Get size dimensions
  const dimensions = {
    small: { width: 60, height: 60, fontSize: typography.sizes.md },
    medium: { width: 80, height: 80, fontSize: typography.sizes.lg },
    large: { width: 100, height: 100, fontSize: typography.sizes.xl },
  }[size];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        {
          width: dimensions.width,
          height: dimensions.height,
          backgroundColor: selected ? typeColor : colors.surface,
          borderColor: typeColor,
        },
        selected && shadows.medium,
        style,
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? colors.textOnPrimary : typeColor,
            fontSize: dimensions.fontSize,
          },
        ]}
      >
        {type.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.xs,
  },
  text: {
    fontWeight: typography.weights.bold,
  },
});
