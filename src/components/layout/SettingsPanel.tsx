import { theme } from '../../constants/theme';
import { SETTINGS_ROWS } from '../../constants/content';
import { SETTINGS_LIMITS } from '../../constants/system';
import { eyebrowStyle, monoStyle } from '../../styles/primitives';
import { resetSettings, useSettings } from '../../lib/settings';
import type { KioskSettings } from '../../lib/settings';
import { play, shutdown as shutdownAudio } from '../../lib/audio';
import { GhostButton, PrimaryButton } from '../ui/Buttons';
import { RangeInput } from '../ui/Controls';

function Toggle({ checked }: { checked: boolean }) {
  return (
    <span style={{
      position: 'relative', width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 1,
      background: checked ? theme.color.accent : theme.color.surfaceAlt,
      border: `1px solid ${checked ? theme.color.accent : theme.color.border}`,
      transition: 'background 200ms',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? 20 : 2, width: 16, height: 16, borderRadius: '50%',
        background: checked ? theme.color.textOnAccent : theme.color.textMuted, transition: 'left 200ms',
      }} />
    </span>
  );
}

function Row({ label, help, checked, onChange }: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', padding: '14px 0', borderBottom: theme.hairline }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <Toggle checked={checked} />
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: theme.color.text }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, lineHeight: 1.55, color: theme.color.textMuted, marginTop: 4 }}>{help}</span>
      </span>
    </label>
  );
}

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, update] = useSettings();

  const change = (key: (typeof SETTINGS_ROWS)[number]['key'], value: boolean) => {
    update({ [key]: value } as Partial<KioskSettings>);
    if (key !== 'sound') return;
    if (value) play('enter');
    else shutdownAudio();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(1, 6, 16, 0.6)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 92vw)', height: '100%', overflowY: 'auto',
          padding: '28px 28px 30px', display: 'flex', flexDirection: 'column',
          background: theme.color.surface, borderLeft: theme.hairline, boxShadow: theme.shadow.panel,
          animation: 'nw-fade-up 300ms ease both',
        }}
      >
        <div style={eyebrowStyle}>Kiosk settings</div>
        <h2 style={{ margin: '10px 0 8px', fontSize: 26, fontWeight: 700, color: theme.color.text, letterSpacing: '-0.01em' }}>
          Display &amp; <span style={{ color: theme.color.accent }}>accessibility</span>
        </h2>
        <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.6, color: theme.color.textSub }}>
          These apply to this machine and persist across restarts. They are stored in the browser, not on a server.
        </p>

        {SETTINGS_ROWS.map((row) => (
          <Row
            key={row.key}
            label={row.label}
            help={row.help}
            checked={settings[row.key]}
            onChange={(v) => change(row.key, v)}
          />
        ))}

        <div style={{ padding: '16px 0', borderBottom: theme.hairline }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.color.text, marginBottom: 10 }}>
            Idle delay
            <span style={{ ...monoStyle, color: theme.color.accentBright, marginLeft: 10 }}>{settings.idleDemoDelaySec}s</span>
          </div>
          <RangeInput
            min={SETTINGS_LIMITS.idleDelayMin}
            max={SETTINGS_LIMITS.idleDelayMax}
            step={SETTINGS_LIMITS.idleDelayStep}
            value={settings.idleDemoDelaySec}
            disabled={!settings.idleDemo}
            onChange={(v) => update({ idleDemoDelaySec: v })}
            width="100%"
          />
          <div style={{ fontSize: 12, lineHeight: 1.5, color: theme.color.textMuted, marginTop: 6 }}>
            How long the screen waits before starting the tour.
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', gap: 10 }}>
          <PrimaryButton style={{ flex: 1 }} onClick={onClose}>Done</PrimaryButton>
          <GhostButton onClick={() => { resetSettings(); shutdownAudio(); }}>Reset</GhostButton>
        </div>
      </div>
    </div>
  );
}
