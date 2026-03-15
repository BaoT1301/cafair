# Theme Service

A complete, self-contained theming engine for Next.js + Tailwind CSS v4 applications. Provides runtime theme switching, 20+ built-in presets, a full visual theme editor, dark/light mode with animated transitions, and persistent state via Zustand.

## Quick Start

### 1. Wrap your app with the provider

```tsx
// app/layout.tsx
import { ThemeProvider, ThemeLoader } from "@/services/theme";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ThemeLoader>{children}</ThemeLoader>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2. Use the `useTheme` hook

```tsx
"use client";
import { useTheme } from "@/services/theme";

function MyComponent() {
  const { themeState, setThemeState, toggleMode } = useTheme();
  // themeState.currentMode → "light" | "dark"
  // themeState.styles.light → all CSS variable values
  // themeState.preset → current preset name
}
```

### 3. Apply a preset

```tsx
import { useEditorStore } from "@/services/theme";

function PresetPicker() {
  const applyPreset = useEditorStore((s) => s.applyThemePreset);
  return (
    <button onClick={() => applyPreset("tokyo-night")}>Tokyo Night</button>
  );
}
```

## Architecture

```
services/theme/
├── index.ts                     # Barrel export — import everything from here
├── provider.tsx                 # React context + View Transitions API toggle
├── loader.tsx                   # FOUC prevention spinner
├── types/
│   └── index.ts                 # Zod schemas + TypeScript types
├── config/
│   └── defaults.ts              # Default light/dark colors, fonts, spacing
├── store/
│   ├── editor-store.ts          # Zustand: theme state, undo/redo, checkpoints
│   └── preset-store.ts          # Zustand: preset registry CRUD
├── presets/
│   ├── built-in.ts              # 20+ preset definitions
│   └── helpers.ts               # Merge presets with defaults
├── apply/
│   ├── apply-style.ts           # Set a single CSS var on an element
│   ├── apply-theme.ts           # Apply full theme (colors + styles)
│   └── shadows.ts               # Shadow CSS variable generation
├── hooks/
│   └── use-theme-preset-from-url.ts  # ?theme=<preset> URL param hook
└── utils/
    └── color-converter.ts       # HSL/RGB/Hex/OKLCh conversion (culori)
```

## Built-in Presets

| Preset             | Description                |
| ------------------ | -------------------------- |
| `modern-minimal`   | Clean neutral grays        |
| `dark-neutral`     | Deep charcoal tones        |
| `rose-pine`        | Muted rose & pine          |
| `ocean-breeze`     | Blue & teal coastal        |
| `sunset-ember`     | Warm amber & orange        |
| `catppuccin-mocha` | Popular dev theme          |
| `tokyo-night`      | Dark Tokyo-inspired        |
| `dracula`          | Classic Dracula            |
| `solarized`        | Ethan Schoonover's classic |
| `gruvbox`          | Retro warm tones           |
| `nordic-frost`     | Cool Nordic blues          |
| `cyberpunk-neon`   | Bright neon accents        |
| `sakura`           | Soft cherry blossom        |
| `aurora-borealis`  | Northern lights            |
| ...and more        | See `presets/built-in.ts`  |

## Adding a Custom Preset

```tsx
import { useThemePresetStore, type ThemePreset } from "@/services/theme";

const myPreset: ThemePreset = {
  label: "My Custom Theme",
  styles: {
    light: {
      background: "#ffffff",
      foreground: "#111111",
      primary: "#3b82f6",
      "primary-foreground": "#ffffff",
      // ... other color keys
    },
    dark: {
      background: "#0a0a0a",
      foreground: "#fafafa",
      primary: "#60a5fa",
      "primary-foreground": "#0a0a0a",
      // ... other color keys
    },
  },
};

// Register at runtime
const register = useThemePresetStore((s) => s.registerPreset);
register("my-theme", myPreset);
```

## Theme Editor Page

The theme editor lives at `/theme-editor` and provides:

- **Preset selector** — switch between all registered presets
- **Color editor** — pick colors for every CSS variable (grouped)
- **Style controls** — sliders for radius, spacing, shadows, letter-spacing; text inputs for fonts
- **Live preview** — buttons, cards, inputs, badges, chart colors update in real time
- **Undo/Redo** — full history with hotkey support
- **Mode toggle** — switch between light and dark editing

## CSS Variable Reference

See [THEME_DEFINITIONS.md](../../docs/THEME_DEFINITIONS.md) for a complete list of CSS variables and their Tailwind class mappings.

## Color Converter Utility

```tsx
import {
  colorFormatter,
  convertToHSL,
  type ColorFormat,
} from "@/services/theme";

// Convert any color to hex
colorFormatter("#3b82f6", "hex"); // "#3b82f6"
colorFormatter("oklch(0.6 0.2 250)", "hex"); // "#..."

// Convert to HSL (Tailwind v3 space-separated format)
colorFormatter("#3b82f6", "hsl"); // "217 91% 60%"

// Convert to HSL (Tailwind v4 functional format)
colorFormatter("#3b82f6", "hsl", "4"); // "hsl(217 91% 60%)"
```

## Dependencies

- `zustand` — state management with persistence
- `culori` — color space conversions
- `nuqs` — URL search param syncing
- `framer-motion` — View Transitions API fallback (optional)
