# Fixie — UI Design Brief (v2.0)

Oct 31, 2026 · @Mahajan Sarthak Dileep · Team MisfitMinds · Applies to every screen in `03_Webapp_Flow_Spec_Fixie.md` (SCR-xx) · Supersedes Design Brief v1.0

## 1. Design direction

Fixie looks like a careful engineer's case file on warm paper: cream `#F5EAE4` everywhere, facts set in ink, and red used only where the bug is. The product's promise is proof (a test that fails, then passes; the commit that broke it; every attempt it rolled back), so the interface makes evidence the hero and keeps everything else quiet.

**The idea in one line: red is the bug.** `#FE0032` marks a failing repro test, a failed check, the breaking commit, an error, and the brand mark; nothing else. When Fixie proves a fix, the red visibly resolves to ink and green. Anyone should be able to glance at a screen and find every open problem by its red.

**Mood.** Calm, exact, trustworthy, warm, quietly cinematic. Cinematic means a few deliberate moments, not effects everywhere: the dark "screen" viewers inset in the paper like a lit monitor on a desk; the proof moment when red resolves to green; the bisect strip narrowing to one commit; and trace replay playing a run back like footage.

**Fixie must feel like:** a reviewer's desk where the reproduction, the breaking commit, the attempts and the diff are laid out in reasoning order; dense enough for engineers, never cramped; readable for a lead who only checks the Overview; honest when it failed.

**Fixie must not look like:**

- A neon "hacker terminal": no black canvas, no green-on-black outside the viewers, no glitch or scanline effects.
- The SaaS card kit: no grids of identical rounded cards with grey shadows, no gradient washes, no glassmorphism.
- An "AI magic" product: no sparkles, robot mascots, purple gradients or "thinking" orbs. Fixie shows its work instead.
- A warning-light panel: red never decorates.

**Where the boldness goes** (only here): the landing hero's screen panel, the proof strip and step tracker on Run detail, the bisect strip, the dark log/diff/code viewers, the replay playback bar, and the brand mark. Every other surface is cream, ink, hairlines and type.

## 2. Color palette

The four brand colours are given and fixed; each has one job. Cream is the page, ink is text and the primary action, slate is navigation and information, red is the bug. `#FE0032` on cream measures 3.38:1, so it is used for shapes, icons, edges and large type; red text and red buttons use the derived `danger` `#C8002A` (5.09:1).

**Brand colours.**

| Token | Hex | Role | Use for | Never use for |
| --- | --- | --- | --- | --- |
| `canvas` | `#F5EAE4` | Base background | Every page, top bar, sidebar | Text |
| `ink` | `#030B18` | Text and primary action | Body text, headings, primary button fill, viewer background | Large fills on light screens |
| `slate` | `#313E60` | Navigation and information | Links, active nav marker, focus ring, info banners, running state, single-series charts | Errors |
| `signal` | `#FE0032` | The bug | Brand i-dot, failing-repro marker, failed-check icon, breaking-commit node, critical banner edge, red chart series | Text under 24 px, filled buttons with text, success or neutral states |

**Derived tokens** (text pairs meet WCAG 2.1 AA against the stated background).

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `surface` | `#FBF6F2` | Tables, cards, inputs, modals | Ink 18.4:1 |
| `sunken` | `#EBDCD3` | Hover rows, table headers, active nav, inline code | Ink 14.8:1 |
| `hairline` | `#E0CFC5` | Dividers, card borders (decorative) | — |
| `border-control` | `#6B7385` | Input, checkbox, toggle borders | 4.0:1 on canvas |
| `text-muted` | `#5B6478` | Secondary text, meta, placeholders | 5.0:1 canvas, 5.5:1 surface |
| `danger` | `#C8002A` | Error text, failed badges, destructive fill | 5.1:1 canvas; white on it 6.0:1 |
| `danger-tint` | `#FDE3E8` | Error banner/badge background | Danger text 5.0:1 |
| `success` | `#2E6B4F` | Passed checks, PR ready, merged | 5.3:1 canvas |
| `success-tint` | `#E3EFE7` | Success badge/banner background | Success text 5.3:1 |
| `warning` | `#8A5200` | Needs info, not fixed, rolled back, weak setup | 5.4:1 canvas |
| `warning-tint` | `#F8EAD2` | Warning badge/banner background | Warning text 5.4:1 |
| `info-tint` | `#E4E7EF` | Running badge, info banner background | Slate text 8.5:1 |

**Screen tokens** (log, diff and code viewers, the landing hero panel, the replay bar).

