# Theme Definitions — CSS Variable Reference

> Complete mapping of CSS custom properties to Tailwind classes.
> Used by the theme engine in `services/theme/`.

---

### **Base Colors**

These define the core look of your application.

| CSS Variable   | Tailwind Class    | Usage Description                                                         |
| -------------- | ----------------- | ------------------------------------------------------------------------- |
| `--background` | `bg-background`   | The background color of the `<body>`and main page area.                   |
| `--foreground` | `text-foreground` | The default text color (usually black in light mode, white in dark mode). |

### **Component Surfaces**

Used for containers, modals, and overlays.

| CSS Variable           | Tailwind Class            | Usage Description                                                      |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `--card`               | `bg-card`                 | Background for `<Card />`components and contained sections.            |
| `--card-foreground`    | `text-card-foreground`    | Text color inside cards.                                               |
| `--popover`            | `bg-popover`              | Background for dropdown menus, popovers, select content, and tooltips. |
| `--popover-foreground` | `text-popover-foreground` | Text color inside popovers.                                            |

### **Interactive Colors**

Used for buttons, links, and action states.

| CSS Variable               | Tailwind Class                | Usage Description                                                                                            |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `--primary`                | `bg-primary`                  | **Main Call-to-Action** . Used for primary buttons, active tabs, switches, and checkboxes.                   |
| `--primary-foreground`     | `text-primary-foreground`     | Text or icon color sitting*on top*of a primary element.                                                      |
| `--secondary`              | `bg-secondary`                | **Alternative Actions** . Used for secondary buttons, badges, and less prominent interactive elements.       |
| `--secondary-foreground`   | `text-secondary-foreground`   | Text color sitting on top of a secondary element.                                                            |
| `--accent`                 | `bg-accent`                   | **Hover/Highlight** . Used for row highlights in tables, hover states on dropdown items, or subtle emphasis. |
| `--accent-foreground`      | `text-accent-foreground`      | Text color inside an accented/highlighted area.                                                              |
| `--destructive`            | `bg-destructive`              | **Error/Delete** . Used for destructive buttons (e.g., "Delete Account") or error notifications.             |
| `--destructive-foreground` | `text-destructive-foreground` | Text color on top of a destructive element.                                                                  |
| `--muted`                  | `bg-muted`                    | **Subtle Backgrounds** . Used for table headers, disabled states, or skeleton loading bars.                  |
| `--muted-foreground`       | `text-muted-foreground`       | **Subtle Text** . Used for helper text, placeholders, metadata strings (e.g., dates), and icons.             |

### **Borders & Inputs**

| CSS Variable | Tailwind Class  | Usage Description                                                                                                                 |
| ------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--border`   | `border-border` | Default border color for cards, dividers (`<Separator />`), and general layouts.                                                  |
| `--input`    | `border-input`  | Border color specifically for form inputs (`<Input />`,`<Select />`,`<Textarea />`). Often matches `--border`but can be distinct. |
| `--ring`     | `ring-ring`     | Color of the focus ring (outline glow) when an interactive element is focused via keyboard/click.                                 |
| `--radius`   | `rounded-*`     | Controls the global border-radius (e.g.,`0.5rem`). Affects buttons, cards, and inputs.                                            |

### **Sidebar**

Specific variables for the application sidebar (defined in `sidebar.tsx`).

| CSS Variable                   | Tailwind Class                    | Usage Description                                              |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------- |
| `--sidebar`                    | `bg-sidebar`                      | Background color of the sidebar container.                     |
| `--sidebar-foreground`         | `text-sidebar-foreground`         | Default text color in the sidebar.                             |
| `--sidebar-primary`            | `bg-sidebar-primary`              | Background for the*active*menu item in the sidebar.            |
| `--sidebar-primary-foreground` | `text-sidebar-primary-foreground` | Text color for the active menu item.                           |
| `--sidebar-accent`             | `bg-sidebar-accent`               | Background for*hovered*menu items in the sidebar.              |
| `--sidebar-accent-foreground`  | `text-sidebar-accent-foreground`  | Text color for hovered menu items.                             |
| `--sidebar-border`             | `border-sidebar-border`           | The right-border separating the sidebar from the main content. |
| `--sidebar-ring`               | `ring-sidebar-ring`               | Focus ring color for sidebar elements.                         |

### **Typography**

These control the font families injected into the app.

| CSS Variable       | Tailwind Class | Usage Description                               |
| ------------------ | -------------- | ----------------------------------------------- |
| `--font-sans`      | `font-sans`    | Primary font for the application (UI text).     |
| `--font-serif`     | `font-serif`   | Serif font for headings or stylized content.    |
| `--font-mono`      | `font-mono`    | Monospace font for code blocks and data tables. |
| `--letter-spacing` | `tracking-*`   | Global adjustment for character spacing.        |

### **Charts (Data Visualization)**

Colors used by Recharts for graphs.

| CSS Variable | Usage Description                              |
| ------------ | ---------------------------------------------- |
| `--chart-1`  | First data series color (e.g., "This Month").  |
| `--chart-2`  | Second data series color (e.g., "Last Month"). |
| `--chart-3`  | Third data series color.                       |
| `--chart-4`  | Fourth data series color.                      |
| `--chart-5`  | Fifth data series color.                       |

### **Effects & Layout**

| CSS Variable        | Usage Description                                                 |
| ------------------- | ----------------------------------------------------------------- |
| `--shadow-color`    | Base color for box-shadows (usually black or a dark theme color). |
| `--shadow-opacity`  | Opacity level for shadows.                                        |
| `--shadow-blur`     | Blur radius for shadows.                                          |
| `--shadow-spread`   | Spread radius for shadows.                                        |
| `--shadow-offset-x` | Horizontal offset for shadows.                                    |
| `--shadow-offset-y` | Vertical offset for shadows.                                      |
| `--spacing`         | Scaling factor for Tailwind's spacing utility (padding/margin).   |
