import {
  ThemeEditorState,
  ThemeStyleProps,
  ThemeStyles,
  ThemeMode,
} from "../types";
import { colorFormatter } from "../utils/color-converter";
import { setShadowVariables } from "./shadows";
import { applyStyleToElement } from "./apply-style";
import { COMMON_STYLES } from "../config";

const COMMON_NON_COLOR_KEYS = COMMON_STYLES;

/**
 * Update the theme class on the root element.
 */
const updateThemeClass = (root: HTMLElement, mode: ThemeMode) => {
  if (mode === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
  }
};

/**
 * Apply common (non-color) styles to the root element.
 */
const applyCommonStyles = (root: HTMLElement, themeStyles: ThemeStyleProps) => {
  Object.entries(themeStyles)
    .filter(([key]) =>
      COMMON_NON_COLOR_KEYS.includes(
        key as (typeof COMMON_NON_COLOR_KEYS)[number],
      ),
    )
    .forEach(([key, value]) => {
      if (typeof value === "string") {
        applyStyleToElement(root, key, value);
      }
    });
};

/**
 * Apply theme colors to the root element.
 */
const applyThemeColors = (
  root: HTMLElement,
  themeStyles: ThemeStyles,
  mode: ThemeMode,
) => {
  Object.entries(themeStyles[mode]).forEach(([key, value]) => {
    if (
      typeof value === "string" &&
      !COMMON_NON_COLOR_KEYS.includes(
        key as (typeof COMMON_NON_COLOR_KEYS)[number],
      )
    ) {
      const hslValue = colorFormatter(value, "hsl", "4");
      applyStyleToElement(root, key, hslValue);
    }
  });
};

/**
 * Apply the complete theme state to a DOM element.
 */
export const applyThemeToElement = (
  themeState: ThemeEditorState,
  rootElement: HTMLElement,
) => {
  const { currentMode: mode, styles: themeStyles } = themeState;

  if (!rootElement) return;

  updateThemeClass(rootElement, mode);
  // Apply common styles (like border-radius) based on the 'light' mode definition
  applyCommonStyles(rootElement, themeStyles.light);
  // Apply mode-specific colors
  applyThemeColors(rootElement, themeStyles, mode);
  // Apply shadow variables
  setShadowVariables(themeState);
};