| Token | Hex | Use | Contrast on `screen` |
| --- | --- | --- | --- |
| `screen` | `#030B18` | Viewer background | — |
| `screen-raised` | `#0B1526` | Toolbars, selected line, file headers | — |
| `screen-text` | `#E6DFD9` | Code and log text | 15.0:1 |
| `screen-muted` | `#7F8AA3` | Line numbers, timestamps | 5.7:1 |
| `screen-red` | `#FF4D6D` | stderr, failing lines, removed diff lines, hottest heat | 6.1:1 |
| `screen-green` | `#3DDC97` | Passing lines, added diff lines | 11.2:1 |
| `screen-amber` | `#FFB547` | Warnings, search matches, medium heat | 11.2:1 |

**Status mapping.**

| Group | Text | Background | Icon |
| --- | --- | --- | --- |
| Running (queued → opening PR) | `slate` | `info-tint` | Spinner |
| Needs info / Needs a 👍 / Not fixed / Rolled back | `warning` | `warning-tint` | Speech bubble / triangle / rotate-ccw |
| PR ready / PR updated / Merged / Passed | `success` | `success-tint` | Check |
| Failed (check failed, blocked path, limit reached, system error) | `danger` | `danger-tint` | Cross |
| Cancelled / Draft / Closed / Abandoned / Skipped | `text-muted` | `sunken` | Slash / dot |

**Usage ratio.** About 80% canvas and surface, 15% ink type, 4% slate, 1% red. A calm screen (a successful run, an all-clear Overview) shows no `signal` red besides the logo; if it does, that is a UI bug.

**Theme.** Light only for the MVP; cream is the identity. Screen tokens are used only inside viewers and the hero panel. A full dark theme is post-MVP.

## 3. Typography

IBM Plex carries the product: Plex Sans for interface and reading, Plex Mono for anything a user would copy (commands, paths, test ids, SHAs, model ids, logs, diffs, labels, YAML). Load with `next/font/google` (self-hosted at build, `display: swap`).

| Family | Weights | Role |
| --- | --- | --- |
| IBM Plex Sans | 400, 500, 600 | All UI text, headings, numbers |
| IBM Plex Mono | 400, 500 | Copyable content only |

Fallbacks: `"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` and `"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`.

**Type scale** (base 14 px, ratio ≈ 1.25).

| Token | Size / line | Weight | Tracking | Used for |
| --- | --- | --- | --- | --- |
| `hero` | 56 / 60 | 600 | -0.03em | SCR-01 headline only (40/44 below 768 px) |
| `display` | 40 / 44 | 600 | -0.02em | Onboarding and first-use headings |
| `h1` | 28 / 34 | 600 | -0.015em | Page titles |
| `h2` | 20 / 28 | 600 | -0.01em | Section and card titles |
| `h3` | 16 / 24 | 600 | 0 | Sub-sections, modal titles |
| `body-lg` | 16 / 26 | 400 | 0 | Landing body, empty states, diagnosis, banners |
| `body` | 14 / 22 | 400 | 0 | Default UI, tables, forms |
| `small` | 13 / 18 | 400 | 0 | Meta, helper text, tooltips |
| `caption` | 12 / 16 | 500 | 0.01em | Badges, column headers, chart axes |
| `kpi` | 32 / 36 | 600 | -0.02em | KPI values |
| `mono` | 13 / 20 | 400 | 0 | Inline code, ids, paths |
| `mono-log` | 12.5 / 20 | 400 | 0 | Viewers |

**Rules.** Sentence case everywhere; no all-caps labels or tracked-out eyebrows. Tabular figures (`tabular-nums`) for every number that can change (KPIs, durations, costs, counts, scores). Mono only for copyable content. Prose max 68ch. Headings never use a second colour or italic accent. Long issue titles truncate with an ellipsis and a tooltip; table cells never wrap beyond 2 lines.

## 4. Layout direction

Left-aligned layouts read top to bottom in reasoning order (what happened → the proof → the cause → the attempts → the change → raw detail), with surfaces separated by tone and hairlines rather than shadows.

**Shell.**

| Region | Size | Background | Separation |
| --- | --- | --- | --- |
| Top bar | 56 px, sticky | `canvas` | 1 px `hairline` bottom |
| Sidebar | 240 px (64 px rail < 1280 px; drawer < 768 px) | `canvas` | 1 px `hairline` right |
| Content | Fluid, max 1440 px, padding 32 / 24 / 16 px | `canvas` | — |
| Reading column (setup, settings, account, onboarding) | Max 760 px, left-aligned | `canvas` with `surface` cards | — |

