import { Link } from 'react-router-dom';
import Header from '../components/Header';

// ─── Mockup page registry ─────────────────────────────────────────────────────
// Add a new entry here to make a page appear on the start screen.

interface MockupEntry {
  path: string;
  title: string;
  description: string;
  icon: string;
  status: 'ready' | 'wip' | 'planned';
}

const MOCKUPS: MockupEntry[] = [
  {
    path: '/map',
    title: 'Objektwesen v1 Mockup',
    description:
      'Interaktive Karte mit WMS-Katasterebene und WFS-Vektordaten. Parzellen anklicken für Attributinformationen.',
    icon: '🗺️',
    status: 'ready',
  },
  {
    path: '/mapv2',
    title: 'Objektwesen v2 Mockup',
    description:
      'Kopie des Parzellenviewers als Ausgangsbasis für neue Features.',
    icon: '🗺️',
    status: 'wip',
  },
];

const STATUS_BADGE: Record<MockupEntry['status'], { label: string; bg: string; color: string }> = {
  ready:   { label: 'Bereit',    bg: '#d4edda', color: '#155724' },
  wip:     { label: 'In Arbeit', bg: '#fff3cd', color: '#856404' },
  planned: { label: 'Geplant',   bg: '#e2e3e5', color: '#383d41' },
};

// ─── Card ────────────────────────────────────────────────────────────────────

function MockupCard({ entry }: { entry: MockupEntry }) {
  const badge = STATUS_BADGE[entry.status];
  const isClickable = entry.status !== 'planned';

  const card = (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.09)',
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: isClickable ? 'pointer' : 'default',
        opacity: entry.status === 'planned' ? 0.6 : 1,
        transition: 'box-shadow 0.15s, transform 0.15s',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid #e8e8e8',
      }}
      onMouseEnter={e => {
        if (isClickable) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.14)';
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.09)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div style={{ fontSize: 40, lineHeight: 1 }}>{entry.icon}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 17, color: '#1a1a1a' }}>{entry.title}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
          background: badge.bg, color: badge.color,
        }}>
          {badge.label}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>
        {entry.description}
      </p>

      {isClickable && (
        <div style={{ marginTop: 4, fontSize: 13, color: '#3388ff', fontWeight: 600 }}>
          Öffnen →
        </div>
      )}
    </div>
  );

  if (!isClickable) return card;

  return <Link to={entry.path} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link>;
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f6f8',

      boxSizing: 'border-box',
    }}>
      <Header />
      <div style={{ padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ maxWidth: 800, margin: '0 auto 48px' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 30, fontWeight: 800, color: '#1a1a1a' }}>
          Objektwesen PoC
        </h1>
        <p style={{ margin: 0, fontSize: 16, color: '#666' }}>
          Wähle einen Prototyp aus, um ihn zu öffnen.
        </p>
      </div>

      {/* Grid */}
      <div style={{
        maxWidth: 800,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 20,
      }}>
        {MOCKUPS.map(m => <MockupCard key={m.path} entry={m} />)}
      </div>
      </div>
    </div>
  );
}
