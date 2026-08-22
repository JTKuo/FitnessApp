# FitnessApp UI/UX System

> Status: v0.1 — product interaction foundation
>
> This document is the source of truth for visual hierarchy and interaction rules. Data/schema decisions remain in `FitnessApp-Schema-V3.md`.

## 1. Product character

FitnessApp should feel like a focused training tool rather than a generic dashboard. The visual language is dark, technical, compact and confident, with yellow used as a brand/accent color instead of a border applied to every control.

The target is **簡潔大方，但仍保有品牌辨識度**. Minimal does not mean flat or anonymous.

## 2. Core principles

1. **Training-first hierarchy** — the current workout, active set and primary action receive the strongest visual emphasis.
2. **One meaning, one primary control** — avoid two large controls that express the same action. Example: completing a set already starts rest, so a separate large Rest button should not compete with Complete.
3. **State changes stay in place** — controls should transform between states rather than adding/removing unrelated UI. This borrows the useful idea behind morphing icon systems without requiring a morph-animation dependency.
4. **Affordance before decoration** — clickable states need a visible shape, outline, surface or other interaction cue. Plain labels should not secretly be buttons.
5. **Brand color is scarce** — yellow highlights focus, selected/primary state, important metrics and primary CTA. Neutral controls remain gray/black.
6. **Mobile-first / one-hand use** — common workout actions should be reachable, large enough to tap and require as little hand travel as possible.
7. **Progressive disclosure** — destructive/rare actions stay visually secondary; frequently used training actions remain obvious.
8. **No DOM decoration loops** — canonical workout controls belong in templates/render functions. Do not reintroduce broad MutationObserver decorators for feature UI.

## 3. Brand tokens (v0.1)

These are semantic roles. Exact values may be refined after the full app consistency audit.

| Token | Role | Current direction |
| --- | --- | --- |
| Brand / Accent | primary training state, focus, key CTA | `#ffc300` family |
| Surface 0 | app background | near black |
| Surface 1 | exercise cards | black/brown-black with subtle depth |
| Surface 2 | controls / compound fields | neutral dark gray |
| Text primary | data/input values | near white |
| Text secondary | metadata / units | gray |
| Success | completed set | green |
| Danger | destructive action | red, only on intent/active states |

### Borders

- Cards may use a very subtle brand-tinted border to retain FitnessApp identity.
- Ordinary controls use neutral borders.
- Focus/selected primary state may transition to brand yellow.
- Avoid permanent yellow outlines on every input.

### Radius

Use a small family rather than arbitrary radii:

- compact controls: ~10–12px
- compound fields / rows: ~12–14px
- cards / major surfaces: ~16–20px
- circular icon actions: 9999px only when the control is intentionally circular

## 4. Typography hierarchy

- Exercise name: strong brand heading.
- Weight/reps values: high-contrast primary data.
- Previous performance / volume: secondary information; useful but must not compete with the active set.
- Unit, SetNo and notes placeholder: tertiary information.

Do not use yellow merely because text is important; use size/weight/placement first.

## 5. Icon rules

- Keep one icon family and stroke language within the workout flow.
- Icons that are clickable must have an adequate touch target even when their visible glyph is small.
- A state icon should remain in the same physical location across transitions when possible.
- Completed set: outline check → completed check state.
- Set type: barbell = 訓練, flame = 熱身.
- Trash is destructive and visually secondary until hover/press/intent.
- Do not rely on icon-only meaning when ambiguity is high. Example: `+` alone is not enough to distinguish adding a set vs adding an exercise.

## 6. Motion

Motion is functional feedback, not decoration.

Use motion for:

- state transitions (訓練 ↔ 熱身, incomplete ↔ complete)
- opening/closing focused input UI
- adding/removing a set
- timer completion feedback

Guidelines:

- ~120–220ms for micro-interactions
- avoid layout-jumping animations during active training input
- respect `prefers-reduced-motion`
- no broad observer-driven animation/decorator loops