**Grid.** 12 columns / 24 px gutters (desktop), 8 / 16 (tablet), 4 / 16 (mobile). Only SCR-01's hero, onboarding, empty states and the replay drop zone are centred or hero-composed; everything else aligns left.

**Spacing** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64. Inside components 4–16; between siblings 24; between sections 32–48. Table rows 44 px (36 px compact on Runs and Audit).

**Radii.** Badges, chips, toggles: full. Buttons, inputs, inline code: 6 px. Cards, tables, viewers, banners: 10 px. Modals, menus, toasts: 14 px.

**Elevation.** In-page surfaces: no shadow (surface + 1 px hairline). Floating only: menus `0 8px 24px rgba(3,11,24,0.12)`; modals and toasts `0 16px 48px rgba(3,11,24,0.18)`; backdrop `rgba(3,11,24,0.48)`.

**Composition rules.** One title row per page (h1 left, at most one primary button right). Group related data in one surface with internal dividers; rarely more than 4 surfaces above the fold. Lists are tables on desktop. Meta as labelled spans with 16 px gaps, not middle-dot strings. Icons: Lucide, 16 px in text/tables, 20 px in buttons/nav, stroke 1.75, colour inherits.

## 5. Component style

Flat, precise, quiet: ink fill for the one main action, hairline outlines for secondary actions, tinted pills for status, a dark screen for code. Build as shadcn/ui components restyled with the tokens in §10.

**Focus ring.** `box-shadow: 0 0 0 2px var(--color-canvas), 0 0 0 4px var(--color-slate)` on `:focus-visible`.

### Buttons

| Variant | Default | Hover | Pressed | Use |
| --- | --- | --- | --- | --- |
| Primary | `ink` fill, `canvas` text, 500 | `#172033` | `#000000` | One per view: "Fix an issue", "Turn on", "Save changes", "Sign in with GitHub" |
| Secondary | `surface`, `ink` text, 1 px `border-control` | `sunken` | `hairline` | "Setup", "Check again", "Run again", "Copy YAML" |
| Ghost | Transparent, `slate` text | `sunken` | `hairline` | Toolbars, "Clear filters", overflow menus |
| Destructive | `danger` fill, white text | `#B00026` | `#9A0021` | Confirm modals only |
| External | Secondary + trailing 14 px external-link icon | — | — | Every GitHub deep link |

Sizes 32 / 36 / 44 px (44 on mobile and SCR-01). Padding 12 / 14 / 18 px; icon gap 8 px. Loading: label stays, a 14 px spinner replaces the leading icon, width fixed. Disabled: 40% opacity, `not-allowed`, tooltip with the reason. Labels are verbs naming the outcome.

### Form controls

| Control | Style |
| --- | --- |
| Input, select, number | 36 px, `surface`, 1 px `border-control`, 6 px radius, 12 px padding; hover border `slate`; error: 1 px `danger` + `small` danger message with icon |
| Toggle | 36 × 20 track; off `sunken` + `border-control` outline; on `ink`; knob `surface` 16 px; locked adds a 12 px lock icon |
| Radio cards (workflow builder model choice) | `surface` block, 1 px `hairline`, 10 px radius, 16 px padding; selected: 2 px `ink` border; title `body` 600, description `small` muted, "Free" or "Needs a key" chip |
| Checkbox | 16 px, `border-control`; checked `ink` + `canvas` check |
| Labels | `body` 500 above (8 px gap); help `small` muted below |

### Status and data display

| Component | Style |
| --- | --- |
| Status badge | Pill 22 px, 8 px padding, 12 px icon + `caption`; large variant 28 px with `small` on Run detail header |
| Table | `surface`, 10 px radius, `hairline` border; header `sunken` + `caption` muted; row dividers `hairline`; hover `sunken`; numbers right-aligned tabular; whole row clickable |
| Section card | `surface`, `hairline`, 10 px, padding 20 (24 desktop), `h2` title + optional right action |
| KPI group | One surface split by vertical hairlines; value `kpi`, label `small` muted, info icon with definition |
| Tabs | Text tabs, 2 px `ink` underline on active, inactive muted, 40 px tall, count badges in `sunken` pills |
| Sidebar item | 36 px, 20 px icon + `body`; active `sunken` bg, 3 px `slate` left bar, 600 |
| Tooltip | `ink` bg, `canvas` `small` text, 6 px radius, max 280 px, 400 ms delay |
| GitHub label chip | Pill, `sunken`, mono `caption`, 8 px colour dot in the label colour (GH-09) |
| Model chip | Pill, `surface` + hairline, mono `caption`, preset icon (GitHub mark, llama-free generic chip icon for local, cloud for keyed) |

