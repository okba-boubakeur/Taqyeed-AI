---
description: Enforce monochrome styling for all navigation bar, bottom bar, and toolbar action icons
globs: src/components/**/*.{tsx,jsx}
---

# Rule: Monochrome Navigation & Action Icons

All navigation bar, bottom bar, toolbar, and header action icons across the UI must be strictly **monochrome**, matching the monochrome theme toggle icon (`text-foreground hover:bg-muted` or `text-muted-foreground hover:text-foreground`).

## Guidelines:
1. **No Rainbow/Colored Tints**: Do NOT apply arbitrary colored text, backgrounds, or borders (such as blue for share, amber/gold for export, green for pin, or red for delete) to action buttons in bottom navigation bars, selection bars, or header toolbars.
2. **Standard Button Styling**: Use transparent or subtle muted backgrounds with standard border tokens:
   - Container: `bg-transparent border border-border hover:bg-muted text-foreground`
   - Icon: `text-foreground` or `text-muted-foreground`
3. **Consistency**: Icons must maintain seamless visual harmony across light and dark themes, just like the theme toggle icon and recording bottom bar controls.
