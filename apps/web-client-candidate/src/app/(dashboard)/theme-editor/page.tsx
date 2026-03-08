"use client";

import { useEditorStore, useThemePresetStore } from "@/services/theme";
import { ThemeStyleProps, ThemeMode } from "@/services/theme";
import { COMMON_STYLES, colorFormatter } from "@/services/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sun,
  Moon,
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  Palette,
  Type,
  SlidersHorizontal,
  Eye,
} from "lucide-react";
import { useCallback, useMemo, useState, Suspense } from "react";
import Link from "next/link";

// ============================================================================
// Color Swatch Component
// ============================================================================

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const hexValue = useMemo(() => {
    try {
      return colorFormatter(value, "hex");
    } catch {
      return "#000000";
    }
  }, [value]);

  return (
    <div className="flex items-center gap-3">
      <label
        className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-sm"
        title={label}
      >
        <input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div className="h-full w-full" style={{ backgroundColor: hexValue }} />
      </label>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hexValue}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Color Group
// ============================================================================

const COLOR_GROUPS: { title: string; icon: React.ReactNode; keys: string[] }[] =
  [
    {
      title: "Base",
      icon: <Palette className="h-4 w-4" />,
      keys: ["background", "foreground", "card", "card-foreground"],
    },
    {
      title: "Primary & Secondary",
      icon: <Palette className="h-4 w-4" />,
      keys: [
        "primary",
        "primary-foreground",
        "secondary",
        "secondary-foreground",
      ],
    },
    {
      title: "Muted & Accent",
      icon: <Palette className="h-4 w-4" />,
      keys: [
        "muted",
        "muted-foreground",
        "accent",
        "accent-foreground",
        "popover",
        "popover-foreground",
      ],
    },
    {
      title: "Destructive & UI",
      icon: <Palette className="h-4 w-4" />,
      keys: [
        "destructive",
        "destructive-foreground",
        "border",
        "input",
        "ring",
      ],
    },
    {
      title: "Charts",
      icon: <Palette className="h-4 w-4" />,
      keys: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
    },
    {
      title: "Sidebar",
      icon: <Palette className="h-4 w-4" />,
      keys: [
        "sidebar",
        "sidebar-foreground",
        "sidebar-primary",
        "sidebar-primary-foreground",
        "sidebar-accent",
        "sidebar-accent-foreground",
        "sidebar-border",
        "sidebar-ring",
      ],
    },
  ];

// ============================================================================
// Preset Selector
// ============================================================================

