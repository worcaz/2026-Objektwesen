import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuHouse, LuLayers3, LuX } from 'react-icons/lu';

const HEADER_BG = 'rgba(0, 159, 227, 0.9)';
const AGOV_ACCESS_APP_ICON_URL = '/icons_agov.svg';
export const AUTH_STORAGE_KEY = 'objektwesen-demo-user';
export const AUTH_EVENT_NAME = 'objektwesen-auth-changed';
export const AUTH_OPEN_LOGIN_EVENT = 'objektwesen-open-login';

const NAV_ITEMS = [
  { path: '/', label: 'Startseite', icon: <LuHouse size={15} /> },
  { path: '/mapv2', label: 'Objektwesen v2 Mockup', icon: <LuLayers3 size={15} /> },
];

function DummyQrCode({ size = 196 }: { size?: number }) {
  const gridSize = 33;
  const cell = 3;
  const padding = 9;
  const viewSize = gridSize * cell + padding * 2;
  const finderStarts = [
    [0, 0],
    [gridSize - 7, 0],
    [0, gridSize - 7],
  ] as const;

  const isInsideFinder = (x: number, y: number) =>
    finderStarts.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  const filled = new Set<string>();
  const addCell = (x: number, y: number) => filled.add(`${x}-${y}`);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (isInsideFinder(x, y)) continue;

      if (x === 6 || y === 6) {
        if ((x + y) % 2 === 0) addCell(x, y);
        continue;
      }

      const inAlignmentZone = x >= 22 && x <= 26 && y >= 22 && y <= 26;
      if (inAlignmentZone) {
        const dx = Math.abs(x - 24);
        const dy = Math.abs(y - 24);
        if (Math.max(dx, dy) === 2 || (dx === 0 && dy === 0)) addCell(x, y);
        continue;
      }

      const densePattern = ((x * 17 + y * 11 + (x ^ y) + x * y) % 7) < 3;
      const accentPattern = ((x + 2) * (y + 3)) % 11 === 0 || (x * 5 + y * 3) % 13 === 0;
      if (densePattern || accentPattern) addCell(x, y);
    }
  }

  const renderFinder = (x: number, y: number) => (
    <g key={`finder-${x}-${y}`}>
      <rect x={padding + x * cell} y={padding + y * cell} width={7 * cell} height={7 * cell} fill="#050505" />
      <rect x={padding + (x + 1) * cell} y={padding + (y + 1) * cell} width={5 * cell} height={5 * cell} fill="#fff" />
      <rect x={padding + (x + 2) * cell} y={padding + (y + 2) * cell} width={3 * cell} height={3 * cell} fill="#050505" />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', maxWidth: size, height: 'auto' }}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={viewSize} height={viewSize} fill="#fff" />
      {finderStarts.map(([x, y]) => renderFinder(x, y))}
      {Array.from(filled).map((key) => {
        const [x, y] = key.split('-').map(Number);
        return <rect key={key} x={padding + x * cell} y={padding + y * cell} width={cell} height={cell} fill="#050505" />;
      })}
    </svg>
  );
}

function AgovAccessCardIcon() {
  return (
    <img
      src={AGOV_ACCESS_APP_ICON_URL}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', width: 'clamp(48px, 14vw, 64px)', height: 'auto', aspectRatio: '1 / 1', maxWidth: '100%' }}
    />
  );
}