### Feedback

| Component | Style |
| --- | --- |
| Installation banner | Full width, 10 px, tint background, 4 px left edge (critical: `signal`; others: their status colour), 20 px icon, `body`, action on the right |
| Outcome banner | Same, `body-lg`, 24 px padding, up to two buttons |
| Toast | `ink` bg, `canvas` text, 14 px radius, 360 px wide, icon by type (`screen-green`, `screen-red`, `screen-amber`), close button, slides 8 px from the right in 160 ms |
| Modal | `surface`, 14 px, 24 px padding, `h3` title, footer buttons right-aligned with Cancel on the left of primary; 560 px (480 for Fix an issue) |
| Skeleton | `sunken` blocks matching layout; 1.6 s soft shimmer; static with reduced motion |
| Empty state | Centered, max 420 px: 64 px line illustration (1.5 px `slate`), `h3`, `body` muted, one button |

### Signature components

**Proof strip (Run detail, SCR-01 demo, replay).** Two cells joined by an arrow. "Before fix": 4 px `signal` left edge, "Failed" + cross, repro test id (mono), first failure line. "After fix": 4 px `success` left edge, "Passed" + check + duration; until verified, a dashed `hairline` outline reading "Waiting for a fix that passes". Below, a facts row of chips (suite counts, breaking commit, confidence, rollbacks). The only place `signal` is large and proud.

**Step tracker.** Eight 24 px nodes joined by a 2 px line. Not started: hairline outline. Running: slate ring with a rotating 90° arc. Passed: success fill + canvas check. Failed: danger fill + cross. Skipped: dashed outline. Reproduce gets a small `signal` dot when the repro is confirmed; it fades as Fix and verify turns green. Labels `small` under nodes; extra text `caption` muted.

**Screen viewers (logs, diff, code).** `screen` background, 10 px radius, inset in the cream page. Toolbar in `screen-raised`. Text `mono-log` `screen-text`; line numbers `screen-muted`; stderr/failing lines `screen-red`; search matches `screen-amber` at 30% background. Diff: added `rgba(61,220,151,0.12)` + green gutter sign; removed `rgba(255,77,109,0.14)` + red sign; file headers `screen-raised` with mono path and +/− counts.

**Heat gutter (Suspicious code).** In the code viewer, a 4 px gutter left of line numbers coloured by suspicion: none (transparent) → `screen-muted` 40% → `screen-amber` → `screen-red` for the top line. A score bar per region on the cream card: 4 px tall, `sunken` track, `ink` fill proportional to score, number in tabular `caption`. Source chips (Coverage, Stack trace, Breaking commit, Search) are neutral pills; "Changed by the fix" is a success-tint pill.

**Bisect strip (Breaking commit card).** A horizontal line of commit dots between "good" and "bad". Good commit: success ring. Tested-good: small success dot. Tested-bad: small `danger` dot. Skipped: hollow muted dot. First bad commit: 14 px `signal` node with a mono SHA label beneath. Untested commits are a thin hairline segment. On first view of a found result the tested dots appear in test order over 600 ms (instant with reduced motion), ending on the red node: the search narrowing to one commit.

**Hypothesis ledger (Attempts tab).** A vertical list with a 2 px hairline spine. Each hypothesis is a surface card; accepted gets a 4 px `success` left edge, rejected/abandoned a 4 px `hairline` edge. Attempt rows sit on the spine as 10 px nodes: passed (success), rolled back (warning node with rotate-ccw icon), no progress (muted), failed check (warning). Rolled-back rows show their reason in `small` warning text; the rollback is the story, so it is never hidden.

**Confidence meter.** A 5-segment bar (each 20 points) in `ink` for filled segments and `sunken` for empty, plus the level word and score in tabular figures. High/Medium/Low are never coloured red; Low uses `warning` text.

**Setup checklist (SCR-08).** Numbered cards on a hairline spine. Pass: success check node, collapsed. Fail (blocking): warning node, expanded, with a 4 px `warning` left edge. Warn (non-blocking): muted node. Unknown: dashed node. External-link buttons inside cards use the External variant. The YAML preview is a screen viewer with line numbers.

