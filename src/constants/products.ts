import type { ProductConfig, ScreenName } from '../types/product';

export const SECTION_KEY_PREFIX = 'section:';

export const PRODUCTS: ProductConfig[] = [
  {
    id: 'axom_q4',
    label: 'AXOM Q4',
    glbUrl: '/models/axom_q4.glb',
    metadataUrl: '/metadata/axom_q4.json',
    kicker: 'QUADROTOR · 76 SOLIDS',
    blurb: 'Compact four-rotor airframe. Truss arms, four rotor assemblies and a full avionics stack.',
    silhouette: 'quad',
  },
  {
    id: 'axom_x8',
    label: 'AXOM X8',
    glbUrl: '/models/axom_x8.glb',
    metadataUrl: '/metadata/axom_x8.json',
    kicker: 'COAXIAL OCTOROTOR · 213 SOLIDS',
    blurb: 'Four arms, eight rotors. Each arm carries a counter-rotating coaxial pair for rotor-out redundancy.',
    silhouette: 'coaxial-octo',
  },
  {
    id: 'axom_h6',
    label: 'AXOM H6',
    glbUrl: '/models/axom_h6.glb',
    metadataUrl: '/metadata/axom_h6.json',
    kicker: 'HEXAROTOR · 55 SOLIDS',
    blurb: 'Large six-rotor surveillance platform with an underslung camera gimbal and tall landing gear.',
    silhouette: 'hex',
  },
  {
    id: 'vtol',
    label: 'VTOL UAV',
    glbUrl: '/models/vtol_airframe.glb',
    metadataUrl: '/metadata/vtol.json',
    kicker: 'FIXED-WING VTOL · 409 SOLIDS',
    blurb: 'The production-scale reference airframe: 14 sections, five rotors and the one rig with variable blade pitch.',
    silhouette: 'vtol',
  },
];

export const SCREEN_DEPTH: Record<ScreenName, number> = {
  entry: 0,
  menu: 1,
  showcase: 1,
  fleet: 2,
  specs: 2,
  admin: 2,
  compare: 2,
  assembly: 2,
  fly: 2,
  'in-depth': 3,
  'try-rpm': 4,
};

export const PAGE_SCREENS: ReadonlySet<ScreenName> = new Set<ScreenName>([
  'entry', 'menu', 'showcase', 'compare', 'fleet', 'specs', 'admin',
]);
