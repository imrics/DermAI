import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = tintColorLight;
const appGradientStart = '#F4F1FF';
const appGradientEnd   = '#F8F5FF';

export const Warning = {
  bg: '#FDECEC',        
  text: '#8A1C1C',
  border: '#F6CACA',
};

export const CardColors = {
  norwood: '#FFE4CC',
  acne:    '#E7E3FF',
  skin:    '#E7E3FF',
  moles:   '#DDF3FF',
};

export const TextColors = {
  primary: '#1C1C1E',
  secondary: '#6B7280',
};

// Brand palette (centralized)
export const Brand = {
  purple: '#1D4ED8', // updated brand primary (blue)
  purpleSoft: '#3B82F6', // lighter variant
};

export const Radii = { sm: 12, md: 16, lg: 24, xl: 32 };
export const spacing = (n: number) => n * 8;

export const AppGradient = {
  light: [appGradientStart, appGradientEnd] as const,
  dark: [appGradientStart, appGradientEnd] as const,
};

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorDark,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