**Landing hero (SCR-01).** Left: wordmark, `hero` headline, `body-lg` text, buttons. Right (≥ 1280 px; stacked below on smaller screens): a `screen` panel 520 px wide showing a terminal-like run log that ends in the proof strip (rendered as a light card inside the panel). It plays once (≤ 2.5 s total) and rests on the final frame; static final frame with reduced motion.

**Replay playback bar (SCR-14).** `screen-raised` bar, 48 px, under the tracker: play/pause (36 px icon button), speed segmented control (1×, 4×, 16×), a scrubber (2 px `screen-muted` track, `screen-text` progress, 12 px thumb) with event ticks (`screen-red` ticks for failures, `screen-green` for passed gates), elapsed / total time in tabular mono.

### Charts (Recharts)

Series by meaning: PR ready `success`, Not fixed `warning`, Failed `danger`, Cancelled `#A8968A`; single series `slate`. Gridlines `hairline`; axes `caption` muted; no gradients, 3D or area fills above 12%; bar corners 3 px; tooltips styled as toasts. Titles state the reading ("Fix rate doubled after switching to qwen3-coder"), not just the metric.

## 6. Dashboard structure

Every screen follows the same frame: title row, banner slot, then content in reasoning order. Run detail is the screen the design is built around.

**Run detail (SCR-10), desktop ≥ 1280 px.**

```text
┌ Breadcrumb · #142 Date parser crashes on leap years          [Review PR #57] [⋯] ┐
│ ● PR ready · Started by @priya with the fixie label · 9m 12s · ollama/qwen3… · $0.00 │
├ Outcome banner (success tint) ────────────────────────────────────────────────────┤
├ Step tracker  ●──●──●──●(•)──●──●──●──●                                           ┤
├ Proof strip  [▌Failed  tests/test_dates.py::test_leap_day …] → [▌Passed 0.4s]      ┤
│             (212 → 213 passed · 0 new) (Breaking commit a1b2c3d) (High 86) (1 rolled back) │
├──────────────────────────────────────────────┬─────────────────────────────────────┤
│ Tabs: Evidence · Attempts · Timeline · Logs · │ Pull request card                   │
│       Diff · Tests & checks                   │ Issue and trigger                   │
│ (tab content)                                 │ Cost and model                      │
│                                               │ Settings used · Trace               │
└──────────────────────────────────────────────┴─────────────────────────────────────┘
```

**Per-screen layout.**

| Screen | Top to bottom | Emphasis |
| --- | --- | --- |
| SCR-01 Welcome | Hero (text left, screen panel right) → three facts → small print | The only `hero` type; the screen panel is the cinematic moment |
| SCR-03/04 Onboarding | Minimal top bar → 640 px column: `display` heading, paragraph, numbered list, primary button | Calm; no illustration beyond the mark |
| SCR-05 Overview | Title + period → banners → KPI surface (8 tiles; Merged PRs spans 2 columns on wide screens) → charts (P1) → Active now + Needs attention side by side | "All clear" shows the butterfly |
| SCR-06 Repositories | Title → welcome callout → toolbar → table | Setup column is the main signal; problems are amber, never red |
| SCR-07 Repository | Breadcrumb → title + badges → setup callout → trigger card (label chip like a real GitHub label) → this-month strip → runs | Teaches the GitHub workflow |
| SCR-08 Setup | Breadcrumb → title + "{k} of 6" summary + Check again → checklist → doctor card → In this Hub card | Reads like a guided checklist, not a form |
| SCR-09 Runs | Title → filters → table with live status and evidence icons | Live rows change only their badge; rows never animate or reorder under the cursor |
| SCR-10 Run detail | As above | Proof strip, tracker, bisect strip, ledger, screens |
| SCR-11 Settings | 760 px column of cards; sticky save bar (`ink`, `canvas` text, 64 px) slides up when dirty | Locked ruleset toggle with lock icon |
| SCR-12 Audit | Title → filters → compact table; rows expand into a `sunken` panel | Mono only for codes and ids |
| SCR-13 Account | 760 px column: profile, installations, sessions, danger zone (1 px `danger` border) | Plain |
| SCR-14 Replay | Drop zone (centred, dashed `border-control`, 10 px radius, 240 px tall) → after load: replay banner + Run detail + playback bar | Feels like reviewing footage |

**Live states.** Real-time values change in place without layout shift; new timeline events fade in over 120 ms; the live indicator is a 6 px `slate` dot pulsing once every 2 s, never red.

## 7. Mobile responsiveness

On a phone Fixie is for checking and deciding (is it done, what failed, open the PR), not deep log reading. Every action remains available; content reorders around status and proof.