## 7. Touch targets

- Primary workout actions: target ~44px minimum interactive area.
- Small circular actions may visually appear ~32px but should preserve a larger effective hit area where layout permits.
- Do not make users accurately target tiny text labels during a workout.

## 8. Canonical Workout Set Row

Each set is one coherent horizontal unit:

`Set identity / type → value + unit → reps/duration → complete → delete`

### Set identity

`SET n` and SetType are visually grouped, not two unrelated labels.

### Set type hierarchy

Backend values remain:

- `working`
- `warmup`

Visible labels are:

- `訓練`
- `熱身`

**訓練 is the primary/default state and should receive the stronger brand highlight.**

熱身 remains clearly clickable but visually secondary. Both states retain an outlined/surfaced affordance.

### Compound numeric field

Weight and unit belong to one compound field:

`[ value | kg ]`

- value is primary
- unit is secondary
- a subtle internal vertical divider separates them
- focus applies to the compound control rather than two unrelated boxes

### Complete → Rest

Completing a valid set is the primary end-of-set action.

`tap complete → mark set complete → start default rest timer`

Do not show a competing permanent large Rest button inside the exercise card when Complete already owns this flow. Rest Timer remains available through its timer UI once active.

### Delete

Delete remains on the same row as Complete, but with lower visual priority.

## 9. Add Set interaction

`新增一組` is contextual to the exercise, not to every existing set.

Preferred placement:

- once, immediately after the final set
- visually lightweight and centered
- include both `+` and the text `新增一組`
- may use subtle horizontal rules to read as an insertion point

Avoid a `+` under every set unless a future explicit "insert here" feature is introduced.

Current add behavior may inherit previous weight/unit/set type. Do not expose a separate large Copy action when its behavior substantially overlaps Add Set.

## 10. Notes

Workout notes should not show a desktop-native scrollbar during normal use.

Canonical behavior:

1. default compact height
2. auto-grow as text wraps
3. stop growing at a defined max height
4. only then enable internal scrolling
5. scrollbar uses a thin neutral thumb and transparent track

This rule applies to exercise notes first and should later be audited for session notes and other multiline fields.

## 11. Destructive actions

- Delete exercise: visible but secondary in the card header.
- Delete set: same row as Complete, visually muted until interaction.
- Confirmation should be reserved for destructive actions with meaningful recovery cost; avoid excessive confirmation friction for easily reversible local edits.

## 12. Workout card hierarchy

Preferred order:

1. Exercise identity
2. Previous performance + compact volume summary
3. Set rows
4. Contextual `＋ 新增一組`
5. Exercise note

The user should be able to scan a card top-to-bottom as a training workflow, not as a collection of equally weighted controls.

## 13. Cross-app consistency audit

After the Workout canonical interaction is stable, audit:

- Dashboard
- Workout
- History / Analysis
- PRs
- Profile
- InBody
- Modals / pickers

Audit for:

- color roles
- border/radius families
- heading/text hierarchy
- button priority
- icon family and touch targets
- input/focus states
- empty/loading/error states
- destructive actions
- spacing rhythm

## 14. Open questions

These require real-device feedback rather than being decided only in code review:

- final strength of yellow highlight for the default 訓練 state
- whether Complete needs a short visible label on very wide screens or remains icon-first
- whether completed sets should visually dim their inputs after completion
- whether Add Set should inherit reps or keep reps blank
- whether exercise note should collapse when empty after the workout flow is mature

## 15. Implementation order

1. Lock Workout Set Row interaction and visual hierarchy.
2. Auto-grow exercise note + consistent scrollbar fallback.
3. Make 訓練 the primary SetType highlight.
4. Merge Complete + Rest interaction in the visible UI.
5. Move Add Set to a contextual action after the final set.
6. Validate Warmup/Working on a real device and in WorkoutLog / WorkoutSessions.
7. Only then add duration and unilateral/per-hand controls.
8. Run the cross-app consistency audit before major Coach UI expansion.
