import { Link } from 'react-router-dom';

/** Shared back-button shown in every mockup page header. */
export default function BackButton() {
  return (
    <Link
      to="/"
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 2000,
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        padding: '8px 14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        color: '#1a1a1a',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      ← Startseite
    </Link>
  );
}