| Name | Width | Shell | Grid |
| --- | --- | --- | --- |
| Mobile | < 768 px | Top bar + menu button; sidebar is a 280 px left drawer | 4 columns, 16 px |
| Tablet | 768–1279 px | 64 px icon rail with tooltips | 8 columns, 24 px |
| Desktop | 1280–1599 px | 240 px sidebar | 12 columns, 32 px |
| Wide | ≥ 1600 px | 240 px sidebar; content max 1440 px, left-aligned | 12 columns |

| Pattern | Below 768 px |
| --- | --- |
| Tables | Stacked rows: line 1 issue/repo (`body` 600), line 2 badge + relative time, line 3 meta `small` muted; 64 px min height; whole row tappable |
| Title-row primary action | Sticky bottom bar (`canvas`, top hairline, 44 px button, safe-area padding); secondary actions in ⋯ |
| Filters | One "Filters" button → bottom sheet; active count on the button |
| Modals | Full-height bottom sheets with drag handle; buttons stacked full-width, primary on top |
| KPIs / charts | 2 tiles per row; charts full-width, horizontally scrollable when needed |
| Run detail header | Title ≤ 3 lines; badge and duration on their own row; sticky bottom bar with "Review PR" or "Cancel run" |
| Step tracker | Vertical; collapsed to the current step + "Show all steps" |
| Proof strip | Before/after stacked with a down arrow; fact chips wrap |
| Tabs | Horizontally scrollable; sidebar cards move above tabs as collapsible sections, PR card first |
| Bisect strip | Horizontal scroll inside its card, first bad commit scrolled into view |
| Logs / diff | Full width; command list and file list become selects; wrap lines on; unified diff only |
| Setup checklist | Full width; external buttons full-width inside cards; YAML preview scrolls horizontally |
| Replay bar | Sticky at the bottom; speed control becomes a single cycling button |
| Toasts / banners | Toasts at the top, full width − 16 px; banners clamp to 3 lines with "More" |

Tap targets ≥ 44 × 44 px; tooltips reachable by tapping the info icon; no horizontal page scroll; respect `env(safe-area-inset-*)`.

## 8. UX principles, motion and brand motif

When two principles conflict, the earlier one wins.

1. **Proof is one click away.** Every claim ("repro failed", "no test broke", "breaking commit", "rolled back") links to the log line, test result, gate evidence or checkpoint behind it.
2. **Red means the bug.** Colour carries meaning; status always pairs colour with an icon and a word.
3. **A person decides.** The success action is "Review on GitHub", never "Merge" or "Accept". Avoid "auto", "magic", "done for you".
4. **Honest about failure.** Not-fixed outcomes are amber and lead with what Fixie learned, not an apology.
5. **Say why something is unavailable.** Disabled controls carry a tooltip with the reason and the fix; blocked flows show the next step (setup cards, M-ENABLE).
6. **Calm while live.** In-place updates, no layout shift, no reordering under the cursor.
7. **Reading order is reasoning order.** What happened → proof → cause → attempts → change → raw detail.
8. **Plain words.** Sentence case, active verbs, outcome-named buttons; errors say what happened and what to do.
9. **Keyboard first (P1).** `/` search, `f` Fix an issue, `g o` / `g r` / `g u` Overview / Repositories / Runs, `j`/`k` rows, `Enter` open, `[`/`]` previous/next tab on Run detail, `space` play/pause in replay, `?` shortcuts, `Esc` close.

**Motion.**

| Purpose | Duration | Easing |
| --- | --- | --- |
| Hover/press, timeline fade-in | 120 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Menus, tooltips, toasts | 160 ms | same (enter), `cubic-bezier(0.4, 0, 1, 1)` (exit) |
| Modals, sheets, drawer, save bar | 240 ms | same |
| Proof moment | 400 ms | `cubic-bezier(0.2, 0, 0, 1)` |
| Bisect strip reveal | 600 ms total | linear stagger |
| Landing hero sequence | ≤ 2.5 s, once | `cubic-bezier(0.2, 0, 0, 1)` |

No page-load entrance animations elsewhere, no staggered section reveals, no hover lifts. With `prefers-reduced-motion: reduce` everything becomes instant or a 120 ms fade; spinners become a static icon with "Running".

**The proof moment.** When `repro_passes_after` arrives on a run being watched (or reached in replay), the dashed after-cell fills with "Passed", the arrow draws left to right, and the red dot on Reproduce fades as Fix and verify turns green, within 400 ms. Once per run; never on reload.

