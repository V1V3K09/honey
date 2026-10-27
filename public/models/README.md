# Friend 3D Model Guide

Place your friend's 3D model here to replace the default procedural character.

## Expected File Name & Path
`public/models/friend-model.glb` (or `friend-model.gltf`)

## Model Requirements
- **Format:** Binary `.glb` (preferred) or `.gltf` with embedded textures.
- **Orientation:** Upright along the **+Y axis**, facing forward toward **+Z axis**.
- **Pivot:** Ground/feet at approximately `y = 0`.
- **Scale:** Real-world human scale (height approx 1.6m to 1.9m) or normalized height ~2 units. The scene's automatic bounding-box calculator will automatically normalize and center the model regardless of its initial size.
- **Optional Bones/Nodes:** If your model has named nodes or bones (`Head`, `Neck`, `Spine`, `Chest`, `Hips`, `Knees`, `Feet`, `LeftFoot`, etc.), the spatial camera system will automatically bind its anchors to them. If not, the anchor system dynamically computes height-relative positions:
  - **Head/Face:** ~88% of total height
  - **Torso/Chest:** ~62% of total height
  - **Knees:** ~28% of total height
  - **Feet:** ~5% of total height
- **Animations:** If the GLTF contains an embedded animation track (e.g. `Idle`, `Dance`, `Wave`), the loader automatically detects and plays it via Three.js `AnimationMixer`.
