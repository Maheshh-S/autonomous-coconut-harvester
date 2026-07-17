# 10 — Google Flow Guidelines

> Master specification for ALL future Google Flow (Veo) prompts. Goal: every clip (A1–A7,
> §09) feels like one documentary film of an autonomous coconut plantation. Derived from
> `02-brand-strategy.md §4` (brand world) and `06-shot-list.md`. No generation in this phase;
> the improved `assets/prompts/` set is written to match this.

---

## 1. Camera Language
- **Steady, machine-mounted feel.** Drones = smooth gimbal, no handheld jitter. The robot
  shot = locked tracking, no shake. This reads as "precision instrument," not "vacation reel."
- **Slow, deliberate moves.** Push-ins, holds, gentle pans/orbits. No whip pans, no frenetic
  cuts. Calm authority (constitution §3).
- **Real focal lengths:** wide 24–35mm for aerials/establishing; 35–50mm for drone-follow and
  robot; 50–85mm close for the palm/maturity shot. No extreme fisheye, no fake tilt-shift.

## 2. Lens Language
- Natural perspective, slight depth falloff. Soft foreground/background separation via real
  depth, not fake bokeh blobs. Subtle, not cartoonish.

## 3. Color Grading
- **Tropical-dark, warm-real.** Golden-hour and soft-morning palettes. Warm key, gentle fill.
- **No neon, no cyberpunk, no sci-fi glow** (constitution §10). The "digital twin" morph (S4)
  uses a *muted technical cyan-green on dark* — desaturated, not glowing.
- Skin/leaf/soil tones stay natural. Slight film grain, not plastic gloss.
- The UI accent (drone-scan cyan `#3FB8B0`) may echo in the twin shot only as a calm marker
  color, never as light bloom.

## 4. Lighting
- Natural, directional, soft. Golden hour (S1/S4/S6), soft morning (S2/S3/S5/S7).
- No hard noon, no studio keys, no colored stage lights.

## 5. Weather & Atmosphere
- Clear to lightly breezy. Occasional mist lifting (S2 dawn) for depth. No storms, no rain
  (unless a future need), no fog walls.

## 6. Composition
- Lead with the **plantation and the machine** in frame together where the shot is about the
  system (S1/S3/S5/S6). Negative space is fine and premium (taste-skill §4.3) — don't fill
  every pixel.
- Horizon / row lines give calm structure. Rule-of-thirds for the drone/robot subjects.

## 7. Realism Level
- **Photoreal, documentary.** Not stylized, not 3D-render look, not anime. Bark, fronds, soil,
  rotor blur must be believable. The robot's climbing mechanism must look like a real
  engineered device (ring-climb around trunk), not a humanoid or pedestal arm.

## 8. Camera Movement (per shot type)
- Hero/orientation (S1/S4/S5): slow push-in or hold; S4 carries a real→twin morph.
- Ambient loop (S2/S6/S7): continuous motion that loops seamlessly (pan completes, orbit
  returns to start).
- Survey (S3): side-track the drone along rows.

## 9. Visual Consistency (the "one film" rule)
- Same time-of-day families (golden / soft-morning) per §06.
- Same color science across all 7 (warm-real, no neon).
- Same drone + robot *design language* (consistent quadcopter; consistent ring-climber).
- Same absence of humans, UI text, HUD, cyberpunk.

## 10. Negative Prompts (mandatory in every clip prompt)
Include variants of:
- no humans, no people, no crowd
- no UI, no HUD, no text, no captions, no overlays, no logos
- no neon, no glow, no cyberpunk, no sci-fi, no laser
- no humanoid robot, no pedestal robot arm, no warehouse, no factory
- no cartoon, no anime, no 3D-render look, no illustration
- no fish-eye distortion, no whip pan, no shaky handheld
- no midnight-blue sterile lab, no pure black background

## 11. Quality Checklist (accept a clip only if)
- [ ] Reads as real plantation footage, not rendered.
- [ ] Drone/robot design is consistent with other clips.
- [ ] Lighting/time-of-day matches the shot's spec (§06).
- [ ] No forbidden elements (§10 negative list) present.
- [ ] Loops seamlessly if ambient (S2/S6/S7); holds/settles if hero/orientation (S1/S4/S5).
- [ ] Color grade matches tropical-dark warm-real, no neon.
- [ ] Resolution/aspect correct (16:9, ≥1080p).
- [ ] Matches the destination page's emotional goal (§05).

## 12. Prompt template (use for every clip)
```
[SUBJECT + ACTION] in [ENVIRONMENT], [CAMERA MOVEMENT] with [LENS],
[LIGHTING] at [TIME/WEATHER]. [MOOD]. Photorealistic documentary, natural film grain,
[COLOR GRADE]. No text, no UI, no humans, no neon, no cyberpunk, no humanoid robot,
no warehouse, no cartoon. Calm, premium, real.
```
Then add shot-specific required/forbidden objects from §06.

---

*This is the last strategy doc. Next step (still planning-only): rewrite `assets/prompts/01–07`
to this spec, keeping filenames, then the user generates clips and drops them in `assets/clips/`.*
