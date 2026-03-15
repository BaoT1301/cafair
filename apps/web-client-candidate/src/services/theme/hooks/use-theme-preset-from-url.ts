import { useQueryState } from "nuqs";
import React from "react";
import { useEditorStore } from "../store";

/**
 * Hook to apply theme preset from URL parameter (?theme=preset-name).
 * Removes the parameter after applying.
 */
export const useThemePresetFromUrl = () => {
  const [preset, setPreset] = useQueryState("theme");
  const applyThemePreset = useEditorStore((state) => state.applyThemePreset);

  React.useEffect(() => {
    if (preset) {
      applyThemePreset(preset);
      setPreset(null);
    }
  }, [preset, setPreset, applyThemePreset]);
};
