---
name: BIX
description: Local-first trading journal in dark cyan with an equivalent light theme.
colors:
  dark-bg: "#080f19"
  dark-rail: "#0b1420"
  dark-surface: "#101d2c"
  dark-raised: "#162638"
  dark-field: "#0b1725"
  dark-text: "#edf4ff"
  dark-muted: "#9bacc2"
  dark-border: "#26384d"
  dark-accent: "#66d9ec"
  dark-tint: "#143746"
  dark-on-accent: "#06242c"
  dark-positive: "#69dfb1"
  dark-negative: "#ff9b9b"
  dark-danger-bg: "#381e2b"
  dark-violet: "#b6a5fa"
  light-bg: "#f3f6fb"
  light-rail: "#e9f0f8"
  light-surface: "#fff"
  light-raised: "#edf3fa"
  light-field: "#f7f9fc"
  light-text: "#172b42"
  light-muted: "#53667e"
  light-border: "#d4dfec"
  light-accent: "#07677a"
  light-tint: "#d8eff4"
  light-on-accent: "#fff"
  light-positive: "#146d51"
  light-negative: "#ac3248"
  light-danger-bg: "#ffe8ed"
  light-violet: "#6646a1"
typography:
  headline:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  metric:
    fontSize: "clamp(22px, 2.15vw, 32px)"
    fontWeight: 600
    letterSpacing: "-0.03em"
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontSize: "12px"
rounded:
  tag: "6px"
  field: "8px"
  button: "9px"
  navigation: "10px"
  metric: "13px"
  panel: "14px"
  modal: "17px"
spacing:
  control-gap: "8px"
  compact-gap: "10px"
  metric-gap: "14px"
  form-gap: "16px"
  section-gap: "20px"
  panel-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-on-accent}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  button-primary-light:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.button}"
    padding: "11px 17px"
  button-secondary:
    backgroundColor: "{colors.dark-raised}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  field:
    backgroundColor: "{colors.dark-field}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.field}"
    padding: "11px"
  panel:
    backgroundColor: "{colors.dark-surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: BIX

## Overview

BIX uses the confirmed dark-cyan dashboard direction: ink-navy surfaces, compact financial readings and restrained status accents. The light counterpart retains the same information architecture and behavior, using cool white surfaces and dark teal controls. Reference screenshots inform direction, not exact reproduction.

**Key Characteristics:**
- System UI typography and tabular financial numerals.
- Tonal surface hierarchy with fine borders.
- Equivalent dark and light functionality.

This is an implementation record, not a review verdict. Token source: `src/styles.css`; behavior sources: `src/App.tsx`, `src/ThemeToggle.tsx` and `src/InstallApp.tsx`.

## Colors

### Primary
Cyan in dark mode and deep teal in light mode identify actions, selection, chart accents and focus. Tint supports selected navigation and the first balance card; on-accent supplies the corresponding foreground.

### Secondary
Violet is restrained to secondary emphasis, including the winning-days metric icon. Positive mint/green and negative coral/red express financial outcomes; danger backgrounds support negative pills and errors.

### Neutral
Background, rail, surface, raised and field form the surface hierarchy. Text, muted and border provide consistent foreground and divider roles. Frontmatter names use a theme prefix; each maps to the corresponding unprefixed CSS variable (for example, `dark-accent` maps to `--accent` in `:root`). Light values apply under `:root[data-theme="light"]`.

## Typography

Use the system stack in the body token; no downloaded display font or separate mono family. Financial metrics and table cells use `font-variant-numeric: tabular-nums`. Paragraphs use line-height (1.65), distinct from the root body line-height. Section titles are compact; captions and table headers commonly use (11px). Page headings reduce to (25px) on mobile. Metric values wrap rather than overflow; their responsive sizes are (23px) at 960px, (25px) at 760px and (21px) at 360px. Forecast results use (36px), reducing to (30px) on mobile.

## Layout

Desktop has a fixed navigation rail (214px), matching main offset, a header with minimum height (78px), and centered content capped at (1510px) with padding (34px 36px). Four metric columns use `minmax(0, 1fr)`. Overview uses `minmax(0, 2.1fr) minmax(250px, 1fr)` with a (20px) gap; forecast controls/results and form fields use two columns.

