/**
 * Theme Service
 *
 * Centralized theme management for the application.
 * Provides theme configuration, presets, state management, and application logic.
 *
 * @example
 * // Import types
 * import { ThemeStyles, ThemePreset, ThemeEditorState } from "@/services/theme";
 *
 * // Import config
 * import { defaultThemeState, COMMON_STYLES } from "@/services/theme";
 *
 * // Import stores
 * import { useEditorStore, useThemePresetStore } from "@/services/theme";
 *
 * // Import provider/hooks
 * import { ThemeProvider, useTheme, ThemeLoader } from "@/services/theme";
 *
 * // Import presets
 * import { defaultPresets, getPresetThemeStyles } from "@/services/theme";
 *
 * // Import apply utilities
 * import { applyThemeToElement } from "@/services/theme";
 */

// ============================================================================
// Types
// ============================================================================
export type {
  ThemeStyleProps,
  ThemeStyles,
  ThemeStylesWithoutSpacing,
  ThemePreset,
  ThemeEditorPreviewProps,
  ThemeEditorControlsProps,
  BaseEditorState,
  EditorControls,
  EditorPreviewProps,
  ThemeEditorState,
  EditorType,
  EditorConfig,
  ThemeMode,
} from "./types";

export {
  themeStylePropsSchema,
  themeStylesSchema,
  themeStylePropsSchemaWithoutSpacing,
  themeStylesSchemaWithoutSpacing,
} from "./types";

// ============================================================================
// Config
// ============================================================================
export {
  COMMON_STYLES,
  DEFAULT_FONT_SANS,
  DEFAULT_FONT_SERIF,
  DEFAULT_FONT_MONO,
  defaultLightThemeStyles,
  defaultDarkThemeStyles,
  defaultThemeState,
} from "./config";

// ============================================================================
// Store
// ============================================================================
export { useEditorStore, useThemePresetStore } from "./store";

// ============================================================================
// Presets
// ============================================================================
export {
  defaultPresets,
  getBuiltInThemeStyles,
  getPresetThemeStyles,
} from "./presets";

// ============================================================================
// Apply Utilities
// ============================================================================
export {
  applyStyleToElement,
  applyThemeToElement,
  getShadowMap,
  setShadowVariables,
} from "./apply";

// ============================================================================
// Hooks
// ============================================================================
export { useThemePresetFromUrl } from "./hooks";

// ============================================================================
// Utils
// ============================================================================
export {
  colorFormatter,
  convertToHSL,
  formatHsl,
  formatNumber,
  type ColorFormat,
} from "./utils/color-converter";

// ============================================================================
// Provider & Components
// ============================================================================
export { ThemeProvider, useTheme } from "./provider";
export { ThemeLoader } from "./loader";