**Brand motif.**

- **Wordmark:** "fixie" lowercase IBM Plex Sans 600, tracking -0.03em, `ink`; the i-dot is a `signal` circle (the bug). The only red on a calm screen.
- **Favicon/app icon:** `ink` rounded square with one red dot.
- **The butterfly:** a fixed bug becomes a butterfly. A small line drawing (1.5 px `slate`, never red) appears only on the Overview "All clear" state and the onboarding completion screen.
- **Empty-state illustrations:** specimen-style line drawings in `slate` (magnifier over a code line, labelled jar, pinned card, branching commit line), 64 px, no fills, no people.

## 9. Visual references

Borrow behaviours, never the look; Fixie's cream, ink and red must be recognisable on every screen.

| Reference | Borrow | Don't borrow |
| --- | --- | --- |
| Linear (issue list and view) | Density, quiet chrome, keyboard shortcuts, 16 px status icons | Dark-first theme, purple accent |
| Vercel (deployment detail, build logs) | Step timeline beside a streaming log, collapsible groups, live duration | Pure black-and-white minimalism |
| GitHub (PR "Files changed", commit graph) | Diff conventions, file list, +/− counts, commit-dot lines for the bisect strip | Light grey palette, green/red fills on white |
| Sentry (issue detail) | Evidence-first: cause and stack before raw events; suspect-commit callout | Many tabs, dense chart headers |
| Stripe Dashboard | KPI definitions, tabular numbers, precise empty states | Gradient marketing surfaces |
| Raycast | Crisp keyboard affordances | Glassy translucent panels |
| Replay/video editors (e.g. a simple timeline scrubber) | Play/pause, speed, scrubber with event ticks for SCR-14 | Heavy editing chrome |
| Museum specimen labels, lab notebooks | The brand idea: a bug pinned, labelled, studied, resolved; hairline frames, generous margins | Literal insect imagery beyond the butterfly |

**Mood check before shipping a screen:** next to a Linear issue and a GitHub PR, a Fixie screen is instantly identifiable by its cream canvas, ink type and the single red marking the bug.

## 10. Builder handoff (Tailwind CSS v4 + shadcn/ui)

Tokens are the single source of truth; never use a raw hex in a component.

**Fonts** (`app/layout.tsx`):

```tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });
// <html className={`${sans.variable} ${mono.variable}`}>
```

**`app/globals.css`:**

```css
@import "tailwindcss";

@theme {
  --breakpoint-*: initial;
  --breakpoint-md: 768px;
  --breakpoint-xl: 1280px;
  --breakpoint-wide: 1600px;

  /* brand */
  --color-canvas: #F5EAE4;
  --color-ink: #030B18;
  --color-slate: #313E60;
  --color-signal: #FE0032;
  /* surfaces and lines */
  --color-surface: #FBF6F2;
  --color-sunken: #EBDCD3;
  --color-hairline: #E0CFC5;
  --color-border-control: #6B7385;
  --color-muted: #5B6478;
  /* status */
  --color-danger: #C8002A;   --color-danger-tint: #FDE3E8;
  --color-success: #2E6B4F;  --color-success-tint: #E3EFE7;
  --color-warning: #8A5200;  --color-warning-tint: #F8EAD2;
  --color-info: #313E60;     --color-info-tint: #E4E7EF;
  --color-cancelled: #A8968A;
  /* screen */
  --color-screen: #030B18;
  --color-screen-raised: #0B1526;
  --color-screen-text: #E6DFD9;
  --color-screen-muted: #7F8AA3;
  --color-screen-red: #FF4D6D;
  --color-screen-green: #3DDC97;
  --color-screen-amber: #FFB547;

  /* type */
  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --text-hero: 56px;    --text-hero--line-height: 60px;    --text-hero--letter-spacing: -0.03em;  --text-hero--font-weight: 600;
  --text-display: 40px; --text-display--line-height: 44px; --text-display--letter-spacing: -0.02em; --text-display--font-weight: 600;
  --text-h1: 28px;      --text-h1--line-height: 34px;      --text-h1--letter-spacing: -0.015em;    --text-h1--font-weight: 600;
  --text-h2: 20px;      --text-h2--line-height: 28px;      --text-h2--letter-spacing: -0.01em;     --text-h2--font-weight: 600;
  --text-h3: 16px;      --text-h3--line-height: 24px;      --text-h3--font-weight: 600;
  --text-body-lg: 16px; --text-body-lg--line-height: 26px;
  --text-body: 14px;    --text-body--line-height: 22px;
  --text-small: 13px;   --text-small--line-height: 18px;
  --text-caption: 12px; --text-caption--line-height: 16px; --text-caption--letter-spacing: 0.01em; --text-caption--font-weight: 500;
  --text-kpi: 32px;     --text-kpi--line-height: 36px;     --text-kpi--letter-spacing: -0.02em;    --text-kpi--font-weight: 600;
  --text-mono: 13px;    --text-mono--line-height: 20px;
  --text-mono-log: 12.5px; --text-mono-log--line-height: 20px;

  /* shape, depth, motion */
  --radius-control: 6px;
  --radius-container: 10px;
  --radius-overlay: 14px;
  --shadow-menu: 0 8px 24px rgba(3, 11, 24, 0.12);
  --shadow-overlay: 0 16px 48px rgba(3, 11, 24, 0.18);
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}

/* shadcn/ui semantic variables mapped to Fixie tokens */
:root {
  --background: var(--color-canvas);
  --foreground: var(--color-ink);
  --card: var(--color-surface);
  --card-foreground: var(--color-ink);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-ink);
  --primary-foreground: var(--color-canvas);
  --secondary: var(--color-surface);
  --secondary-foreground: var(--color-ink);
  --muted: var(--color-sunken);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-sunken);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-danger);
  --border: var(--color-hairline);
  --input: var(--color-border-control);
  --ring: var(--color-slate);
  --radius: 10px;
}

html { background: var(--color-canvas); color: var(--color-ink); font-family: var(--font-sans); font-size: 14px; line-height: 22px; }
:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--color-canvas), 0 0 0 4px var(--color-slate); }
.tabular { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 120ms !important; }
}
```