All breakpoints are inclusive `max-width` rules:
- **1180px:** rail/offset (184px), main padding (28px 24px), metric padding (16px), metric gap (10px); overview becomes `minmax(0, 1.6fr) minmax(240px, 1fr)`.
- **960px:** overview becomes one column; breadcrumb hides and header actions align right.
- **760px:** rail becomes fixed bottom navigation, height `calc(72px + env(safe-area-inset-bottom))`, with matching main bottom clearance. Brand/sidebar supporting content hide; navigation retains icons and labels. Main padding becomes (26px 16px), metrics two columns, panels (19px) padding, forecast one column, chart height (200px) instead of (250px). Header actions wrap. Install text hides but its accessible name remains. Form controls use (16px), except the explicitly smaller account selector.
- **360px:** form grid becomes one column; account selector caps at (110px); heading action text is visually reduced to icon-only and metric icons hide.

**Table containment:** main shell, panels and metrics retain `min-width: 0`. Tables preserve nowrap cells inside `.table-scroll { position: relative; overflow-x: auto; }`; horizontal overflow belongs to that wrapper, not the page. Notes truncate with ellipsis. Do not remove these containment rules to fit a narrow screenshot.

## Elevation & Depth

Cards are flat, separated by tone and (1px) borders rather than shadows. Only the modal uses the structural shadow `0 24px 80px #0006`, with backdrop `#020712b8`. Dialog width is (490px), constrained to `calc(100vw - 32px)` and (90dvh), with internal scrolling.

## Shapes

Use the role-specific rounded tokens, not one universal radius. Small return pills and progress tracks use (5px); the progress bar is (6px) high. Avatars and status dots are circular. Preserve the BIX identity source `public/icon.svg`. Shipping `public/icon-192.png` and `public/icon-512.png` are browser-rendered derivatives authored from that SVG by `scripts/generate-icons.mjs`; do not replace them with unrelated raster art. The sidebar wordmark is rendered in markup, not a raster logo.

## Components

- **Actions:** primary uses accent/on-accent, minimum height (42px), and hover brightness (1.08). Secondary uses raised/text, minimum height (40px), and accent border/text on hover. Icon controls are (36px) square; journal row controls are (32px). Text actions underline on hover. Disabled buttons use opacity (0.5) and a not-allowed cursor.
- **Focus and motion:** buttons, links and fields receive an accent outline (2px), offset (4px); upload labels use focus-within. Buttons transition background and color over (0.16s). Reduced-motion preference disables transitions and resets scroll behavior to auto. No separate pressed-state styling is defined.
- **Navigation:** muted at rest, raised/text on hover, tint/accent with border when active. Active page is also indicated by `aria-current="page"`; desktop adds a small dot.
- **Fields and errors:** field surface, text foreground, border, (11px) padding and accent caret. Placeholder text uses muted color at full opacity. Error banners use negative text/border on danger background and alert semantics where rendered. No independent invalid-field border style is defined.
- **Cards, tags and tables:** first balance card is tinted; other cards use surface. Tags are bordered, muted and nowrap. Table headers use field tone; rows use raised tone on hover. Negative returns change both text and pill background.
- **Empty state:** no broker presents account creation; New entry is disabled. Missing winning-day history is an em dash rather than a fabricated rate. Chart placeholders and small empty messages remain explanatory rather than simulated data.
- **Theme:** dark is the default unless `localStorage["bix.theme"]` is exactly `light`. Toggle updates the root data attribute and browser theme-color meta tag. Preference storage is separate from trading data at `bix.state.v1`; switching theme does not rewrite the journal or backups. Storage failure still changes this visit's theme and exposes a status notice. There is no automatic system-theme selection.
- **Installation:** uses the captured browser install prompt when available; busy disables the control. Cancellation/failure opens a guide with status text. Without a prompt, the guide gives browser-specific instructions. Installed state follows standalone detection or the `appinstalled` event, not merely accepting a prompt. Offline guidance requires an initial online visit and caching; browser-only use remains supported.

## Do's and Don'ts

- **Do** preserve semantic color roles across both themes and retain visible focus treatment.
- **Do** keep financial figures grounded in journal data and projections explicitly hypothetical.
- **Do** preserve SVG identity and documented PNG provenance.
- **Don't** merge theme preferences into version-1 trading state or backups.
- **Don't** replace table-local scrolling with page-wide overflow.
- **Don't** add simulated market feeds, AI coaching or decorative raster imagery.
