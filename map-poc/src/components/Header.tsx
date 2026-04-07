import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuHouse, LuCircleUserRound, LuLogOut, LuUserCheck } from 'react-icons/lu';

const HEADER_BG = 'rgba(0, 159, 227, 0.9)';
const STORAGE_KEY = 'objektwesen-demo-user';

const NAV_ITEMS = [
  { path: '/', label: 'Startseite', icon: <LuHouse size={15} /> },
  { path: '/map', label: 'Parzellenviewer v1', icon: '🗺️' },
  { path: '/mapv2', label: 'Objektwesen v2 Mockup', icon: '🗺️' },
  { path: '/list', label: 'Parzellenliste', icon: '📋' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUser = window.localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      setAuthUser(savedUser);
      setUsername(savedUser);
    }
  }, []);

  useEffect(() => {
    if (!loginOpen || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLoginOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loginOpen]);

  const openLoginModal = () => {
    setLoginOpen(true);
    setOpen(false);
    setError('');
    setPassword('');

    if (authUser) setUsername(authUser);
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanUser = username.trim();
    if (!cleanUser || !password.trim()) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, cleanUser);
    }

    setAuthUser(cleanUser);
    setError('');
    setPassword('');
    setLoginOpen(false);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setAuthUser(null);
    setUsername('');
    setPassword('');
    setError('');
    setLoginOpen(false);
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
          padding: '0 20px',
          gap: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          zIndex: 2000,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
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

        <Link to="/" style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 482.3 144.06" height="36" width="70">
            <defs><style>{`.hl{fill:#fff;}`}</style></defs>
            <path className="hl" d="m179.3,131.44h-23.36v-51.56h-14.21v63.08h37.57v-11.52h0Zm32.4,12.62h.27c17.56-.05,26.34-9.52,26.34-28.42v-35.76h-14.21v37.13c0,9.85-3.92,14.78-11.75,14.78s-11.97-5.1-11.97-15.31v-36.6h-14.25v36.42c0,18.46,8.52,27.71,25.56,27.76h0Zm270.6-1.1v-63.08h-13.37v34.88c0,4.31.12,7.2.35,8.67h-.18c-.97-1.7-2.02-3.42-3.17-5.15l-25.03-38.4h-15.31v63.08h13.42v-34.66c0-4.57-.12-7.98-.35-10.21h.18c.59,1.17,1.64,2.92,3.17,5.23l26,39.64h14.3Zm-182.96-11.52h-31.72l31.63-43.59v-7.96h-48.39v11.57h30l-32.33,43.33v8.18h50.81v-11.52h0Zm50.61,0h-23.62v-14.43h20.63v-11.53h-20.63v-14.03h22.17v-11.57h-36.38v63.08h37.83v-11.52h0Zm55.62-7.13c-.62-.97-1.3-1.96-2.05-2.97-.75-1.01-1.53-1.96-2.35-2.84-.82-.88-1.67-1.65-2.55-2.31-.88-.66-1.79-1.14-2.73-1.43v-.18c2.14-.62,4.08-1.47,5.83-2.55,1.74-1.08,3.23-2.37,4.47-3.87,1.23-1.5,2.18-3.17,2.86-5.04.67-1.86,1.01-3.89,1.01-6.09,0-11.44-7.65-17.16-22.96-17.16h-22.52v63.08h14.21v-24.15h3.83c.88,0,1.69.18,2.44.55.75.37,1.47.89,2.16,1.58.69.69,1.37,1.52,2.05,2.49.67.97,1.38,2.07,2.11,3.3l9.81,16.23h16.32l-11.92-18.65h0Zm-20.37-33.78c6.6,0,9.9,2.76,9.9,8.27,0,2.64-.94,4.85-2.81,6.64-1.85,1.76-4.3,2.64-7.35,2.64h-6.16v-17.55h6.42Z" />
            <path className="hl" d="m156.69,31.32L183.74,1.06h-9.19l-23.58,27.49c-.7.79-1.26,1.51-1.67,2.15h-.18V1.06h-7.39v63.08h7.39v-31.06h.18c.2.38.76,1.12,1.67,2.2l24.37,28.86h10.29l-28.94-32.82h0Zm325.61,32.82V1.06h-7.35v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L441.08,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.02ZM390.26,0h-.42c-9.34.05-16.73,3.07-22.17,9.06-5.48,6.04-8.23,14.14-8.23,24.28,0,9.44,2.69,17.11,8.07,23.01,5.38,5.89,12.54,8.84,21.49,8.84s16.45-2.99,21.91-8.97c5.46-5.98,8.18-14.12,8.18-24.41,0-9.47-2.66-17.14-7.98-23.01-5.28-5.82-12.23-8.75-20.85-8.8h0Zm-170.66,1.06h-7.65l-24.2,63.08h8.23l6.29-17.68h26.75l6.68,17.68h8.18L219.59,1.06h0Zm-14.87,38.75l9.81-26.88c.38-1.03.72-2.43,1.01-4.22h.18c.32,1.94.64,3.34.97,4.22l9.9,26.88h-21.86ZM304.01,1.06h-7.39v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L262.75,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.06V1.06h0Zm53.04,0h-43.77v6.69h18.17v56.39h7.39V7.74h18.21V1.06h0Zm48.48,12.45c3.87,4.55,5.81,10.98,5.81,19.31s-2,14.44-5.98,18.96c-3.99,4.52-9.44,6.77-16.36,6.77-6.48,0-11.74-2.37-15.77-7.1-4.03-4.74-6.05-10.99-6.05-18.76s2.07-14.05,6.2-18.83c4.13-4.78,9.52-7.17,16.14-7.17s12.14,2.27,16.01,6.82h0Z" />
            <polygon className="hl" points="0 142.83 70.87 142.83 70.87 1.1 0 1.1 0 142.83 0 142.83" />
          </svg>
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {authUser && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {authUser}
            </span>
          )}

          <button
            type="button"
            onClick={openLoginModal}
            aria-label={authUser ? 'Benutzerkonto öffnen' : 'Login öffnen'}
            title={authUser ? 'Konto' : 'Login'}
            style={{
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 999,
              padding: '5px 10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {authUser ? <LuUserCheck size={18} /> : <LuCircleUserRound size={18} />}
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {authUser ? 'Konto' : 'Login'}
            </span>
          </button>
        </div>
      </header>

      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1998 }} />}

      <nav
        style={{
          position: 'fixed',
          top: 37,
          left: 0,
          width: 260,
          background: '#fff',
          boxShadow: '2px 0 16px rgba(0,0,0,0.15)',
          zIndex: 1999,
          paddingTop: 8,
          paddingBottom: 8,
          fontFamily: 'system-ui, sans-serif',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.22s ease',
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
            style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', padding: 16, zIndex: 2999 }}
          >
            <div
              style={{
                width: 'min(100%, 420px)',
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 18px 48px rgba(0,0,0,0.22)',
                padding: 24,
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 id="dummy-login-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
                    Dummy Login
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666', lineHeight: 1.5 }}>
                    {authUser
                      ? 'Du bist aktuell eingeloggt und kannst dich hier wieder ausloggen.'
                      : 'Für den Demo-Login reicht ein beliebiger Benutzername mit Passwort.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  aria-label="Modal schließen"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#666' }}
                >
                  ×
                </button>
              </div>

              {authUser ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: '#f5f9ff',
                      border: '1px solid #d8e8ff',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#5d6b82', marginBottom: 4 }}>Angemeldet als</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{authUser}</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      display: 'inline-flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 8,
                      border: 'none',
                      borderRadius: 10,
                      background: '#d9534f',
                      color: '#fff',
                      fontWeight: 700,
                      padding: '11px 14px',
                      cursor: 'pointer',
                    }}
                  >
                    <LuLogOut size={16} />
                    Ausloggen
                  </button>
                </div>
              ) : (
                <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12 }}>
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
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
