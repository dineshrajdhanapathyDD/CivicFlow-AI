---
inclusion: auto
name: frontend-taste
description: Anti-slop frontend and UI design guidance for building landing pages, portfolios, marketing sites, redesigns, and any web UI. Activate when creating or styling frontend interfaces, choosing layout, typography, color, motion, or design systems, so the result does not look templated or generic AI slop.
---

# Frontend Design Reference (taste-skill)

Source: https://github.com/Leonxlnx/taste-skill (skill `design-taste-frontend`, MIT).
The full skill lives at `.kiro/skills/taste-skill/SKILL.md`. Read it before non-trivial
frontend work. This file is the quick-reference summary of its hard rules.

## Before writing any UI
1. Read the brief and state a one-line **Design Read**: "Reading this as: <page kind>
   for <audience>, with a <vibe> language, leaning toward <design system / aesthetic>."
2. Ask at most ONE clarifying question, and only if the design read genuinely diverges.
   Otherwise infer and proceed.
3. Set three dials (baseline `8 / 6 / 4`): DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY.

## Anti-default discipline (do NOT reach for these)
- No AI-purple / blue-glow gradients, centered hero over dark mesh, three equal feature
  cards, glassmorphism on everything, or infinite micro-animations everywhere.
- No `Inter` as default sans (prefer Geist, Outfit, Cabinet Grotesk, Satoshi).
- Serif is VERY discouraged as default. `Fraunces` and `Instrument_Serif` are banned as
  defaults. Sans display is the default even for "creative / premium" briefs.
- Premium-consumer beige+brass+espresso palette is banned as a default reach.
- No emojis in UI by default. No hand-rolled SVG icons; use one icon family
  (Phosphor / Hugeicons / Radix / Tabler), not `lucide-react` by default.

## Design system map
- If the brief maps to a real system (Fluent, Material 3, Carbon, Polaris, Atlaskit,
  Primer, GOV.UK, USWDS, Radix Themes, shadcn/ui), install the OFFICIAL package. Don't
  hand-recreate its CSS. One system per project.
- If the brief is an aesthetic (bento, brutalism, editorial, glass, kinetic type), build
  with native CSS + Tailwind v4 and label borrowed inspiration honestly.

## Stack defaults
- React / Next.js, Server Components by default; interactivity isolated in `'use client'` leaves.
- Tailwind v4 (use `@tailwindcss/postcss` or the Vite plugin, not the old `tailwindcss` plugin).
- Motion (`import { motion } from "motion/react"`). Never drive continuous values
  (scroll, pointer) through `useState`; use `useMotionValue` / `useTransform` / `useScroll`.
- Fonts via `next/font` or self-hosted `@font-face` + `font-display: swap`.
- Check `package.json` before importing any library; output the install command if missing.

## Hard layout rules (failing any = broken work)
- Hero fits the initial viewport: headline max 2 lines, subtext max 20 words / 4 lines,
  CTAs visible without scroll. Hero top padding max `pt-24`. Max 4 text elements in the hero.
- Use `min-h-[100dvh]` for full-height heroes, never `h-screen`.
- Nav on one line at desktop, height max 80px.
- Max 1 accent color, saturation < 80%; lock it across the whole page. Lock one
  corner-radius scale across the page.
- A page with 8+ sections uses at least 4 different layout families; no layout family
  repeats more than once. Max 2 consecutive image+text zigzag sections.
- Max 1 eyebrow (small uppercase tracked label) per 3 sections; hero counts as one.
- No split-header (big headline + small right paragraph) as a default section header.
- Bento grid has exactly as many cells as content; vary cell backgrounds (not all white-on-white).

## Interactive states & accessibility (mandatory)
- Implement loading (skeletons, not spinners), empty, and error states, not just success.
- Tactile `:active` feedback (`-translate-y-[1px]` or `scale-[0.98]`).
- Button and form contrast must pass WCAG AA (4.5:1 body, 3:1 large text). No white-on-white
  buttons, no placeholder-as-label, labels above inputs, errors below.
- Primary CTA label fits one line at desktop (1-3 words). One label per intent across the page.
- Italic display words with descenders need `leading-[1.1]` min + reserve padding.

## Images
- Use an image-gen tool if available for section-specific assets; else real photography
  (`https://picsum.photos/seed/{seed}/{w}/{h}`); last resort, leave labeled TODO slots and
  tell the user which images are needed. Even minimalist sites need 2-3 real images.
- Real SVG logos for social proof (Simple Icons / devicon), not plain text wordmarks.

## Related skills in the taste-skill repo
Install others as needed with `npx skills add https://github.com/Leonxlnx/taste-skill --skill "<name>"`:
`redesign-existing-projects`, `high-end-visual-design`, `minimalist-ui`,
`industrial-brutalist-ui`, `image-to-code`, `full-output-enforcement`, `gpt-taste`.
