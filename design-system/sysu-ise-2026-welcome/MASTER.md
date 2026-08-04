# SYSU ISE 2026 Welcome — Master Design System

## Direction

The homepage is a campus exploration console for new engineering students: an asymmetric Bento grid combined with map wayfinding, route nodes, coordinates, and field-note details. It must feel youthful and collegiate, not like a commercial SaaS dashboard.

The signature moment is a bright route line moving through the campus progress card. Decoration stays quiet elsewhere so real status and next actions remain primary.

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `--ise-ink` | `#0A2E3B` | Navigation, headings, dark panels |
| `--ise-primary` | `#0D9488` | Main actions, progress, active state |
| `--ise-primary-dark` | `#08766D` | Hover and pressed state |
| `--ise-accent` | `#C7F24A` | Route nodes and limited highlights |
| `--ise-canvas` | `#F3F7F5` | Page background |
| `--ise-surface` | `#FFFFFF` | Cards and dialogs |
| `--ise-text` | `#102A2E` | Body copy |
| `--ise-muted` | `#5E7271` | Secondary copy |
| `--ise-border` | `#D6E4DF` | Borders and dividers |
| `--ise-danger` | `#C2413A` | Error state |

Never use purple, pink-purple gradients, or low-contrast grey-on-grey text. Accent green is reserved for small, high-value markers and always paired with dark text.

## Typography

- Display: `"DIN Alternate", "Avenir Next", "Noto Sans SC", "Source Han Sans SC", sans-serif`
- Body: `"Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif`
- Technical labels: `"SFMono-Regular", Menlo, Consolas, monospace`
- Mobile body text is at least 16px with 1.55 line-height. Headings use weight 700–800 and tight but readable tracking.

## Layout and components

- Spacing follows a 4/8px scale: 4, 8, 12, 16, 24, 32, 48, 64.
- Mobile starts at 375px with one content column and a four-item bottom navigation.
- Tablet uses two columns; desktop at 1024px uses a 12-column asymmetric grid and top navigation.
- Desktop content max-width is 1240px with 24–40px adaptive gutters.
- Cards use 16px or 24px radii, 1px borders, flat surfaces, and a restrained `0 18px 48px rgba(10,46,59,.08)` shadow only for elevated layers.
- Clickable cards use semantic links or buttons, retain visible focus rings, and have at least 44×44px hit areas.
- Icons come exclusively from Lucide Vue, defaulting to 1.8px stroke with 20px and 24px size tokens. Emoji are never structural icons.

## Motion

- Entrance: 220–360ms, ease-out; Bento items stagger by 40ms.
- Hover/press/focus: 180–220ms. Press feedback must not shift surrounding layout.
- Dialog: 260ms enter, 180ms exit. Progress route draw may run up to 400ms.
- Animate only opacity and transform. All nonessential motion is removed under `prefers-reduced-motion: reduce`.

## Accessibility and performance

- Normal text contrast is at least 4.5:1; large text and glyphs at least 3:1.
- Keyboard order follows visual order; icon-only controls require descriptive labels.
- Modal focus is contained, Escape closes it, and focus returns to meaningful content.
- Images declare an aspect ratio, use responsive sizing, and lazy-load below the fold.
- Loading reserves layout space with skeletons; network errors include a recovery action.
- Never rely on hover or color alone for important meaning.

## Avoid

- Empty marketing heroes, generic feature grids, glassmorphism, purple gradients, fake metrics, decorative infinite animation, emoji icons, and unavailable features that appear operational.
