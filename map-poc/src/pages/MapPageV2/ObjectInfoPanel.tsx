import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { LuDownload, LuFileText, LuGlobe, LuHouse, LuInfo, LuLayers3, LuLock, LuMail, LuPhone, LuSearch, LuX } from 'react-icons/lu';
import { PiCrane } from 'react-icons/pi';
import {
  AUTH_EVENT_NAME, AUTH_OPEN_LOGIN_EVENT, AUTH_STORAGE_KEY,
  USER_ROLE_STORAGE_KEY, USER_ROLE_EVENT_NAME,
  QUOTA_STORAGE_KEY, QUOTA_RESET_EVENT, QUOTA_MAX,
} from '../../components/Header';
import type { UserRole } from '../../components/Header';
import type {
  ObjectInfo,
  OwnershipInfo,
  OwnerParty,
  ContactInfo,
  BuildingInfo,
  ProjectInfo,
  BodenbedeckungEntry,
  ZonenplanEntry,
  SearchResult,
} from './mockData';
import { buildSearchResults } from './mockData';
import ExportSection from './ExportSection';

// ─── Object info panel & search ──────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'bestehend':      { bg: '#d4edda', color: '#155724' },
  'abgebrochen':    { bg: '#f8d7da', color: '#721c24' },
  'projektiert':    { bg: '#cce5ff', color: '#004085' },
  'geplant':        { bg: '#cce5ff', color: '#004085' },
  'im Bau':         { bg: '#fff3cd', color: '#856404' },
  'Abgeschlossen':  { bg: '#d4edda', color: '#155724' },
  'Leitentscheid':  { bg: 'rgb(166, 0, 133)', color: '#ffffff' },
  'Bewilligt':      { bg: '#d4edda', color: '#155724' },
  'In Bearbeitung': { bg: '#fff3cd', color: '#856404' },
  'Vernehmlassung': { bg: '#dbeafe', color: '#1d4ed8' },
  'Entscheidung':   { bg: 'rgb(255, 117, 225)', color: '#ffffff' },
  'Sichten':        { bg: 'rgb(255, 255, 191)', color: '#6b5a00' },
  'In Prüfung':     { bg: 'rgb(255, 255, 191)', color: '#6b5a00' },
  'Auflage':        { bg: 'rgb(255, 255, 191)', color: '#6b5a00' },
};

function SectionIcon({ title }: { title: string }) {
  const iconProps = { size: 13, color: '#111' };

  let icon: ReactNode = <LuFileText {...iconProps} />;
  if (title === 'Grundstück') icon = <LuLayers3 {...iconProps} />;
  else if (title === 'Zuständige Stellen') icon = <LuPhone {...iconProps} />;
  else if (title === 'Export') icon = <LuDownload {...iconProps} />;
  else if (title === 'Gebäude') icon = <LuHouse {...iconProps} />;
  else if (title === 'Bauprojekte') icon = <PiCrane size={14} color="#111" />;

  return (
    <span
      aria-hidden="true"
      className="section-icon"
    >
      {icon}
    </span>
  );
}

