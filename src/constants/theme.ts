export const theme = {
  color: {
    page: '#020814',
    pageDeep: '#010610',
    surface: '#0a1628',
    surfaceAlt: '#0d1f38',
    card: '#0f172a',
    cardHover: '#111f35',
    sunken: '#060f1e',
    glass: 'rgba(10, 22, 40, 0.9)',
    header: 'rgba(2, 8, 20, 0.88)',
    border: '#1e293b',
    borderSub: '#142032',

    accent: '#59a2b8',
    accentBright: '#7ec8d8',
    accentGlow: 'rgba(89, 162, 184, 0.12)',
    accentLine: 'rgba(89, 162, 184, 0.3)',
    accentSoft: 'rgba(89, 162, 184, 0.2)',
    blue: '#2c88d9',

    text: '#f5f5f5',
    textSub: '#b8c9d4',
    textMuted: '#7584b3',
    textDim: '#3d4a73',
    textOnAccent: '#020814',

    amber: '#f0a500',
    danger: '#ef4444',
    dangerGlow: 'rgba(239, 68, 68, 0.08)',

    measured: '#34d399',
    measuredBg: 'rgba(52, 211, 153, 0.1)',
    placeholder: '#f0a500',
    placeholderBg: 'rgba(240, 165, 0, 0.1)',

    viewport: '#f3f6f9',
    viewportBorder: '#1e293b',
  },
  studio: {
    viewport: '#07101d',
    vignette: 'radial-gradient(112% 82% at 50% 40%, rgba(89,162,184,0.07) 0%, rgba(0,0,0,0) 48%, rgba(1,6,16,0.55) 100%)',
  },
  labels: {
    studio: {
      bg: 'rgba(10, 22, 40, 0.94)',
      border: '#1e293b',
      text: '#f5f5f5',
      accent: '#7ec8d8',
      leader: 'rgba(184, 201, 212, 0.45)',
      dotHalo: 'rgba(2, 8, 20, 0.7)',
      shadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
    },
    light: {
      bg: 'rgba(10, 22, 40, 0.92)',
      border: '#1e293b',
      text: '#f5f5f5',
      accent: '#59a2b8',
      leader: 'rgba(10, 22, 40, 0.5)',
      dotHalo: 'rgba(255, 255, 255, 0.9)',
      shadow: '0 6px 16px rgba(2, 8, 20, 0.25)',
    },
  },
  highlight: {
    default: [0.15, 0.45, 0.9] as const,
    colorblindSafe: [0.95, 0.45, 0.05] as const,
  },
  gradient: {
    brand: 'linear-gradient(135deg, #59a2b8 0%, #2c88d9 100%)',
    page: 'radial-gradient(900px 520px at 85% -10%, rgba(89,162,184,0.08) 0%, transparent 70%), radial-gradient(700px 420px at 10% 110%, rgba(44,136,217,0.06) 0%, transparent 70%), #020814',
    dotGrid: 'radial-gradient(circle, rgba(89,162,184,0.06) 1px, transparent 1px)',
    glowTeal: 'radial-gradient(circle, rgba(89,162,184,0.08) 0%, transparent 70%)',
    glowBlue: 'radial-gradient(circle, rgba(44,136,217,0.06) 0%, transparent 70%)',
    cardStage: 'radial-gradient(ellipse 70% 60% at 50% 55%, rgba(89,162,184,0.1) 0%, transparent 70%), #0a1628',
  },
  shadow: {
    panel: '0 20px 60px rgba(0, 0, 0, 0.5)',
    card: '0 12px 40px rgba(0, 0, 0, 0.4)',
    lifted: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(89, 162, 184, 0.12)',
    accent: '0 8px 24px rgba(89, 162, 184, 0.25)',
  },
  font: {
    ui: '"Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif',
    mono: 'ui-monospace, "Cascadia Mono", "SF Mono", "Roboto Mono", Menlo, monospace',
  },
  hairline: '1px solid #1e293b',
  radius: { sm: 8, md: 10, lg: 14, xl: 16, pill: 20 },
  dotGridSize: '28px 28px',
  blur: 'blur(18px)',
  touchTarget: 44,
  headerHeight: 72,
} as const;

export interface LabelPalette {
  bg: string;
  border: string;
  text: string;
  accent: string;
  leader: string;
  dotHalo: string;
  shadow: string;
}
