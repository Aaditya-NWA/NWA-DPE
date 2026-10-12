export interface PitchDefinition {
  bladeNodeKeys: string[];
  hubTravelNodeKeys?: string[];
  hubTravel?: number;
  maxAngleDeg?: number;
  derivedFrom?: string;
}

export interface RigDefinition {
  fixedNodeKeys: string[];
  spinningNodeKeys: string[];
  pitch?: PitchDefinition;
}

export type Provenance = 'measured' | 'placeholder';

export interface SpecEntry {
  label: string;
  value: string;
  provenance?: Provenance;
  note?: string;
}

export interface PartMetadata {
  displayName: string;
  description: string;
  specs?: SpecEntry[];
  memberNodeKeys?: string[];
  rig?: RigDefinition;
}

export interface SectionMetadata {
  displayName: string;
  description: string;
  memberNodeKeys: string[];
  derivedFrom?: string;
}

export interface FlightPhase {
  label: string;
  altitudeM: number;
  velocityMs: number;
  thrustN: number;
  dragN: number;
}

export interface FlightEnvelope {
  ceilingM: number;
  maxVelocityMs: number;
  phases: FlightPhase[];
}

export interface WebsiteProfile {
  tagline: string;
  mtowKg: { min: number; max: number };
  keySpecs: SpecEntry[];
  datasheetUrl?: string;
  flight: FlightEnvelope;
}

export interface PhysicalProfile {
  spanM: number;
  spanLabel: string;
  provenance?: Provenance;
  note?: string;
}

export interface ScenarioStep {
  caption: string;
  holdSec: number;
  sectionId?: string;
  explode?: number;
  spin?: boolean;
  autoOrbit?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  summary: string;
  steps: ScenarioStep[];
}

export interface ProductMetadataFile {
  schemaVersion?: 2 | 3 | 4 | 5;
  productId: string;
  productName: string;
  note?: string;
  parts: Record<string, PartMetadata>;
  physical?: PhysicalProfile;
  scenarios?: Scenario[];
  sections?: Record<string, SectionMetadata>;
  website?: WebsiteProfile;
}

export type AirframeSilhouette = 'quad' | 'coaxial-octo' | 'hex' | 'vtol';

export interface ProductConfig {
  id: string;
  label: string;
  glbUrl: string;
  metadataUrl: string;
  kicker: string;
  blurb: string;
  silhouette: AirframeSilhouette;
}

export type DetailFocus =
  | { kind: 'section'; sectionId: string }
  | { kind: 'component'; componentKey: string };

export type ViewMode =
  | { screen: 'entry' }
  | { screen: 'menu' }
  | { screen: 'assembly'; productId: string }
  | { screen: 'in-depth'; productId: string; focus: DetailFocus }
  | { screen: 'try-rpm'; productId: string; focus: DetailFocus; componentKey: string }
  | { screen: 'showcase' }
  | { screen: 'fly'; productId: string }
  | { screen: 'compare'; leftId: string; rightId: string }
  | { screen: 'fleet' }
  | { screen: 'specs' }
  | { screen: 'admin' };

export type ScreenName = ViewMode['screen'];

export type ExplodeMode = 'radial' | 'axial';

export interface RigSpin {
  spinningNodeKeys: string[];
}