Utilities then read naturally: `bg-canvas text-ink`, `bg-surface border border-hairline rounded-container`, `text-h1`, `font-mono text-mono`, `bg-screen text-screen-text`, `shadow-overlay`, `ease-out`, `md:` / `xl:` / `wide:`.

**Paste-ready prompt for an AI UI builder:**

```text
Build the Fixie Hub dashboard (Next.js 16 App Router, Tailwind CSS v4 with the @theme tokens in "04_UI_Design_Brief_Fixie.md" §10, shadcn/ui, Recharts, Lucide) following "03_Webapp_Flow_Spec_Fixie.md" for screens, behaviour and exact copy.
Visual rules: page background is always #F5EAE4 (canvas). Text and primary buttons #030B18 (ink). Links, active nav, focus rings, info and running states #313E60 (slate). #FE0032 (signal) marks only the bug: brand i-dot, failing repro, failed checks, the breaking commit, critical banner edge; never body text or a filled button with text; use #C8002A for red text and destructive buttons.
Type: IBM Plex Sans (14px base) for UI; IBM Plex Mono only for copyable content (commands, paths, test ids, SHAs, model ids, logs, diffs, YAML). Sentence case, tabular numbers.
Surfaces #FBF6F2 with 1px #E0CFC5 hairlines and no in-page shadows; shadows only on menus, modals, toasts. Radii 6 controls, 10 containers, 14 overlays, full badges.
Code, logs, diffs and YAML render in a dark "screen" (#030B18) inset in the cream page. Run detail shows an 8-step tracker, a proof strip (before: failed, red edge; after: passed, green edge), a bisect strip ending on a red first-bad-commit node, a hypothesis ledger with rolled-back attempts, and a suspicious-code viewer with a heat gutter. These are the only bold areas.
Light theme only. WCAG 2.1 AA. Respect prefers-reduced-motion. No gradients, glassmorphism, sparkle/AI icons or card grids.
```

**Do / don't checklist.**

- [ ] Canvas `#F5EAE4` behind every screen, including SCR-01 and SCR-14.
- [ ] No raw hex in components; tokens only.
- [ ] `#FE0032` never for text under 24 px or behind text; red text uses `danger`.
- [ ] Every status = icon + word + colour.
- [ ] One primary (ink) button per view.
- [ ] Tables for lists on desktop; stacked rows on mobile.
- [ ] Mono only for copyable content.
- [ ] No in-page shadows, hover lifts or page-load animations (except SCR-01's hero, once).
- [ ] Proof moment once, 400 ms; bisect reveal once, 600 ms; both respect reduced motion.
- [ ] Rolled-back attempts always visible in the ledger, in warning colour, never hidden.
- [ ] Butterfly only in the two places in §8.
- [ ] Tap targets ≥ 44 px; no horizontal page scroll.
