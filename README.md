# NWA DPE — Digital Product Experience

Interactive 3D product experience for Nautical Wings Aerospace. One engine, two ways in:

- **Expos** — a touch-kiosk teardown: section-first selection, isolation, exploded views (radial / layered), x-ray, part labels, RPM control, variable blade pitch, guided and idle tours, scale reference, capture, gestures and hardware control-panel support. Plus fleet line-up, specification matrix, side-by-side compare and an in-kiosk content editor.
- **Website** — the AXOM range on turntables with an MTOW-matched recommendation, and a flyable performance envelope. Climbing past **3,000 m** raises a sign-in popup.

## Run

```
npm install
npm run dev      # http://localhost:5174
npm run build
npm run lint
```

Node 20+ recommended. Everything runs offline — models, metadata, images and the Inter font are local.

## Controls

| Where | Control |
|---|---|
| 3D viewport | Drag to orbit (stays upright), wheel/pinch to zoom, PAN toggles one-finger pan, RESET VIEW re-frames |
| Assembly | Tap a part → section panel → Detailed View; SECTIONS list searches and jumps; ASSEMBLED/EXPLODED; TOUR; SPIN PROPS |
| Detailed View | Explode slider + radial/layered, x-ray, RPM CONTROL where a rig exists |
| Fly | Arrow keys or on-screen arrows: ↑↓ climb/descend, →← accelerate/brake |
| Header | Breadcrumbs, full screen, kiosk settings (reduced motion, high-contrast highlight, sounds, studio backdrop, part labels, idle tour + delay) |
| Gamepad | A detail · B back · X spin · Y tour · shoulders/d-pad step sections · right stick = RPM / x-ray dial |

The sign-in is a **local demonstration** — any valid-looking email with an 8-character password works; nothing is sent anywhere.

## Adding a product

1. `public/models/<id>.glb` and `public/metadata/<id>.json`.
2. One row in `src/constants/products.ts`.
3. Author metadata against runtime keys: `node cad-pipeline/inspect_glb_nodes.mjs public/models/<id>.glb`.

Metadata blocks switch features on by presence: `sections`, `rig`, `rig.pitch`, `website`, `physical`, `scenarios`.

## CAD pipeline

`cad-pipeline/` is a separate npm project (`cd cad-pipeline && npm install`) for conversion and verification:

```
node cad-pipeline/step_to_glb.js in.stp out.glb
node cad-pipeline/inspect_glb_nodes.mjs <glb>
node cad-pipeline/analyze_blade_separability.mjs [glb] [meta.json]
node cad-pipeline/generate_axom_sections.mjs [--emit|--write]
node cad-pipeline/generate_vtol_sections.mjs [--emit]
node cad-pipeline/generate_physical_profiles.mjs [--write]
node cad-pipeline/verify_sections_integrity.mjs [glb] [meta.json]
node cad-pipeline/verify_blade_pitch_rigid.mjs --self-test
node cad-pipeline/verify_metadata_v5.mjs [--self-test]
```

Run the matching `verify_*` gate after editing `sections`, `rig.pitch` or `specs/physical/scenarios`.

