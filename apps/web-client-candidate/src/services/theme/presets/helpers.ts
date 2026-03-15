import { defaultThemeState } from "../config";
import { ThemeStyles } from "../types";
import { useThemePresetStore } from "../store/preset-store";
import { defaultPresets } from "./built-in";

/**
 * Get built-in theme styles by name (without using store).
 * Use this for server-side code where store access is not available.
 */
export function getBuiltInThemeStyles(
  name: string
): { name: string; styles: ThemeStyles } | null {
  const preset = defaultPresets[name];
  if (!preset) {
    return null;
  }

  const styles = mergePresetWithDefaults(preset.styles);
  return {
    name: preset.label || name,
    styles,
  };
}

function mergePresetWithDefaults(presetStyles: {
  light?: Partial<ThemeStyles["light"]>;
  dark?: Partial<ThemeStyles["dark"]>;
}): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  return {
    light: {
      ...defaultTheme.light,
      ...(presetStyles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(presetStyles.light || {}),
      ...(presetStyles.dark || {}),
    },
  };
}

/**
 * Get theme styles for a preset by name using the store.
 */
export function getPresetThemeStyles(name: string): ThemeStyles {
  if (name === "default") {
    return defaultThemeState.styles;
  }

  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset) {
    return defaultThemeState.styles;
  }

  return mergePresetWithDefaults(preset.styles);
}
