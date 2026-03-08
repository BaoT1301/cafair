import { colorFormatter } from "../utils/color-converter";
import { ThemeEditorState } from "../types";
import { defaultThemeState } from "../config";
import { applyStyleToElement } from "./apply-style";

/**
 * Get a map of shadow CSS variables based on theme state.
 */
export const getShadowMap = (themeEditorState: ThemeEditorState) => {
  const mode = themeEditorState.currentMode;
  const styles = {
    ...defaultThemeState.styles[mode],
    ...themeEditorState.styles[mode],
  };

  const shadowColor = styles["shadow-color"];
  const hsl = colorFormatter(shadowColor, "hsl", "3");
  const offsetX = styles["shadow-offset-x"];
  const offsetY = styles["shadow-offset-y"];
  const blur = styles["shadow-blur"];
  const spread = styles["shadow-spread"];
  const opacity = parseFloat(styles["shadow-opacity"]);
  const color = (opacityMultiplier: number) =>
    `hsl(${hsl} / ${(opacity * opacityMultiplier).toFixed(2)})`;

  const secondLayer = (fixedOffsetY: string, fixedBlur: string): string => {
    const offsetX2 = offsetX;
    const offsetY2 = fixedOffsetY;
    const blur2 = fixedBlur;
    const spread2 =
      (parseFloat(spread?.replace("px", "") ?? "0") - 1).toString() + "px";
    const color2 = color(1.0);

    return `${offsetX2} ${offsetY2} ${blur2} ${spread2} ${color2}`;
  };

  const shadowMap: { [key: string]: string } = {
    "shadow-2xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`,
    "shadow-xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`,
    "shadow-2xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(2.5)}`,

    "shadow-sm": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0,
    )}, ${secondLayer("1px", "2px")}`,
    shadow: `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0,
    )}, ${secondLayer("1px", "2px")}`,

    "shadow-md": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0,
    )}, ${secondLayer("2px", "4px")}`,

    "shadow-lg": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0,
    )}, ${secondLayer("4px", "6px")}`,

    "shadow-xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0,
    )}, ${secondLayer("8px", "10px")}`,
  };

  return shadowMap;
};

/**
 * Set shadow CSS variables on the document element.
 */
export function setShadowVariables(themeEditorState: ThemeEditorState) {
  const root = document.documentElement;

  const shadows = getShadowMap(themeEditorState);
  Object.entries(shadows).forEach(([name, value]) => {
    applyStyleToElement(root, name, value);
  });
}
