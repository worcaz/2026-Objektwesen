import type { ReactNode } from 'react';
import { LuFileText, LuLayers3 } from 'react-icons/lu';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

interface MockupEntry {
  path: string;
  title: string;
  description: string;
  icon: ReactNode;
  status: 'ready' | 'wip' | 'planned';
}

const MOCKUPS: MockupEntry[] = [
  {
    path: '/map',
    title: 'First Draft v0.1',
    description: 'Grundlagender Mockup mit Leaflet-Karte, Klick-Interaktion und Popup. Noch ohne WMS/WFS.',
        icon: <LuFileText size={28} strokeWidth={1.9} />,
    status: 'wip',
  },
  {
    path: '/mapv2',
    title: 'Objektwesen v0.2 Mockup',
    description:
      'Interaktive UX-Mockup mit Leaflet, inklusive Karteninteraktion, Seitenpanel und responsivem Layout.',
icon: <LuLayers3 size={28} strokeWidth={1.9} />,
    status: 'ready',
  },
];

const STATUS_BADGE: Record<MockupEntry['status'], { label: string; bg: string; color: string }> = {
  ready: { label: 'Bereit', bg: '#d4edda', color: '#155724' },
  wip: { label: 'In Arbeit', bg: '#fff3cd', color: '#856404' },
  planned: { label: 'Geplant', bg: '#e2e3e5', color: '#383d41' },
};

function MockupCard({ entry }: { entry: MockupEntry }) {
  const badge = STATUS_BADGE[entry.status];
  const isClickable = entry.status !== 'planned';

  const card = (
    <div
      style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(0,0,0,0.09)',
        padding: 'clamp(18px, 4vw, 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: 'clamp(200px, 30vw, 240px)',
        height: '100%',
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
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f6f9',
          color: '#1a1a1a',
          lineHeight: 1,
        }}
      >
        {entry.icon}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 'clamp(16px, 3vw, 18px)', color: '#1a1a1a' }}>{entry.title}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 20,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6, flexGrow: 1 }}>
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

  return (
    <Link to={entry.path} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      {card}
    </Link>
  );
}

export default function HomePage() {
  return (
    <div style={{ minHeight: '100dvh', background: '#f5f6f8' }}>
      <Header />

      <div style={{ padding: 'clamp(20px, 4vw, 40px) clamp(12px, 4vw, 24px)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto clamp(24px, 5vw, 48px)' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(24px, 5vw, 30px)', fontWeight: 800, color: '#1a1a1a' }}>
            Objektwesen PoC
          </h1>
          <p style={{ margin: 0, fontSize: 'clamp(14px, 3vw, 16px)', color: '#666', lineHeight: 1.55 }}>
            Wähle einen Prototyp aus, um ihn zu öffnen.
          </p>
        </div>

        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 3vw, 24px)',
            alignItems: 'stretch',
          }}
        >
          {MOCKUPS.map((mockup) => <MockupCard key={mockup.path} entry={mockup} />)}
        </div>
      </div>
    </div>
  );
}