function InfoTooltip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setCoords({ x: r.right + 8, y: r.top + r.height / 2 });
    }
  };
  const hide = () => setCoords(null);

  return (
    <span
      ref={ref}
      className="info-tooltip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={() => coords ? hide() : show()}
    >
      <LuInfo size={12} color="#9ca3af" style={{ cursor: 'default' }} />
      {coords && (
        <span
          className="info-tooltip__popup"
          style={{ left: coords.x, top: coords.y }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  infoTooltip,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  infoTooltip?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        onClick={collapsible ? () => setOpen((value) => !value) : undefined}
        className={[
          'section-header',
          open ? 'section-header--open' : '',
          collapsible ? 'section-header--collapsible' : '',
        ].join(' ')}
        aria-expanded={collapsible ? open : undefined}
      >
        <div className="section-title-wrapper">
          <SectionIcon title={title} />
          <div className="section-title">
            {title}
          </div>
          {infoTooltip && <InfoTooltip text={infoTooltip} />}
        </div>

        {collapsible && (
          <span className="section-toggle">
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>
      {open && <div className="section-content">{children}</div>}
      <hr className="section-divider" />
    </div>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="field-row">
      <span className="field-row__label">{label}</span>
      <div className={`field-row__value${mono ? ' field-row__value--mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function InlineMetaIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-meta-icon">
      {children}
    </span>
  );
}

function ProtectedFieldRow({
  label,
  value,
  isAuthenticated,
}: {
  label: string;
  value: ReactNode;
  isAuthenticated: boolean;
}) {
  return (
    <FieldRow
      label={label}
      value={isAuthenticated ? value : (
        <span className="protected-field-locked">
          <InlineMetaIcon><LuLock size={12} color="#111" /></InlineMetaIcon>
          <span>Login erforderlich</span>
        </span>
      )}
    />
  );
}

function OwnershipValue({ info }: { info: OwnershipInfo }) {
  const renderParties = (parteien: OwnerParty[]) => (
    <>
      {parteien.map((partei, index) => (
        <div key={`${partei.name}-${index}`} className="owner-party">
          <div className="owner-party__name">{partei.name}</div>
          {partei.addresses.map((address, addressIndex) => (
            <div key={`${address.label}-${addressIndex}`} className="owner-party__address">
              <span className="owner-party__address-label">{address.label}:</span>{' '}
              <span>{address.value}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="ownership-value">
      <div className="ownership-eigentumsform">{info.eigentumsform}</div>
      {info.beteiligungen?.length ? (
        <div className="beteiligungen-list">
          {info.beteiligungen.map((beteiligung, index) => (
            <div key={`${beteiligung.grundstueck}-${index}`} className="beteiligung-item">
              <div className="beteiligung-grundstueck">
                {beteiligung.grundstueck}
                {beteiligung.anteil ? <span className="beteiligung-anteil"> ({beteiligung.anteil})</span> : null}
              </div>
              <div className="beteiligung-eigentumsform">{beteiligung.eigentumsform}</div>
              {renderParties(beteiligung.parteien)}
            </div>
          ))}
        </div>
      ) : renderParties(info.parteien)}
    </div>
  );
}

function ContactRow({ label, contact }: { label: string; contact: ContactInfo }) {
  const phoneHref = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;
  const webHref = `https://${contact.website}`;

  return (
    <div className="contact-row">
      <span className="contact-row__label">{label}</span>

      <div className="contact-row__header">
        <div className="contact-row__info">
          <span className="contact-row__office">{contact.office}</span>
          <span className="contact-row__person">{contact.person}</span>
        </div>
        <div className="contact-row__actions">
          <a href={phoneHref} aria-label={`Telefon ${label}`} className="contact-action-btn"><LuPhone size={13} /></a>
          <a href={`mailto:${contact.email}`} aria-label={`E-Mail ${label}`} className="contact-action-btn"><LuMail size={13} /></a>
          <a href={webHref} target="_blank" rel="noreferrer" aria-label={`Website ${label}`} className="contact-action-btn"><LuGlobe size={13} /></a>
        </div>
      </div>

      <div className="contact-row__address">
        <span>{contact.street}</span>
        <span>{contact.city}</span>
      </div>

      <div className="contact-row__meta">
        <a href={phoneHref} className="contact-link">{contact.phone}</a>
        <a href={`mailto:${contact.email}`} className="contact-link">{contact.email}</a>
        <a href={webHref} target="_blank" rel="noreferrer" className="contact-link">{contact.website}</a>
      </div>
    </div>
  );
}

const ZONENPLAN_SYMBOL_PATH = 'M -10,-10 L 10,0 L 10,10 L -10,10 L -10,-10 Z';
const BODENBEDECKUNG_SYMBOL_PATH = 'M 0,-10 L 10,0 L 0,10 L -10,0 L 0,-10 Z';
const TINY_SYMBOL_STROKE = 'rgba(104, 104, 104, 1)';

function normalizeLegendLabel(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getBodenbedeckungColor(label: string): string {
  const key = normalizeLegendLabel(label);
  if (key.includes('wald')) return 'rgba(76, 175, 80, 1)';
  if (key.includes('gewasser')) return 'rgba(78, 160, 220, 1)';
  if (key.includes('garten') || key.includes('landwirtschaft')) return 'rgba(147, 196, 84, 1)';
  if (key.includes('gebaude')) return 'rgba(159, 122, 85, 1)';
  if (key.includes('verkehr') || key.includes('befestigte')) return 'rgba(159, 166, 178, 1)';
  return 'rgba(208, 208, 208, 1)';
}

function getZoneColor(zonentyp: string, gemeinde?: string): string {
  const key = normalizeLegendLabel(`${zonentyp} ${gemeinde ?? ''}`);
  if (key.includes('wald')) return 'rgba(76, 175, 80, 1)';
  if (key.includes('grunzone') || key.includes('grun')) return 'rgba(180, 229, 168, 1)';
  if (key.includes('arbeitszone') || key.includes('gewerbezone') || key.includes('industriezone')) return 'rgba(69, 135, 214, 1)';
  if (key.includes('zentrumszone') || key.includes('kern') || key.includes('dorfzone')) return 'rgba(217, 196, 157, 1)';
  if (key.includes('wohnzone w3')) return 'rgba(214, 169, 18, 1)';
  if (key.includes('wohnzone')) return 'rgba(247, 201, 38, 1)';
  if (key.includes('strasse') || key.includes('verkehrszone')) return 'rgba(168, 176, 185, 1)';
  return 'rgba(205, 214, 221, 1)';
}

function TinyLegendSymbol({ fill, title, variant = 'zonenplan' }: { fill: string; title: string; variant?: 'zonenplan' | 'bodenbedeckung' }) {
  const path = variant === 'bodenbedeckung' ? BODENBEDECKUNG_SYMBOL_PATH : ZONENPLAN_SYMBOL_PATH;

  return (
    <span title={title} aria-hidden="true" className="tiny-legend-symbol">
      <svg viewBox="-10 -10 20 20" width="12" height="12">
        <path
          d={path}
          fill={fill}
          fillRule="evenodd"
          stroke={TINY_SYMBOL_STROKE}
          strokeDasharray="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit="4"
          strokeWidth="1.3333333333333333"
        />
      </svg>
    </span>
  );
}

function CollapsibleZonenplan({ entries }: { entries: ZonenplanEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collapsible">
      <div onClick={() => setOpen(o => !o)} className="collapsible__header">
        <span className="collapsible__label">Grundnutzung Zonenplan</span>
        <span className="collapsible__toggle">{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div className="zonenplan-body">
          <div className="zonenplan-table">
            <div className="zonenplan-header-row">
              <span>Zonentyp</span>
              <span>Gemeinde</span>
              <span className="zone-header-right">Fläche</span>
              <span className="zone-header-right">Anteil</span>
            </div>
            {entries.map((e, i) => (
              <div key={i} className="zonenplan-data-row">
                <span className="zone-type-cell">
                  <TinyLegendSymbol fill={getZoneColor(e.zonentyp, e.gemeinde)} title={e.zonentyp} variant="zonenplan" />
                  <span>{e.zonentyp}</span>
                </span>
                <span className="zone-gemeinde">{e.gemeinde}</span>
                <span className="zone-value">{e.flaeche}</span>
                <span className="zone-value">{e.anteil}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleBauprojekte({ entries }: { entries: ProjectInfo[] }) {
  const [open, setOpen] = useState(false);
  const [expandedDossier, setExpandedDossier] = useState<string | null>(null);

  return (
    <div className="collapsible">
      <div onClick={() => setOpen(o => !o)} className="collapsible__header">
        <span className="collapsible__label">Bauprojekte</span>
        <span className="collapsible__toggle">{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div className="bauprojekte-list">
          {entries.map((p, i) => {
            const c = STATUS_BADGE[p.status] ?? { bg: '#eee', color: '#555' };
            const isExpanded = expandedDossier === p.dossierNr;

            return (
              <div
                key={i}
                className={`project-card${isExpanded ? ' project-card--expanded' : ''}`}
              >
                <div className="project-card__header">
                  <div className="project-meta-row">
                    <div className="project-left-col">
                      <div className="project-label">
                        Bauprojekt {i + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedDossier((value) => value === p.dossierNr ? null : p.dossierNr)}
                        aria-expanded={isExpanded}
                        className="project-dossier-btn"
                        title="Details anzeigen"
                      >
                        <span aria-hidden="true" className="project-dossier-arrow">{isExpanded ? '▼' : '▶'}</span>
                        <span className="project-dossier-link">Dossier {p.dossierNr}</span>
                      </button>
                    </div>

                    <div className="project-right-col">
                      <span className="status-badge" style={{ background: c.bg, color: c.color }}>
                        {p.status}
                      </span>
                      <span className="project-detail-toggle-text">
                        {isExpanded ? 'Details sichtbar' : 'Details anzeigen'}
                      </span>
                    </div>
                  </div>

                  <div className="project-description">
                    {p.bezeichnung}
                  </div>
                </div>

                {isExpanded && (
                  <div className="project-details">
                    <div>
                      <div className="field-sublabel">Amtliche Baudossier-Nr.</div>
                      <div className="field-subvalue">{p.amtlicheBaudossierNr || '—'}</div>
                    </div>
                    <div>
                      <div className="field-sublabel">Eidg. Projektidentifikator</div>
                      <div className="field-subvalue">{p.eidgProjektidentifikator || '—'}</div>
                    </div>
                    <div>
                      <div className="field-sublabel">Anzahl projektierte Wohnungen</div>
                      <div className="field-subvalue">{p.anzahlProjektierteWohnungen || '—'}</div>
                    </div>
                    <div>
                      <div className="field-sublabel">Art der Arbeiten</div>
                      <div className="field-subvalue">{p.artDerArbeiten || '—'}</div>
                    </div>
                    <div>
                      <div className="field-sublabel">Art der Bauwerke</div>
                      <div className="field-subvalue">{p.artDerBauwerke || '—'}</div>
                    </div>
                    <div>
                      <div className="field-sublabel">Typ der Bauwerke</div>
                      <div className="field-subvalue">{p.typDerBauwerke || '—'}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleGebaeude({ entries, isAuthenticated }: { entries: BuildingInfo[]; isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const renderProtectedValue = (value: string) => (
    isAuthenticated ? (
      <span className="field-subvalue">{value || '—'}</span>
    ) : (
      <span className="protected-field-locked">
        <InlineMetaIcon><LuLock size={12} color="#111" /></InlineMetaIcon>
        <span>Login erforderlich</span>
      </span>
    )
  );

  return (
    <div className="collapsible">
      <div onClick={() => setOpen(o => !o)} className="collapsible__header">
        <span className="collapsible__label">Gebäude</span>
        <span className="collapsible__toggle">
          {open ? '▲ zuklappen' : `▼ ${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`}
        </span>
      </div>
      {open && (
        <div className="gebaeude-list">
          {entries.map((g, i) => {
            const c = STATUS_BADGE[g.gebaeudestatus] ?? { bg: '#eee', color: '#555' };
            return (
              <div key={`${g.egid}-${i}`} className="building-card">
                <div className="project-meta-row">
                  <div className="building-left">
                    <div className="project-label">Gebäude {i + 1}</div>
                    <div className="building-nr">Nr. {g.nr}</div>
                  </div>
                  <span className="status-badge" style={{ background: c.bg, color: c.color }}>
                    {g.gebaeudestatus}
                  </span>
                </div>

                <div className="building-details">
                  <div>
                    <div className="field-sublabel">Versicherungs-Nr.</div>
                    <div className="field-subvalue">{g.versicherungsNr || '—'}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Baujahr / Bauperiode</div>
                    <div className="field-subvalue">{g.baujahrBauperiode || '—'}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Gebäudekategorie</div>
                    <div className="field-subvalue">{g.gebaeudekategorie || '—'}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Gebäudestatus</div>
                    <div className="field-subvalue">{g.gebaeudestatus || '—'}</div>
                  </div>
                  <div className="span-full">
                    <div className="field-sublabel">Adresse</div>
                    <div className="field-subvalue">{g.adresse || '—'}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Koordinaten (Gebäudeschwerpunkt)</div>
                    <div className="field-subvalue" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.koordinaten || '—'}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">EGID</div>
                    <div className="field-subvalue" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.egid}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Verwaltung Gebäude</div>
                    <div>{renderProtectedValue(g.verwaltungGebaeude)}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Versicherungswert</div>
                    <div>{renderProtectedValue(g.versicherungswert)}</div>
                  </div>
                  <div>
                    <div className="field-sublabel">Anzahl Wohnungen</div>
                    <div>{renderProtectedValue(g.anzahlWohnungen)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollapsibleBodenbedeckung({ entries }: { entries: BodenbedeckungEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="collapsible">
      <div onClick={() => setOpen(o => !o)} className="collapsible__header">
        <span className="collapsible__label">Bodenbedeckung</span>
        <span className="collapsible__toggle">{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div className="bodenbedeckung-body">
          {entries.map((e, i) => (
            <div key={i} className="bodenbedeckung-row">
              <span className="bodenbedeckung-type">
                <TinyLegendSymbol fill={getBodenbedeckungColor(e.label)} title={e.label} variant="bodenbedeckung" />
                <span>{e.label}</span>
              </span>
              <span className="bodenbedeckung-area">{e.area}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsibleStringList({ label, entries }: { label: string; entries: string[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) {
    return (
      <div className="string-list-empty">
        <span className="collapsible__label">{label}</span>
        <span className="string-list-empty__dash">—</span>
      </div>
    );
  }
  return (
    <div className="collapsible">
      <div onClick={() => setOpen(o => !o)} className="collapsible__header">
        <span className="collapsible__label">{label}</span>
        <span className="collapsible__toggle">{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div className="collapsible-list-body">
          {entries.map((e, i) => (
            <span key={i} className="collapsible-list-entry">{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectInfoPanel({ info, onClose }: { info: ObjectInfo; onClose: () => void }) {
  const [authUser, setAuthUser] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('buerger');
  const [quotaUsed, setQuotaUsed] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(window.sessionStorage.getItem(QUOTA_STORAGE_KEY) ?? '0', 10);
  });
  const [revealedParcels, setRevealedParcels] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncAuth = () => {
      setAuthUser(window.localStorage.getItem(AUTH_STORAGE_KEY));
    };

    const onAuthChange = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      setAuthUser(customEvent.detail ?? window.localStorage.getItem(AUTH_STORAGE_KEY));
    };

    syncAuth();
    window.addEventListener(AUTH_EVENT_NAME, onAuthChange);
    window.addEventListener('focus', syncAuth);

    return () => {
      window.removeEventListener(AUTH_EVENT_NAME, onAuthChange);
      window.removeEventListener('focus', syncAuth);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const r = window.localStorage.getItem(USER_ROLE_STORAGE_KEY) as UserRole | null;
      setUserRole(r ?? 'buerger');
    };
    const onRoleChange = (e: Event) => {
      setUserRole((e as CustomEvent<UserRole>).detail ?? 'buerger');
    };
    sync();
    window.addEventListener(USER_ROLE_EVENT_NAME, onRoleChange);
    return () => window.removeEventListener(USER_ROLE_EVENT_NAME, onRoleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onReset = () => {
      setQuotaUsed(0);
      setRevealedParcels(new Set());
    };
    window.addEventListener(QUOTA_RESET_EVENT, onReset);
    return () => window.removeEventListener(QUOTA_RESET_EVENT, onReset);
  }, []);

  const isAuthenticated = Boolean(authUser);

  const isBuerger = isAuthenticated && userRole === 'buerger';
  const isRevealed = revealedParcels.has(info.egrid);
  const quotaExhausted = quotaUsed >= QUOTA_MAX;
  const quotaRemaining = QUOTA_MAX - quotaUsed;

  const handleAbrufen = () => {
    const next = quotaUsed + 1;
    setQuotaUsed(next);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(QUOTA_STORAGE_KEY, String(next));
    }
    setRevealedParcels(prev => new Set(prev).add(info.egrid));
  };

  const bauprojekteTooltip = (() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 30, 0, 0);
    const d = String(yesterday.getDate()).padStart(2, '0');
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const y = yesterday.getFullYear();
    const hh = String(yesterday.getHours()).padStart(2, '0');
    const mm = String(yesterday.getMinutes()).padStart(2, '0');
    return `Zuletzt aktualisiert: Gestern (${d}.${m}.${y} ${hh}:${mm} Uhr)`;
  })();

  const stammdatenTooltip = (() => {
    const now = new Date();
    now.setHours(now.getHours() - 2);
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `Zuletzt aktualisiert: Heute (${d}.${m}.${y} ${hh}:${mm} Uhr)`;
  })();

  return (
    <div className="info-panel">
      <div className="info-panel__header">
        <span className="info-panel__title">Grundstück {info.grundstueckNummer}</span>
        <button onClick={onClose} className="info-panel__close" aria-label="Schliessen"><LuX size={28} /></button>
      </div>

      <div className="info-panel__body">
        <Section title="Stammdaten" infoTooltip={stammdatenTooltip}>
          <FieldRow label="Grundstücknummer"              value={info.grundstueckNummer} />
          <FieldRow label="Eidg. Grundstück-ID (EGRID)"  value={info.egrid} />
          <FieldRow label="Gemeinde (BFS-Nr.)"            value={`${info.gemeinde} (${info.bfsNr})`} />
          <FieldRow label="Grundbuch (GB-Nr.)"            value={info.grundbuchNr} />
          <FieldRow label="Grundstückart"                value={info.grundstueckArt} />
          <FieldRow label="Flurnamen"                     value={info.flurname} />
          <CollapsibleBodenbedeckung entries={info.bodenbedeckung} />
          <FieldRow label="Fläche (grundbuchlich)"        value={info.flaecheGrundbuch} />
          <CollapsibleZonenplan entries={info.grundnutzungZonenplan} />
        </Section>

        <Section title="Grundstück" infoTooltip={`Zuletzt aktualisiert: ${info.letzteAktualisierung}`}>
          {!isAuthenticated && (
            <div className="login-notice">
              Für alle Angaben unter Grundstück bitte{' '}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent(AUTH_OPEN_LOGIN_EVENT));
                  }
                }}
                className="login-notice__btn"
              >
                einloggen
              </button>
              .
            </div>
          )}

          {isBuerger && !isRevealed && !quotaExhausted && (
            <div className="grundbuch-gate">
              <p className="grundbuch-gate__text">
                Pro Tag stehen Ihnen als Bürger 10 Grundbuchabfragen zur Verfügung. Das Kontingent wird nach 24 Stunden erneuert.
              </p>
              <div className="grundbuch-gate__footer">
                <span className="grundbuch-gate__quota">
                  {quotaRemaining} von {QUOTA_MAX} Abfragen verbleibend
                </span>
                <button type="button" className="grundbuch-gate__btn" onClick={handleAbrufen}>
                  Grundbuch-Daten abrufen
                </button>
              </div>
            </div>
          )}

          {isBuerger && !isRevealed && quotaExhausted && (
            <div className="grundbuch-exhausted">
              Sie haben Ihr Abfragekontingent für heute aufgebraucht.
            </div>
          )}

          {(!isAuthenticated || !isBuerger || isRevealed) && (
            <>
              <ProtectedFieldRow label="Eigentümer"                    value={<OwnershipValue info={info.eigentuemer} />} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Katasterwert"                  value={info.katasterwert} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Dienstbarkeiten / Grundlasten" value={info.dienstbarkeiten.length ? info.dienstbarkeiten.join(', ') : '—'} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Anmerkungen"                   value={info.anmerkungen.length ? info.anmerkungen.join(', ') : '—'} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Grundpfandrechte"              value={info.grundpfandrechte.length ? info.grundpfandrechte.join(', ') : '—'} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Erwerbsarten"                  value={info.erwerbsarten.length ? info.erwerbsarten.join(', ') : '—'} isAuthenticated={isAuthenticated} />
              <ProtectedFieldRow label="Offene Geschäfte"              value={info.offeneGeschaefte.length ? info.offeneGeschaefte.join(', ') : '—'} isAuthenticated={isAuthenticated} />
            </>
          )}
        </Section>

        <Section title="Gebäude" infoTooltip={bauprojekteTooltip}>
          <CollapsibleGebaeude entries={info.gebaeude} isAuthenticated={isAuthenticated} />
        </Section>
        <Section title="Bauprojekte" infoTooltip={bauprojekteTooltip}>
          <CollapsibleBauprojekte entries={info.bauprojekte} />
        </Section>
        <Section title="Zuständige Stellen" collapsible defaultOpen={false}>
          <ContactRow label="Nachführungsgeometer" contact={info.nachfuehrungsgeometer} />
          <ContactRow label="Grundbuchamt" contact={info.grundbuchamtKontakt} />
        </Section>
        <Section title="Export">
          <ExportSection info={info} isAuthenticated={isAuthenticated} />
        </Section>
      </div>
    </div>
  );
}

function SearchPanel({
  objectInfo, onSelect, onClose, onActivate, onInfoPanelClick,
}: {
  objectInfo: ObjectInfo | null;
  onSelect:   (info: ObjectInfo) => void;
  onClose:    () => void;
  onActivate?: () => void;
  onInfoPanelClick?: () => void;
}) {
  const [query,        setQuery]        = useState('');
  const [results,      setResults]      = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setShowDropdown(false); return; }
    const t = setTimeout(() => { setResults(buildSearchResults(query)); setShowDropdown(true); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const hasPanel = objectInfo !== null;
  const showDrop = showDropdown && results.length > 0 && !hasPanel;

  return (
    <div
      className="search-panel"
      style={{ width: hasPanel ? 'min(520px, calc(100vw - 24px))' : 'min(400px, calc(100vw - 24px))' }}
    >
      {/* Search input */}
      <div className="search-input-wrapper">
        <span className="search-icon"><LuSearch size={17} color="#888" /></span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => {
            onActivate?.();
            if (results.length > 0 && !hasPanel) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Grundstück suchen…"
          className="search-input"
          style={{ borderRadius: (showDrop || hasPanel) ? '8px 8px 0 0' : 8 }}
        />
      </div>

      {/* Dropdown */}
      {showDrop && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <div key={i}
              onMouseDown={() => { onSelect(r.info); setQuery(r.label); setShowDropdown(false); }}
              className="search-dropdown-item"
            >
              <div className="search-dropdown-item__label">{r.label}</div>
              <div className="search-dropdown-item__sub">{r.subLabel}</div>
            </div>
          ))}
        </div>
      )}

      {/* Info panel */}
      {hasPanel && (
        <div onClick={onInfoPanelClick}>
          <ObjectInfoPanel info={objectInfo} onClose={() => { onClose(); setQuery(''); }} />
        </div>
      )}
    </div>
  );
}

export default SearchPanel;
