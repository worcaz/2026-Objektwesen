import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuHouse, LuLayers3, LuX } from 'react-icons/lu';
import './Header.css';

const AGOV_ACCESS_APP_ICON_URL = '/icons_agov.svg';
export const AUTH_STORAGE_KEY = 'objektwesen-demo-user';
export const AUTH_EVENT_NAME = 'objektwesen-auth-changed';
export const AUTH_OPEN_LOGIN_EVENT = 'objektwesen-open-login';
export const USER_ROLE_STORAGE_KEY = 'objektwesen-user-role';
export const USER_ROLE_EVENT_NAME = 'objektwesen-role-changed';
export const QUOTA_STORAGE_KEY = 'objektwesen-grundbuch-quota';
export const QUOTA_RESET_EVENT = 'objektwesen-quota-reset';
export const QUOTA_SET_EVENT = 'objektwesen-quota-set';
export const QUOTA_MAX = 10;
export type UserRole = 'buerger' | 'verwaltung';

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
      className="dummy-qr-svg"
      style={{ maxWidth: size }}
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
      className="agov-app-icon"
    />
  );
}

function RegistrationPanel() {
  return (
    <div className="header-reg-panel">
      <div>
        <div className="header-reg-label">Registrierung</div>
        <div className="header-reg-title">Haben Sie noch kein AGOV-Konto?</div>
        <p className="header-reg-text">
          Registrieren Sie sich für diesen Demo-Prozess mit einem Dummy-Button ohne weitere Funktion.
        </p>
      </div>

      <button type="button" className="header-reg-btn">
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
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="bot-avatar-svg">
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
  const [userRole, setUserRole] = useState<UserRole>('buerger');
  const [error, setError] = useState('');
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedUser) {
      setAuthUser(savedUser);
      setUsername(savedUser);
    }
    const savedRole = window.localStorage.getItem(USER_ROLE_STORAGE_KEY) as UserRole | null;
    if (savedRole) setUserRole(savedRole);
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

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
      window.dispatchEvent(new CustomEvent(USER_ROLE_EVENT_NAME, { detail: role }));
    }
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
      <header className="header">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => {
              const next = !o;
              if (next) onAccountMenuOpen?.();
              return next;
            });
            setAccountMenuOpen(false);
          }}
          aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
          className="header-hamburger"
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="header-hamburger-line" />
          ))}
        </button>

        <Link to="/" className="header-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 582.3 144.06" className="header-logo-svg">
            <defs><style>{`.hl{fill:#fff;}`}</style></defs>
            <path className="hl" d="m179.3,131.44h-23.36v-51.56h-14.21v63.08h37.57v-11.52h0Zm32.4,12.62h.27c17.56-.05,26.34-9.52,26.34-28.42v-35.76h-14.21v37.13c0,9.85-3.92,14.78-11.75,14.78s-11.97-5.1-11.97-15.31v-36.6h-14.25v36.42c0,18.46,8.52,27.71,25.56,27.76h0Zm270.6-1.1v-63.08h-13.37v34.88c0,4.31.12,7.2.35,8.67h-.18c-.97-1.7-2.02-3.42-3.17-5.15l-25.03-38.4h-15.31v63.08h13.42v-34.66c0-4.57-.12-7.98-.35-10.21h.18c.59,1.17,1.64,2.92,3.17,5.23l26,39.64h14.3Zm-182.96-11.52h-31.72l31.63-43.59v-7.96h-48.39v11.57h30l-32.33,43.33v8.18h50.81v-11.52h0Zm50.61,0h-23.62v-14.43h20.63v-11.53h-20.63v-14.03h22.17v-11.57h-36.38v63.08h37.83v-11.52h0Zm55.62-7.13c-.62-.97-1.3-1.96-2.05-2.97-.75-1.01-1.53-1.96-2.35-2.84-.82-.88-1.67-1.65-2.55-2.31-.88-.66-1.79-1.14-2.73-1.43v-.18c2.14-.62,4.08-1.47,5.83-2.55,1.74-1.08,3.23-2.37,4.47-3.87,1.23-1.5,2.18-3.17,2.86-5.04.67-1.86,1.01-3.89,1.01-6.09,0-11.44-7.65-17.16-22.96-17.16h-22.52v63.08h14.21v-24.15h3.83c.88,0,1.69.18,2.44.55.75.37,1.47.89,2.16,1.58.69.69,1.37,1.52,2.05,2.49.67.97,1.38,2.07,2.11,3.3l9.81,16.23h16.32l-11.92-18.65h0Zm-20.37-33.78c6.6,0,9.9,2.76,9.9,8.27,0,2.64-.94,4.85-2.81,6.64-1.85,1.76-4.3,2.64-7.35,2.64h-6.16v-17.55h6.42Z" />
            <path className="hl" d="m156.69,31.32L183.74,1.06h-9.19l-23.58,27.49c-.7.79-1.26,1.51-1.67,2.15h-.18V1.06h-7.39v63.08h7.39v-31.06h.18c.2.38.76,1.12,1.67,2.2l24.37,28.86h10.29l-28.94-32.82h0Zm325.61,32.82V1.06h-7.35v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L441.08,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.02ZM390.26,0h-.42c-9.34.05-16.73,3.07-22.17,9.06-5.48,6.04-8.23,14.14-8.23,24.28,0,9.44,2.69,17.11,8.07,23.01,5.38,5.89,12.54,8.84,21.49,8.84s16.45-2.99,21.91-8.97c5.46-5.98,8.18-14.12,8.18-24.41,0-9.47-2.66-17.14-7.98-23.01-5.28-5.82-12.23-8.75-20.85-8.8h0Zm-170.66,1.06h-7.65l-24.2,63.08h8.23l6.29-17.68h26.75l6.68,17.68h8.18L219.59,1.06h0Zm-14.87,38.75l9.81-26.88c.38-1.03.72-2.43,1.01-4.22h.18c.32,1.94.64,3.34.97,4.22l9.9,26.88h-21.86ZM304.01,1.06h-7.39v44.43c0,4.37.15,7.46.44,9.28h-.18c-.38-.76-1.23-2.17-2.55-4.22L262.75,1.06h-9.59v63.08h7.39V18.56c0-4.43-.12-7.32-.35-8.67h.26c.53,1.38,1.2,2.7,2.02,3.96l32.46,50.28h9.06V1.06h0Zm53.04,0h-43.77v6.69h18.17v56.39h7.39V7.74h18.21V1.06h0Zm48.48,12.45c3.87,4.55,5.81,10.98,5.81,19.31s-2,14.44-5.98,18.96c-3.99,4.52-9.44,6.77-16.36,6.77-6.48,0-11.74-2.37-15.77-7.1-4.03-4.74-6.05-10.99-6.05-18.76s2.07-14.05,6.2-18.83c4.13-4.78,9.52-7.17,16.14-7.17s12.14,2.27,16.01,6.82h0Z" />
            <polygon className="hl" points="0 142.83 70.87 142.83 70.87 1.1 0 1.1 0 142.83 0 142.83" />
          </svg>
          <span className="header-logo-text">Objektwesen</span>
        </Link>

        <div className="header-right">
          <div className="header-account-wrapper">
            <button
              type="button"
              onClick={handleAccountButtonClick}
              aria-label={authUser ? 'Benutzermenü öffnen' : 'Anmelden öffnen'}
              aria-expanded={authUser ? accountMenuOpen : undefined}
              title={authUser ? 'Konto' : 'Anmelden'}
              className={`header-account-btn ${authUser ? 'header-account-btn--authed' : 'header-account-btn--login'}`}
            >
              {authUser ? (
                <BotAvatar seed={authUser} size={26} />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500 }}>Anmelden</span>
              )}
            </button>

            {authUser && accountMenuOpen && (
              <div className="header-account-menu">
                <div className="header-account-menu-user">
                  <div className="header-account-menu-greeting">
                     <strong>Hallo {authUser}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen(false)}
                    className="header-account-close-btn"
                    aria-label="Account-Fenster schliessen"
                  >
                    <LuX size={18} />
                  </button>
                </div>

                <div className="header-account-menu-poc-section">
                  <div className="header-account-menu-poc-label">PoC</div>

                  <div className="header-account-menu-role-section">
                    <div className="header-account-menu-role-label">Ich bin...</div>
                    <div className="header-role-switcher">
                      {(['buerger', 'verwaltung'] as const).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleRoleChange(role)}
                          className={`header-role-btn${userRole === role ? ' header-role-btn--active' : ''}`}
                        >
                          {role === 'buerger' ? 'Bürger' : 'Verwaltung'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="header-poc-btn"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.removeItem(QUOTA_STORAGE_KEY);
                        window.dispatchEvent(new CustomEvent(QUOTA_RESET_EVENT));
                      }
                    }}
                  >
                    Reset Abfrage Kontingent
                  </button>

                  <button
                    type="button"
                    className="header-poc-btn"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const value = QUOTA_MAX - 1;
                        window.sessionStorage.setItem(QUOTA_STORAGE_KEY, String(value));
                        window.dispatchEvent(new CustomEvent(QUOTA_SET_EVENT, { detail: value }));
                      }
                    }}
                  >
                    Setze Grundbuch-Quota = 1
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="header-logout-btn"
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
          className="header-overlay"
        />
      )}

      <nav className={`header-nav${open ? ' header-nav--open' : ''}`}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`header-nav-link${active ? ' header-nav-link--active' : ''}`}
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
            className="header-backdrop"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dummy-login-title"
            className="header-modal-container"
          >
            <div className="header-modal">
              <div className="header-modal-header">
                <div className="header-modal-title-area">
                  <h2 id="dummy-login-title" className="header-modal-title">
                    Anmelden
                  </h2>
                  <p className="header-modal-subtitle">
                    Melden Sie sich via AGOV access App oder mit den Demo-Zugangsdaten an.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setLoginOpen(false)}
                  aria-label="Modal schließen"
                  className="header-modal-close-btn"
                >
                  ×
                </button>
              </div>

              <div className="header-modal-body">
                <div className="header-modal-left">
                  {!authUser && (
                    <>
                      <div className="header-agov-panel">
                        <div className="header-agov-panel-title">
                          Login mit AGOV access App
                        </div>

                        <div className="header-qr-center">
                          <DummyQrCode size={176} />
                        </div>

                        <div className="header-agov-card">
                          <AgovAccessCardIcon />
                          <div className="header-agov-card-text">
                            Melden Sie sich an, indem Sie den QR-Code mit Ihrer AGOV access App scannen
                          </div>
                        </div>
                      </div>

                      <hr className="header-divider" />
                    </>
                  )}

                  <form onSubmit={handleLogin} className="header-login-form">
                      <label className="header-form-label">
                        Benutzername
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="z. B. demo.user"
                          className="header-form-input"
                        />
                      </label>

                      <label className="header-form-label">
                        Passwort
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="beliebiges Passwort"
                          className="header-form-input"
                        />
                      </label>

                      {error && (
                        <div className="header-form-error">{error}</div>
                      )}

                      <button type="submit" className="header-form-submit">
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
