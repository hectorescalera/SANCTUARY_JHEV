---
name: Obsidian Amber
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#d4c5ab'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#9c8f78'
  outline-variant: '#504532'
  surface-tint: '#fbbc00'
  primary: '#ffe2ab'
  on-primary: '#402d00'
  primary-container: '#ffbf00'
  on-primary-container: '#6d5000'
  inverse-primary: '#795900'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#e8e5e4'
  on-tertiary: '#313030'
  tertiary-container: '#cbc9c8'
  on-tertiary-container: '#555454'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdfa0'
  primary-fixed-dim: '#fbbc00'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5c4300'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is built on a "Mystic Functionalism" philosophy. It balances the utility of a high-performance dashboard with the intimate, sophisticated atmosphere of a private study. The target audience seeks a digital sanctuary—a place where personal finance, reflection, and planning feel intentional rather than clinical.

The aesthetic blends **Modern Minimalism** with **Glassmorphism** and **Tactile** accents. It utilizes deep, obsidian-layered surfaces to create a sense of infinite depth, punctuated by warm, amber glows that guide the user's attention to key actions and data points. The interface should feel premium, private, and exceptionally focused.

## Colors
The palette is rooted in deep blacks to minimize eye strain and maximize the "void" effect of the background. 
- **Base Layers:** `#0F0F0F` is used for the primary canvas. `#1A1A1A` is reserved for elevated cards and containers.
- **Accents:** Amber (`#FFBF00`) is the primary interactive color, used for high-priority buttons and active states. Gold (`#D4AF37`) is used for decorative elements, "Magic Diary" flourishes, and secondary interactive states.
- **System Colors:** Success and error states are muted and desaturated to maintain the sophisticated tone, ensuring they don't clash with the warm amber primary palette.

## Typography
This design system employs a dual-typeface strategy to bridge the gap between "Mystical" and "Functional."
- **Functional UI:** **Inter** is used for all data-heavy sections, finances, and navigation. Its neutral character ensures maximum legibility against dark backgrounds.
- **Editorial Flourish:** **EB Garamond** is used exclusively for "Magic Diary" headings and introspective prompts. It provides a literary, sophisticated contrast to the utilitarian sans-serif.
- **Scaling:** Headlines on mobile should drop significantly in size but maintain the tight letter-spacing of the desktop counterparts to preserve the premium feel.

## Layout & Spacing
The layout follows a **Fluid Grid** model with strict 8px increments. 
- **Margins:** Standard desktop margins are set to 40px, scaling down to 16px on mobile. 
- **Grid:** A 12-column grid is used for desktop dashboards. Components like financial charts should span at least 6 columns, while smaller diary snippets or weather widgets can span 3-4.
- **Density:** High whitespace is prioritized to prevent the dark UI from feeling cramped. Use `stack-lg` for separating major sections and `stack-sm` for internal component grouping.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Glassmorphism**, rather than traditional shadows.
- **Level 0 (Canvas):** `#0F0F0F` - The absolute background.
- **Level 1 (Cards):** `#1A1A1A` - Standard containers with a 1px border (`rgba(255, 255, 255, 0.05)`).
- **Level 2 (Overlays/Modals):** Glassmorphic surfaces with a 12px backdrop blur and a slight amber tint (`rgba(26, 26, 26, 0.8)`).
- **Glows:** Primary buttons and active financial indicators should use a `0px 0px 20px rgba(255, 191, 0, 0.2)` outer glow to simulate an illuminated amber light source.

## Shapes
The shape language is consistently "Rounded" (0.5rem base) to soften the "Brutalist" potential of the dark palette.
- **Cards:** Use `rounded-lg` (1rem) to create a friendly, approachable container for complex data.
- **Buttons & Inputs:** Use the base `rounded` (0.5rem). 
- **Interactive States:** On hover, cards should subtly scale (1.02x) and the border opacity should increase from 0.05 to 0.15 amber.

## Components
- **Buttons:** Primary buttons are solid Amber (`#FFBF00`) with black text. Secondary buttons are "Ghost" style with an Amber border and no fill.
- **Cards:** All cards feature a subtle top-down gradient from `#1F1F1F` to `#1A1A1A`. Financial cards include a 1px inner stroke to catch the "light."
- **Data Visualization:** Charts use monochromatic Amber scales. Use a glowing line effect (blur) for primary trends in financial graphs.
- **Inputs:** Darker than the card background (`#0A0A0A`) with a gold left-accent border that activates on focus.
- **Magic Diary List:** Use EB Garamond for titles with a soft-focus divider line. Include "Ink-drop" hover effects where a subtle amber glow follows the cursor within the diary section.
- **Chips:** Small, pill-shaped tags with a low-opacity amber background (`rgba(255, 191, 0, 0.1)`) and gold text.