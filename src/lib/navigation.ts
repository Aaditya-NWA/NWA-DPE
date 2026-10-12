import { CRUMB_LABELS } from '../constants/content';
import type { ViewMode } from '../types/product';

export interface Crumb {
  label: string;
  target: ViewMode;
  sectionId?: string;
}

const CATALOGUE_SCREENS = { fleet: CRUMB_LABELS.fleet, specs: CRUMB_LABELS.specs, compare: CRUMB_LABELS.compare, admin: CRUMB_LABELS.admin };

export function buildCrumbs(view: ViewMode, productLabel = '', detailLabel?: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: CRUMB_LABELS.root, target: { screen: 'entry' } }];
  const expos: Crumb = { label: CRUMB_LABELS.expos, target: { screen: 'menu' } };
  const website: Crumb = { label: CRUMB_LABELS.website, target: { screen: 'showcase' } };

  switch (view.screen) {
    case 'menu':
      crumbs.push(expos);
      break;
    case 'assembly':
    case 'in-depth':
    case 'try-rpm': {
      crumbs.push(expos, { label: productLabel, target: { screen: 'assembly', productId: view.productId } });
      if (view.screen === 'assembly') break;
      const sectionId = view.focus.kind === 'section' ? view.focus.sectionId : undefined;
      crumbs.push({
        label: detailLabel ?? CRUMB_LABELS.detail,
        target: { screen: 'in-depth', productId: view.productId, focus: view.focus },
        sectionId,
      });
      if (view.screen === 'try-rpm') crumbs.push({ label: CRUMB_LABELS.rpm, target: view });
      break;
    }
    case 'showcase':
      crumbs.push(website);
      break;
    case 'fly':
      crumbs.push(website, { label: `${productLabel} — Flight`, target: view });
      break;
    case 'fleet':
    case 'specs':
    case 'compare':
    case 'admin':
      crumbs.push(expos, { label: CATALOGUE_SCREENS[view.screen], target: view });
      break;
    default:
      break;
  }
  return crumbs;
}