function PresetSelector({
  currentPreset,
  onSelect,
}: {
  currentPreset?: string;
  onSelect: (preset: string) => void;
}) {
  const allPresets = useThemePresetStore((s) => s.presets);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          Presets
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          onClick={() => onSelect("default")}
          className={cn(
            "relative rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
            currentPreset === "default" || !currentPreset
              ? "border-primary bg-accent"
              : "border-border",
          )}
        >
          <span className="font-medium">Default</span>
          {(currentPreset === "default" || !currentPreset) && (
            <Check className="absolute right-2 top-2.5 h-3.5 w-3.5 text-primary" />
          )}
        </button>
        {Object.entries(allPresets).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={cn(
              "relative rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
              currentPreset === key
                ? "border-primary bg-accent"
                : "border-border",
            )}
          >
            <span className="font-medium">{preset.label ?? key}</span>
            {currentPreset === key && (
              <Check className="absolute right-2 top-2.5 h-3.5 w-3.5 text-primary" />
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Color Editor Panel
// ============================================================================

function ColorEditorPanel({
  styles,
  mode,
  onColorChange,
}: {
  styles: ThemeStyleProps;
  mode: ThemeMode;
  onColorChange: (key: string, value: string, mode: ThemeMode) => void;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>("Base");

  return (
    <div className="space-y-3">
      {COLOR_GROUPS.map((group) => {
        const isExpanded = expandedGroup === group.title;
        return (
          <Card key={group.title}>
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              {group.icon}
              <span className="flex-1 text-sm font-semibold">
                {group.title}
              </span>
              <div className="flex gap-1">
                {group.keys.slice(0, 4).map((key) => {
                  const hex = (() => {
                    try {
                      return colorFormatter(
                        styles[key as keyof ThemeStyleProps] as string,
                        "hex",
                      );
                    } catch {
                      return "#000";
                    }
                  })();
                  return (
                    <div
                      key={key}
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
            </button>
            {isExpanded && (
              <CardContent className="grid grid-cols-1 gap-3 pt-0 sm:grid-cols-2">
                {group.keys.map((key) => (
                  <ColorSwatch
                    key={key}
                    label={key}
                    value={
                      (styles[key as keyof ThemeStyleProps] as string) ??
                      "#000000"
                    }
                    onChange={(val) => onColorChange(key, val, mode)}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================================
// Style Controls Panel (non-color: radius, fonts, shadows, spacing)
// ============================================================================

function StyleControlsPanel({
  styles,
  onStyleChange,
}: {
  styles: ThemeStyleProps;
  onStyleChange: (key: string, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4" />
          Style Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Border Radius */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Border Radius
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.125"
            value={parseFloat(styles.radius) || 0.625}
            onChange={(e) => onStyleChange("radius", `${e.target.value}rem`)}
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">{styles.radius}</span>
        </div>

        {/* Spacing */}
        <div>
          <label className="mb-1 block text-sm font-medium">Spacing</label>
          <input
            type="range"
            min="0.1"
            max="0.5"
            step="0.01"
            value={parseFloat(styles.spacing ?? "0.25")}
            onChange={(e) => onStyleChange("spacing", `${e.target.value}rem`)}
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {styles.spacing}
          </span>
        </div>

        {/* Letter Spacing */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Letter Spacing
          </label>
          <input
            type="range"
            min="-0.05"
            max="0.1"
            step="0.005"
            value={parseFloat(styles["letter-spacing"]) || 0}
            onChange={(e) =>
              onStyleChange("letter-spacing", `${e.target.value}em`)
            }
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {styles["letter-spacing"]}
          </span>
        </div>

        {/* Shadow Opacity */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            Shadow Opacity
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={parseFloat(styles["shadow-opacity"]) || 0.1}
            onChange={(e) =>
              onStyleChange("shadow-opacity", `${e.target.value}`)
            }
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {styles["shadow-opacity"]}
          </span>
        </div>

        {/* Shadow Blur */}
        <div>
          <label className="mb-1 block text-sm font-medium">Shadow Blur</label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={parseInt(styles["shadow-blur"]) || 3}
            onChange={(e) =>
              onStyleChange("shadow-blur", `${e.target.value}px`)
            }
            className="w-full accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            {styles["shadow-blur"]}
          </span>
        </div>

        {/* Fonts */}
        <div>
          <label className="mb-1 block text-sm font-medium">
            <Type className="mr-1 inline h-3.5 w-3.5" />
            Font Sans
          </label>
          <input
            type="text"
            value={styles["font-sans"]}
            onChange={(e) => onStyleChange("font-sans", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Font Serif</label>
          <input
            type="text"
            value={styles["font-serif"]}
            onChange={(e) => onStyleChange("font-serif", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Font Mono</label>
          <input
            type="text"
            value={styles["font-mono"]}
            onChange={(e) => onStyleChange("font-mono", e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Live Preview Panel
// ============================================================================

function LivePreview() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" />
          Live Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Typography */}
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Heading Example</h3>
          <p className="text-sm text-muted-foreground">
            This is muted paragraph text to preview your theme colors.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Primary</Button>
          <Button size="sm" variant="secondary">
            Secondary
          </Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
          <Button size="sm" variant="destructive">
            Destructive
          </Button>
          <Button size="sm" variant="ghost">
            Ghost
          </Button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
            <p className="text-xs font-semibold">Card</p>
            <p className="text-xs text-muted-foreground">With shadow</p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-muted-foreground">
            <p className="text-xs font-semibold">Muted</p>
            <p className="text-xs">Background</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Input field preview..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-sm border border-primary bg-primary" />
            <span className="text-sm">Checkbox preview</span>
          </div>
        </div>

        {/* Chart Colors */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Chart Colors
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 flex-1 rounded"
                style={{
                  backgroundColor: `hsl(var(--chart-${i}))`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Accent / Destructive badges */}
        <div className="flex gap-2">
          <span className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground">
            Accent
          </span>
          <span className="rounded-md bg-destructive px-2 py-1 text-xs text-destructive-foreground">
            Destructive
          </span>
          <span className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground">
            Primary
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Theme Editor Page
// ============================================================================

export default function ThemeEditorPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <ThemeEditorPage />
    </Suspense>
  );
}

function ThemeEditorPage() {
  const {
    themeState,
    setThemeState,
    applyThemePreset,
    resetToCurrentPreset,
    undo,
    redo,
    canUndo,
    canRedo,
    hasUnsavedChanges,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<"colors" | "styles">("colors");

  const currentMode = themeState.currentMode;
  const currentStyles = themeState.styles[currentMode];

  const toggleMode = useCallback(() => {
    setThemeState({
      ...themeState,
      currentMode: currentMode === "light" ? "dark" : "light",
    });
  }, [themeState, currentMode, setThemeState]);

  const handleColorChange = useCallback(
    (key: string, value: string, mode: ThemeMode) => {
      setThemeState({
        ...themeState,
        styles: {
          ...themeState.styles,
          [mode]: {
            ...themeState.styles[mode],
            [key]: value,
          },
        },
      });
    },
    [themeState, setThemeState],
  );

  const handleStyleChange = useCallback(
    (key: string, value: string) => {
      // Common styles (radius, fonts, spacing, etc.) apply to both modes
      if (COMMON_STYLES.includes(key)) {
        setThemeState({
          ...themeState,
          styles: {
            light: { ...themeState.styles.light, [key]: value },
            dark: { ...themeState.styles.dark, [key]: value },
          },
        });
      } else {
        setThemeState({
          ...themeState,
          styles: {
            ...themeState.styles,
            [currentMode]: {
              ...themeState.styles[currentMode],
              [key]: value,
            },
          },
        });
      }
    },
    [themeState, currentMode, setThemeState],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </Link>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-semibold">Theme Editor</h1>
            {hasUnsavedChanges() && (
              <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                Unsaved changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={!canUndo()}
              title="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={!canRedo()}
              title="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            <div className="mx-2 h-6 w-px bg-border" />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMode}
              title={`Switch to ${currentMode === "light" ? "dark" : "light"} mode`}
            >
              {currentMode === "light" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={resetToCurrentPreset}
              title="Reset to preset defaults"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container grid gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Controls */}
        <div className="space-y-6">
          {/* Preset Selector */}
          <PresetSelector
            currentPreset={themeState.preset}
            onSelect={applyThemePreset}
          />

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg border bg-muted p-1">
            <button
              onClick={() => setActiveTab("colors")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "colors"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Palette className="mr-1.5 inline h-3.5 w-3.5" />
              Colors ({currentMode})
            </button>
            <button
              onClick={() => setActiveTab("styles")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "styles"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="mr-1.5 inline h-3.5 w-3.5" />
              Styles
            </button>
          </div>

          {/* Panel */}
          {activeTab === "colors" ? (
            <ColorEditorPanel
              styles={currentStyles}
              mode={currentMode}
              onColorChange={handleColorChange}
            />
          ) : (
            <StyleControlsPanel
              styles={currentStyles}
              onStyleChange={handleStyleChange}
            />
          )}
        </div>

        {/* Right: Live Preview (sticky) */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
