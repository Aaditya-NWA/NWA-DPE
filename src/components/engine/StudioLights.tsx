import { LIGHT_POSITIONS, LIGHT_RIGS } from '../../constants/viewer';

// One light rig for every canvas. Light ground fights for silhouette; dark ground fights for form.
export default function StudioLights({ mode = 'light' }: { mode?: 'light' | 'studio' }) {
  const rig = LIGHT_RIGS[mode];
  return (
    <>
      <hemisphereLight args={rig.hemisphere} />
      <directionalLight position={LIGHT_POSITIONS.key} intensity={rig.key} />
      <directionalLight position={LIGHT_POSITIONS.fill} intensity={rig.fill} />
      <directionalLight position={LIGHT_POSITIONS.rim} intensity={rig.rim} />
    </>
  );
}