function RegistrationPanel() {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fbfcfd',
        padding: 'clamp(14px, 4vw, 18px)',
        display: 'grid',
        gap: 12,
        alignContent: 'start',
        minWidth: 0,
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(0,159,227,1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          Registrierung
        </div>
        <div style={{ fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
          Haben Sie noch kein AGOV-Konto?
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#5f6b7a', lineHeight: 1.5 }}>
          Registrieren Sie sich für diesen Demo-Prozess mit einem Dummy-Button ohne weitere Funktion.
        </p>
      </div>

      <button
        type="button"
        style={{
          width: '100%',
          border: '1px solid rgba(0, 159, 227, 0.22)',
          borderRadius: 10,
          background: '#eef8fd',
          color: 'rgba(0,159,227,1)',
          fontWeight: 700,
          padding: '11px 14px',
          cursor: 'pointer',
        }}
      >
        Registrieren
      </button>
    </div>
  );
}

type BotAvatarVariant = {
  shell: string;
  panel: string;
  accent: string;
  eye: 'dots' | 'visor' | 'cross';
  mouth: 'line' | 'grille' | 'smile';
};

const BOT_AVATAR_VARIANTS: BotAvatarVariant[] = [
  { shell: '#FFB300', panel: '#FFE082', accent: '#2A3544', eye: 'dots', mouth: 'grille' },
  { shell: '#E53935', panel: '#FF8A80', accent: '#1F2A37', eye: 'visor', mouth: 'line' },
  { shell: '#D81B60', panel: '#F48FB1', accent: '#2A223D', eye: 'cross', mouth: 'line' },
  { shell: '#C0CA33', panel: '#E6EE9C', accent: '#32411B', eye: 'dots', mouth: 'smile' },
  { shell: '#5E35B1', panel: '#B39DDB', accent: '#1F1B4B', eye: 'visor', mouth: 'grille' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function BotAvatar({ seed, size = 22 }: { seed: string; size?: number }) {
  const variant = BOT_AVATAR_VARIANTS[hashString(seed) % BOT_AVATAR_VARIANTS.length];

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="20" cy="20" r="20" fill="#ffffff" opacity="0.12" />
      <path d="M20 5.5v5.5" stroke={variant.accent} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="4.5" r="2.5" fill={variant.panel} stroke={variant.accent} strokeWidth="1" />
      <rect x="8" y="10" width="24" height="21" rx="8" fill={variant.shell} stroke={variant.accent} strokeWidth="1.5" />
      <rect x="11" y="13" width="18" height="10" rx="5" fill={variant.accent} opacity="0.92" />
      {variant.eye === 'dots' && (
        <>
          <circle cx="17" cy="18" r="2" fill="#F8FAFC" />
          <circle cx="23" cy="18" r="2" fill="#F8FAFC" />
        </>
      )}
      {variant.eye === 'visor' && <rect x="15" y="16.5" width="10" height="3" rx="1.5" fill="#7DD3FC" />}
      {variant.eye === 'cross' && (
        <>
          <path d="M15.5 16l3 3M18.5 16l-3 3" stroke="#F8FAFC" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M21.5 16l3 3M24.5 16l-3 3" stroke="#F8FAFC" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {variant.mouth === 'line' && <rect x="15" y="25" width="10" height="2.4" rx="1.2" fill={variant.accent} opacity="0.75" />}
      {variant.mouth === 'smile' && <path d="M15.5 24.5c1.2 2 7.8 2 9 0" stroke={variant.accent} strokeWidth="1.8" strokeLinecap="round" />}
      {variant.mouth === 'grille' && (
        <>
          <rect x="14" y="24" width="12" height="4" rx="1.5" fill="#fff" opacity="0.85" />
          <path d="M17 24v4M20 24v4M23 24v4" stroke={variant.accent} strokeWidth="1" opacity="0.55" />
        </>
      )}
    </svg>
  );
}

export default function Header({ onAccountMenuOpen }: { onAccountMenuOpen?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      setAuthUser(savedUser);
      setUsername(savedUser);
    }
  }, []);

  useEffect(() => {
    if ((!loginOpen && !accountMenuOpen) || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLoginOpen(false);
        setAccountMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginOpen, accountMenuOpen]);

  const openLoginModal = () => {
    onAccountMenuOpen?.();
    setLoginOpen(true);
    setOpen(false);
    setAccountMenuOpen(false);
    setError('');
    setPassword('');

    if (authUser) setUsername(authUser);
  };

  const handleAccountButtonClick = () => {
    setOpen(false);

    if (authUser) {
      setAccountMenuOpen((current) => {
        const next = !current;
        if (next) onAccountMenuOpen?.();
        return next;
      });
      return;
    }

    openLoginModal();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOpenLogin = () => {
      if (!window.localStorage.getItem(AUTH_STORAGE_KEY)) {
        openLoginModal();
      }
    };

    window.addEventListener(AUTH_OPEN_LOGIN_EVENT, onOpenLogin);
    return () => window.removeEventListener(AUTH_OPEN_LOGIN_EVENT, onOpenLogin);
  }, [authUser]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanUser = username.trim();
    if (!cleanUser || !password.trim()) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, cleanUser);
      window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail: cleanUser }));
    }

    setAuthUser(cleanUser);
    setError('');
    setPassword('');
    setLoginOpen(false);
    setAccountMenuOpen(false);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent(AUTH_EVENT_NAME, { detail: null }));
    }

    setAuthUser(null);
    setUsername('');
    setPassword('');
    setError('');
    setLoginOpen(false);
    setAccountMenuOpen(false);
  };

  return (
    <>
      <header
        style={{
          height: 37,
          minHeight: 37,
          flexShrink: 0,
          background: HEADER_BG,
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(12px, 4vw, 20px)',
          gap: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          zIndex: 2000,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setAccountMenuOpen(false);
          }}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            flexShrink: 0,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ display: 'block', width: 22, height: 2, background: '#fff', borderRadius: 2 }}
            />
          ))}
        </button>

        <Link to="/" style={{ display: 'flex', alignItems: 'center', lineHeight: 0, minWidth: 0, gap: 10 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 482.3 144.06" style={{ display: 'block', width: 'clamp(54px, 14vw, 70px)', height: 'auto', flexShrink: 0 }}>
            <defs><style>{`.hl{fill:#fff;}`}</style></defs>
            <path className="hl" d="m179.3,131.44h-23.36v-51.56h-14.21v63.08h37.57v-11.52h0Zm32.4,12.62h.27c17.56-.05,26.34-9.52,26.34-28.42v-35.76h-14.21v37.13c0,9.85-3.92,14.78-11.75,14.78s-11.97-5.1-11.97-15.31v-36.6h-14.25v36.42c0,18.46,8.52,27.71,25.56,27.76h0Zm270.6-1.1v-63.08h-13.37v34.88c0,4.31.12,7.2.35,8.67h-.18c-.97-1.7-2.02-3.42-3.17-5.15l-25.03-38.4h-15.31v63.08h13.42v-34.66c0-4.57-.12-7.98-.35-10.21h.18c.59,1.17,1.64,2.92,3.17,5.23l26,39.64h14.3Zm-182.96-11.52h-31.72l31.63-43.59v-7.96h-48.39v11.57h30l-32.33,43.33v8.18h50.81v-11.52h0Zm50.61,0h-23.62v-14.43h20.63v-11.53h-20.63v-14.03h22.17v-11.57h-36.38v63.08h37.83v-11.52h0Zm55.62-7.13c-.62-.97-1.3-1.96-2.05-2.97-.75-1.01-1.53-1.96-2.35-2.84-.82-.88-1.67-1.65-2.55-2.31-.88-.66-1.79-1.14-2.73-1.43v-.18c2.14-.62,4.08-1.47,5.83-2.55,1.74-1.08,3.23-2.37,4.47-3.87,1.23-1.5,2.18-3.17,2.86-5.04.67-1.86,1.01-3.89,1.01-6.09,0-11.44-7.65-17.16-22.96-17.16h-22.52v63.08h14.21v-24.15h3.83c.88,0,1.69.18,2.44.55.75.37,1.47.89,2.16,1.58.69.69,1.37,1.52,2.05,2.49.67.97,1.38,2.07,2.11,3.3l9.81,16.23h16.32l-11.92-18.65h0Zm-20.37-33.78c6.6,0,9.9,2.76,9.9,8.27,0,2.64-.94,4.85-2.81,6.64-1.85,1.76-4.3,2.64-7.35,2.64h-6.16v-17.55h6.42Z" />
            <path className="hl" d="m156.69,31.32L183.74,1.06h-9.19l-23.58,27.49c-.7.79-1.26,1.51-1.67,2.15h-.18V1.06h-7.39v63.08h7.39v-31.06h.18c.2.38.76,1.12,1.67,2.2l24.37,28.86h10.29l-28.94-32.82h0Zm325.61,32.82V1.06h-7.35v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L441.08,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.02ZM390.26,0h-.42c-9.34.05-16.73,3.07-22.17,9.06-5.48,6.04-8.23,14.14-8.23,24.28,0,9.44,2.69,17.11,8.07,23.01,5.38,5.89,12.54,8.84,21.49,8.84s16.45-2.99,21.91-8.97c5.46-5.98,8.18-14.12,8.18-24.41,0-9.47-2.66-17.14-7.98-23.01-5.28-5.82-12.23-8.75-20.85-8.8h0Zm-170.66,1.06h-7.65l-24.2,63.08h8.23l6.29-17.68h26.75l6.68,17.68h8.18L219.59,1.06h0Zm-14.87,38.75l9.81-26.88c.38-1.03.72-2.43,1.01-4.22h.18c.32,1.94.64,3.34.97,4.22l9.9,26.88h-21.86ZM304.01,1.06h-7.39v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L262.75,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.06V1.06h0Zm53.04,0h-43.77v6.69h18.17v56.39h7.39V7.74h18.21V1.06h0Zm48.48,12.45c3.87,4.55,5.81,10.98,5.81,19.31s-2,14.44-5.98,18.96c-3.99,4.52-9.44,6.77-16.36,6.77-6.48,0-11.74-2.37-15.77-7.1-4.03-4.74-6.05-10.99-6.05-18.76s2.07-14.05,6.2-18.83c4.13-4.78,9.52-7.17,16.14-7.17s12.14,2.27,16.01,6.82h0Z" />
            <polygon className="hl" points="0 142.83 70.87 142.83 70.87 1.1 0 1.1 0 142.83 0 142.83" />
          </svg>
          <span style={{ color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18, fontWeight: 600, letterSpacing: 0.01, whiteSpace: 'nowrap' }}>
            Objektwesen
          </span>
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={handleAccountButtonClick}
              aria-label={authUser ? 'Benutzermenü öffnen' : 'Anmelden öffnen'}
              aria-expanded={authUser ? accountMenuOpen : undefined}
              title={authUser ? 'Konto' : 'Anmelden'}
              style={{
                border: 'none',
                background: authUser ? '#fff' : 'rgb(255, 255, 255)',
                color: '#0a2b72',
                borderRadius: authUser ? 999 : 5,
                padding: authUser ? 1 : '3px clamp(10px, 3vw, 20px)',
                width: authUser ? 28 : 'auto',
                height: authUser ? 28 : 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 700,
              }}
            >
              {authUser ? (
                <BotAvatar seed={authUser} size={26} />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500 }}>Anmelden</span>
              )}
            </button>

            {authUser && accountMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: 190,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 14px 28px rgba(0,0,0,0.18)',
                  padding: 6,
                  zIndex: 2001,
                }}
              >
                <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid #eef2f6', marginBottom: 6, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 14, color: '#5d6b82', wordBreak: 'break-word', lineHeight: 1.45 }}>
                    Hallo <strong style={{ color: '#1a1a1a' }}>{authUser}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5d6b82', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    aria-label="Account-Fenster schliessen"
                  >
                    <LuX size={18} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#1f2937',
                    fontWeight: 600,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {(open || accountMenuOpen) && (
        <div
          onClick={() => {
            setOpen(false);
            setAccountMenuOpen(false);
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 1998 }}
        />
      )}

      <nav
        style={{
          position: 'fixed',
          top: 37,
          left: 0,
          width: 'min(260px, calc(100vw - 24px))',
          maxHeight: 'calc(100dvh - 52px)',
          overflowY: 'auto',
          background: '#fff',
          boxShadow: '0 10px 18px rgba(0,0,0,0.15)',
          zIndex: 1999,
          paddingTop: 8,
          paddingBottom: 8,
          fontFamily: 'Inter, system-ui, sans-serif',
          transform: open ? 'translateY(0)' : 'translateY(calc(-100% - 37px))',
          transformOrigin: 'top left',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.22s ease, opacity 0.22s ease',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                textDecoration: 'none',
                color: active ? 'rgba(0,159,227,1)' : '#1a1a1a',
                fontWeight: active ? 700 : 400,
                background: active ? 'rgba(0,159,227,0.08)' : 'transparent',
                fontSize: 14,
                borderLeft: active ? '3px solid rgba(0,159,227,1)' : '3px solid transparent',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {loginOpen && (
        <>
          <div
            onClick={() => setLoginOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2998 }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dummy-login-title"
            style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 'clamp(8px, 2vw, 16px)', zIndex: 2999 }}
          >
            <div
              style={{
                width: 'min(680px, 100%)',
                maxHeight: 'calc(100dvh - 16px)',
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 'clamp(12px, 3vw, 16px)',
                boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
                padding: 'clamp(14px, 3.5vw, 22px)',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <h2 id="dummy-login-title" style={{ margin: 0, fontSize: 'clamp(18px, 4vw, 20px)', fontWeight: 800, color: '#1a1a1a' }}>
                    Anmelden
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                    Melden Sie sich via AGOV access App oder mit den Demo-Zugangsdaten an.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  aria-label="Modal schließen"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#666', padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 'clamp(12px, 3vw, 18px)' }}>
                <div style={{ display: 'grid', gap: 'clamp(12px, 3vw, 16px)', minWidth: 0 }}>
                  {!authUser && (
                    <>
                      <div
                        style={{
                          padding: 'clamp(14px, 4vw, 18px)',
                          borderRadius: 'clamp(18px, 5vw, 28px)',
                          background: '#f3f3f5',
                          border: '1px solid #ecebf2',
                          display: 'grid',
                          gap: 16,
                          minWidth: 0,
                        }}
                      >
                        <div style={{ fontSize: 'clamp(20px, 5vw, 24px)', fontWeight: 800, color: '#26236d', lineHeight: 1.15, maxWidth: '100%' }}>
                          Login mit AGOV access App
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', paddingInline: 4 }}>
                          <DummyQrCode size={176} />
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            gap: 14,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            padding: '12px 14px',
                            borderRadius: 18,
                            background: '#ded7ec',
                          }}
                        >
                          <AgovAccessCardIcon />
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#26236d', lineHeight: 1.28, flex: '1 1 180px' }}>
                            Melden Sie sich an, indem Sie den QR-Code mit Ihrer AGOV access App scannen
                          </div>
                        </div>
                      </div>

                      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '2px 0 0' }} />
                    </>
                  )}

                  <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12, minWidth: 0 }}>
                      <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#333' }}>
                        Benutzername
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="z. B. demo.user"
                          style={{
                            border: '1px solid #d0d7de',
                            borderRadius: 10,
                            padding: '10px 12px',
                            fontSize: 14,
                          }}
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 6, fontSize: 13, color: '#333' }}>
                        Passwort
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="beliebiges Passwort"
                          style={{
                            border: '1px solid #d0d7de',
                            borderRadius: 10,
                            padding: '10px 12px',
                            fontSize: 14,
                          }}
                        />
                      </label>

                      {error && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#c0392b',
                            background: '#fff3f3',
                            border: '1px solid #f5c5c5',
                            borderRadius: 8,
                            padding: '8px 10px',
                          }}
                        >
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        style={{
                          border: 'none',
                          borderRadius: 10,
                          background: 'rgba(0, 159, 227, 1)',
                          color: '#fff',
                          fontWeight: 700,
                          padding: '11px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        Einloggen
                      </button>
                    </form>
                </div>

                <RegistrationPanel />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
