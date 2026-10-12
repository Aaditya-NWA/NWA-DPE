export function FullscreenGlyph({ exiting }: { exiting: boolean }) {
  const d = exiting
    ? 'M9 3v6H3 M15 3v6h6 M15 21v-6h6 M9 21v-6H3'
    : 'M3 9V3h6 M21 9V3h-6 M21 15v6h-6 M3 15v6h6';
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d={d} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeGlyph({ open }: { open: boolean }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
      <path d="M2 2l13 13M7.2 7.3A2.4 2.4 0 0010.8 10M4.3 4.5C2.7 5.7 1 8.5 1 8.5s2.7 4.8 7.5 4.8a8 8 0 003.3-.7M6.7 2.8A8.4 8.4 0 0116 8.5s-.8 1.6-2.3 2.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden>
      <path d="M1 8.5s2.7-4.8 7.5-4.8 7.5 4.8 7.5 4.8-2.7 4.8-7.5 4.8S1 8.5 1 8.5z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8.5" cy="8.5" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'nw-spin 0.8s linear infinite' }} aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="rgba(2,8,20,0.3)" strokeWidth="2" />
      <path d="M8 2a6 6 0 016 6" stroke="#020814" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
