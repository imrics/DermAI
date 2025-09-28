/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const ACTIVE_THEME: 'light' = 'light';
  const colorFromProps = props[ACTIVE_THEME];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[ACTIVE_THEME][colorName];
  }
}
