import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { LuDownload, LuFileText, LuGlobe, LuHouse, LuLayers3, LuLock, LuMail, LuPhone, LuSearch, LuX } from 'react-icons/lu';
import { PiCrane } from 'react-icons/pi';
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  GeoJSON as GeoJSONLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import type { RealParcelProps } from '../wfsService';
import {
  fetchParcelsByBbox,
  buildMockFeatures,
  MIN_ZOOM_FOR_PARCELS,
} from '../wfsService';
import Header, { AUTH_EVENT_NAME, AUTH_OPEN_LOGIN_EVENT, AUTH_STORAGE_KEY } from '../components/Header';

// ─── Fix Leaflet's default marker icons broken by Vite's bundler ──────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

import 'leaflet/dist/leaflet.css';

// ─── WMS Configuration ───────────────────────────────────────────────────────
// Raster tile overlay: shows cadastral boundaries Switzerland-wide.
// Purely visual — click interaction is handled by the WFS vector layer below.
// WMS Capabilities: https://geodienste.ch/db/avc_0/deu?SERVICE=WMS&REQUEST=GetCapabilities
const WMS_URL         = 'https://wfs.geodienste.ch/avc_0/deu';
const WMS_LAYERS      = 'Liegenschaften';
const WMS_ATTRIBUTION = '&copy; <a href="https://geodienste.ch">geodienste.ch</a> – Amtliche Vermessung';

// ─── Vector layer styles ─────────────────────────────────────────────────────

/** Default style for all parcel polygons. */
const VECTOR_STYLE: L.PathOptions = {
  color:       '#3388ff',
  weight:      1.5,
  fillColor:   '#3388ff',
  fillOpacity: 0.08,
};

/** Applied to the currently selected / clicked polygon. */
const VECTOR_HIGHLIGHT_STYLE: L.PathOptions = {
  color:       '#e67e22',
  weight:      2.5,
  fillColor:   '#e67e22',
  fillOpacity: 0.25,
};

// ─── Object info model & dummy data ──────────────────────────────────────────

interface BuildingInfo {
  nr: string;
  versicherungsNr: string;
  baujahrBauperiode: string;
  gebaeudekategorie: string;
  gebaeudestatus: string;
  adresse: string;
  koordinaten: string;
  egid: string;
  verwaltungGebaeude: string;
  versicherungswert: string;
  anzahlWohnungen: string;
}
interface ProjectInfo {
  dossierNr: string;
  bezeichnung: string;
  status: string;
  amtlicheBaudossierNr: string;
  eidgProjektidentifikator: string;
  anzahlProjektierteWohnungen: string;
  artDerArbeiten: string;
  artDerBauwerke: string;
  typDerBauwerke: string;
}
interface BodenbedeckungEntry { label: string; area: string; }
interface ZonenplanEntry    { zonentyp: string; gemeinde: string; flaeche: string; anteil: string; }
interface ContactInfo {
  office: string;
  person: string;
  street: string;
  city: string;
  phone: string;
  email: string;
  website: string;
}
interface OwnerAddress {
  label: string;
  value: string;
}
interface OwnerParty {
  name: string;
  addresses: OwnerAddress[];
}
interface OwnershipShareEntry {
  grundstueck: string;
  anteil?: string;
  eigentumsform: string;
  parteien: OwnerParty[];
}
interface OwnershipInfo {
  eigentumsform: string;
  parteien: OwnerParty[];
  beteiligungen?: OwnershipShareEntry[];
}
interface ObjectInfo {
  grundstueckNummer: string;
  egrid:             string;
  grundstueckArt:    string;
  eigentuemer:       OwnershipInfo;
  gemeinde:          string;
  bfsNr:             string;
  grundbuchNr:       string;
  flurname:          string;
  bodenbedeckung:       BodenbedeckungEntry[];
  grundnutzungZonenplan: ZonenplanEntry[];
  flaecheGrundbuch:      string;
  gebaeude:          BuildingInfo[];
  bauprojekte:       ProjectInfo[];
  nachfuehrungsgeometer: ContactInfo;
  grundbuchamtKontakt:   ContactInfo;
  // Grundstück-Sektion
  katasterwert:      string;
  dienstbarkeiten:   string[];
  anmerkungen:       string[];
  grundpfandrechte:  string[];
  erwerbsarten:      string[];
  offeneGeschaefte:  string[];
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const DUMMY_OWNERS: OwnershipInfo[] = [
  {
    eigentumsform: 'Überbauung mit mehreren Miteigentumsanteilen',
    parteien: [],
    beteiligungen: [
      {
        grundstueck: 'Kriens 13799',
        anteil: '150/1000',
        eigentumsform: 'Alleineigentum',
        parteien: [{ name: 'sovento AG', addresses: [{ label: 'Rechtsdomizil', value: 'Habsburgerstrasse 22, 6003 Luzern, Schweiz' }] }],
      },
      {
        grundstueck: 'Kriens 53838',
        anteil: '1/12',
        eigentumsform: 'Alleineigentum',
        parteien: [{ name: 'sovento AG', addresses: [{ label: 'Rechtsdomizil', value: 'Habsburgerstrasse 22, 6003 Luzern, Schweiz' }] }],
      },
      {
        grundstueck: 'Kriens 53842',
        anteil: '1/12',
        eigentumsform: 'Alleineigentum',
        parteien: [{ name: 'sovento AG', addresses: [{ label: 'Rechtsdomizil', value: 'Habsburgerstrasse 22, 6003 Luzern, Schweiz' }] }],
      },
      {
        grundstueck: 'Kriens 13806',
        anteil: '6/1000',
        eigentumsform: 'Alleineigentum',
        parteien: [{ name: 'sovento AG', addresses: [{ label: 'Rechtsdomizil', value: 'Habsburgerstrasse 22, 6003 Luzern, Schweiz' }] }],
      },
    ],
  },
  {
    eigentumsform: 'Gesamteigentum, einfache Gesellschaft',
    parteien: [
      {
        name: 'Müller Eva',
        addresses: [{ label: 'Wohnadresse', value: 'Holengraben 50, 5722 Gränichen, Schweiz' }],
      },
      {
        name: 'Müller Hans',
        addresses: [{ label: 'Wohnadresse', value: 'Holengraben 50, 5722 Gränichen, Schweiz' }],
      },
    ],
  },
  {
    eigentumsform: 'Alleineigentum',
    parteien: [
      {
        name: 'Ammann Gerhard',
        addresses: [{ label: 'Wohnadresse', value: 'Tannerstrasse 26, 5000 Aarau, Schweiz' }],
      },
    ],
  },
  {
    eigentumsform: 'Alleineigentum',
    parteien: [
      {
        name: '4sports & Entertainment AG, Zug (UID: CHE 110.554.246)',
        addresses: [{ label: 'Rechtsdomizil', value: 'Chamerstrasse 176, 6300 Zug, Schweiz' }],
      },
    ],
  },
  {
    eigentumsform: 'Alleineigentum',
    parteien: [
      {
        name: 'Schmidt Tim',
        addresses: [
          { label: 'Zustelladresse', value: '5001 Aarau 1, Schweiz' },
          { label: 'Wohnadresse', value: 'Hauptstrasse 11, 5000 Aarau, Schweiz' },
        ],
      },
    ],
  },
  {
    eigentumsform: 'Alleineigentum',
    parteien: [
      {
        name: 'Manor AG, Basel (UID: CHE 105.901.193)',
        addresses: [{ label: 'Rechtsdomizil', value: 'Rebgasse 34, 4058 Basel, Schweiz' }],
      },
    ],
  },
  {
    eigentumsform: 'Alleineigentum',
    parteien: [
      {
        name: 'Zumbach-Immobilien AG, Aarau (UID: CHE 115.010.404)',
        addresses: [{ label: 'Zustelladresse', value: 'c/o Jost Zumbach, Liebeggerweg 13, 5000 Aarau, Schweiz' }],
      },
    ],
  },
];
const DUMMY_GEMEINDEN: Array<{ name: string; bfs: string; gb: string }> = [
  { name: 'Adligenswil', bfs: '1051', gb: 'GB Adligenswil' },
  { name: 'Beromünster', bfs: '1081', gb: 'GB Beromünster' },
  { name: 'Buchrain', bfs: '1052', gb: 'GB Buchrain' },
  { name: 'Dierikon', bfs: '1053', gb: 'GB Dierikon' },
  { name: 'Ebikon', bfs: '1054', gb: 'GB Ebikon' },
  { name: 'Eich', bfs: '1084', gb: 'GB Eich' },
  { name: 'Emmen', bfs: '1055', gb: 'GB Emmen' },
  { name: 'Entlebuch', bfs: '1127', gb: 'GB Entlebuch' },
  { name: 'Escholzmatt-Marbach', bfs: '1150', gb: 'GB Escholzmatt-Marbach' },
  { name: 'Hochdorf', bfs: '1030', gb: 'GB Hochdorf' },
  { name: 'Horw', bfs: '1057', gb: 'GB Horw' },
  { name: 'Kriens', bfs: '1058', gb: 'GB Kriens' },
  { name: 'Luzern', bfs: '1061', gb: 'GB Luzern' },
  { name: 'Malters', bfs: '1062', gb: 'GB Malters' },
  { name: 'Meggen', bfs: '1063', gb: 'GB Meggen' },
  { name: 'Meierskappel', bfs: '1064', gb: 'GB Meierskappel' },
  { name: 'Nebikon', bfs: '1137', gb: 'GB Nebikon' },
  { name: 'Nottwil', bfs: '1092', gb: 'GB Nottwil' },
  { name: 'Oberkirch', bfs: '1093', gb: 'GB Oberkirch' },
  { name: 'Pfaffnau', bfs: '1140', gb: 'GB Pfaffnau' },
  { name: 'Rain', bfs: '1037', gb: 'GB Rain' },
  { name: 'Reiden', bfs: '1141', gb: 'GB Reiden' },
  { name: 'Root', bfs: '1065', gb: 'GB Root' },
  { name: 'Rothenburg', bfs: '1066', gb: 'GB Rothenburg' },
  { name: 'Ruswil', bfs: '1142', gb: 'GB Ruswil' },
  { name: 'Schenkon', bfs: '1096', gb: 'GB Schenkon' },
  { name: 'Schötz', bfs: '1143', gb: 'GB Schötz' },
  { name: 'Schüpfheim', bfs: '1139', gb: 'GB Schüpfheim' },
  { name: 'Sempach', bfs: '1097', gb: 'GB Sempach' },
  { name: 'Sursee', bfs: '1103', gb: 'GB Sursee' },
  { name: 'Udligenswil', bfs: '1067', gb: 'GB Udligenswil' },
  { name: 'Vitznau', bfs: '1068', gb: 'GB Vitznau' },
  { name: 'Wauwil', bfs: '1104', gb: 'GB Wauwil' },
  { name: 'Weggis', bfs: '1069', gb: 'GB Weggis' },
  { name: 'Willisau', bfs: '1151', gb: 'GB Willisau' },
  { name: 'Wolhusen', bfs: '1107', gb: 'GB Wolhusen' },
];
const DUMMY_FLURNAMEN: string[] = [
  'Allmend',         // Sehr verbreitet in Luzern (z.B. Stadt Luzern, Horw)
  'Santenberg',      // Bekannt im Seetal/Surersee-Region
  'Gfäsch',          // Typisch für das Entlebuch
  'Hostrich',        // Klassischer luzernischer Flurname
  'Under-Zelg',      // Häufig in ländlichen Gebieten wie Beromünster
  'Gormund',         // Bekannt durch die Kapelle/Schlacht bei Neudorf
  'Mülimatte',       // Klassischer Name entlang der Reuss oder Kleinen Emme
  'Blindei',         // Bekannt aus der Region Wolhusen
  'Chrotteloch',     // Urtypischer lokaler Flurname
  'Sonnenberg',      // Bekannt in Kriens/Luzern
  'Wauwilermoos',    // Markantes Gebiet in der Region Sursee
  'Gütsch',          // Typisch für Anhöhen (Stadt Luzern)
  'Rengg',           // Pass/Flurname im Entlebuch
  'Hinter-Bramberg'  // Historisches Quartier/Flur in Luzern
];
const DUMMY_BODENBEDECKUNG: BodenbedeckungEntry[][] = [
  [
    { label: 'Gartenanlage',             area: '692 m²' },
    { label: 'Gebäude (150)',             area: '277 m²' },
    { label: 'Gebäude (150a)',            area: '37 m²'  },
    { label: 'fliessendes Gewässer',      area: '7 m²'   },
    { label: 'übrige befestigte Fläche',  area: '251 m²' },
  ],
  [
    { label: 'Gebäude (12)',              area: '410 m²' },
    { label: 'Verkehrsfläche',            area: '185 m²' },
    { label: 'Gartenanlage',             area: '320 m²' },
  ],
  [
    { label: 'Landwirtschaftsfläche',     area: '1’840 m²' },
    { label: 'Gebäude (Scheune)',         area: '180 m²' },
  ],
  [
    { label: 'Wald',                     area: '2’300 m²' },
    { label: 'fliessendes Gewässer',      area: '45 m²'  },
  ],
  [
    { label: 'Gebäude (7)',               area: '560 m²' },
    { label: 'übrige befestigte Fläche',  area: '380 m²' },
    { label: 'Gartenanlage',             area: '210 m²' },
  ],
  [
    { label: 'Verkehrsfläche',            area: '900 m²' },
    { label: 'Best. ohne bes. Nutzung',  area: '120 m²' },
  ],
];
const DUMMY_GRUNDNUTZUNG: ZonenplanEntry[][] = [
  [
    { zonentyp: 'Strasse',                     gemeinde: 'Verkehrszone',           flaeche: '108 m²',  anteil: '14%'  },
    { zonentyp: 'Zentrumszone',               gemeinde: 'Zentrumszone Dorfkern', flaeche: '641 m²',  anteil: '86%'  },
  ],
  [
    { zonentyp: 'Wohnzone bis 14m',           gemeinde: 'Wohnzone W3 bis 14m',   flaeche: '920 m²',  anteil: '100%' },
  ],
  [
    { zonentyp: 'Arbeitszone',                gemeinde: 'Arbeitszone A',         flaeche: '1200 m²', anteil: '75%'  },
    { zonentyp: 'Strasse',                    gemeinde: 'Verkehrszone',          flaeche: '400 m²',  anteil: '25%'  },
  ],
  [
    { zonentyp: 'Wohnzone W3',                gemeinde: 'Wohnzone 3-geschossig', flaeche: '750 m²',  anteil: '62%'  },
    { zonentyp: 'Grünzone',                   gemeinde: 'Öffentliche Grünfläche', flaeche: '460 m²',  anteil: '38%'  },
  ],
  [
    { zonentyp: 'Industrie- / Arbeitszone',   gemeinde: 'Arbeitszone Industrie', flaeche: '3400 m²', anteil: '100%' },
  ],
  [
    { zonentyp: 'Wohnzone W4',                gemeinde: 'Wohnzone 4-geschossig', flaeche: '2100 m²', anteil: '88%'  },
    { zonentyp: 'Strasse',                    gemeinde: 'Verkehrszone',          flaeche: '290 m²',  anteil: '12%'  },
  ],
];
const DUMMY_ARTEN: string[] = [
  'Liegenschaft',
  'Selbständiges und dauerndes Recht (z. B. Baurecht)',
  'Bergwerk',
  'Miteigentumsanteil an Grundstück',
];
const DUMMY_BUILDINGS: BuildingInfo[] = [
  {
    nr: '609.140',
    versicherungsNr: 'GVL-447821',
    baujahrBauperiode: '1958',
    gebaeudekategorie: 'Wohnhaus',
    gebaeudestatus: 'bestehend',
    adresse: 'Sonnenbergstrasse 18, 6005 Luzern',
    koordinaten: '2’666’412 / 1’211’084',
    egid: '192557',
    verwaltungGebaeude: 'Livit AG, Luzern',
    versicherungswert: "CHF 1'280'000",
    anzahlWohnungen: '1',
  },
  {
    nr: '609.140a',
    versicherungsNr: 'GVL-447822',
    baujahrBauperiode: '1987',
    gebaeudekategorie: 'Carport / Velounterstand',
    gebaeudestatus: 'bestehend',
    adresse: 'Sonnenbergstrasse 18a, 6005 Luzern',
    koordinaten: '2’666’428 / 1’211’076',
    egid: '191911198',
    verwaltungGebaeude: 'Eigentümerschaft vor Ort',
    versicherungswert: "CHF 95'000",
    anzahlWohnungen: '0',
  },
  {
    nr: 'n.v.',
    versicherungsNr: 'GVL-558901',
    baujahrBauperiode: '1972-1975',
    gebaeudekategorie: 'Ökonomiegebäude / Stall',
    gebaeudestatus: 'bestehend',
    adresse: 'Hostrich 4, 6010 Kriens',
    koordinaten: '2’664’915 / 1’208’644',
    egid: '504085015',
    verwaltungGebaeude: 'Landgut Hostrich AG',
    versicherungswert: "CHF 420'000",
    anzahlWohnungen: '0',
  },
  {
    nr: '312.005',
    versicherungsNr: 'GVL-300214',
    baujahrBauperiode: '2008',
    gebaeudekategorie: 'Einfamilienhaus',
    gebaeudestatus: 'bestehend',
    adresse: 'Seeblickweg 12, 6045 Meggen',
    koordinaten: '2’671’103 / 1’214’552',
    egid: '200341872',
    verwaltungGebaeude: 'Privatverwaltung Meier',
    versicherungswert: "CHF 1'650'000",
    anzahlWohnungen: '1',
  },
  {
    nr: '415.002',
    versicherungsNr: 'GVL-118540',
    baujahrBauperiode: '1964',
    gebaeudekategorie: 'Nebengebäude',
    gebaeudestatus: 'abgebrochen',
    adresse: 'Mülimatte 6, 6204 Sempach',
    koordinaten: '2’655’441 / 1’220’910',
    egid: '300118540',
    verwaltungGebaeude: 'Gemeindeverwaltung Sempach',
    versicherungswert: "CHF 210'000",
    anzahlWohnungen: '3',
  },
  {
    nr: '120.010',
    versicherungsNr: 'GVL-552341',
    baujahrBauperiode: '2024-2025',
    gebaeudekategorie: 'Mehrfamilienhaus',
    gebaeudestatus: 'projektiert',
    adresse: 'Allmendpark 3, 6020 Emmenbrücke',
    koordinaten: '2’663’087 / 1’216’233',
    egid: '100552341',
    verwaltungGebaeude: 'Wincasa AG, Luzern',
    versicherungswert: "CHF 8'400'000",
    anzahlWohnungen: '12',
  },
  {
    nr: '710.001',
    versicherungsNr: 'GVL-880112',
    baujahrBauperiode: '1999-2001',
    gebaeudekategorie: 'Werkstatt',
    gebaeudestatus: 'bestehend',
    adresse: 'Industriestrasse 9, 6210 Sursee',
    koordinaten: '2’648’224 / 1’227’404',
    egid: '880112233',
    verwaltungGebaeude: 'Arealverwaltung Sursee AG',
    versicherungswert: "CHF 2'950'000",
    anzahlWohnungen: '0',
  },
  {
    nr: '710.001a',
    versicherungsNr: 'GVL-880234',
    baujahrBauperiode: '2025-2026',
    gebaeudekategorie: 'Anbau Werkstatt',
    gebaeudestatus: 'im Bau',
    adresse: 'Industriestrasse 9a, 6210 Sursee',
    koordinaten: '2’648’236 / 1’227’395',
    egid: '880112234',
    verwaltungGebaeude: 'Arealverwaltung Sursee AG',
    versicherungswert: "CHF 1'100'000",
    anzahlWohnungen: '0',
  },
  {
    nr: '221.040',
    versicherungsNr: 'GVL-665544',
    baujahrBauperiode: '2012',
    gebaeudekategorie: 'Einfamilienhaus',
    gebaeudestatus: 'bestehend',
    adresse: 'Gütschhöhe 21, 6003 Luzern',
    koordinaten: '2’665’081 / 1’212’638',
    egid: '770665544',
    verwaltungGebaeude: 'Privatverwaltung Hodel',
    versicherungswert: "CHF 1'780'000",
    anzahlWohnungen: '1',
  },
  {
    nr: '900.005',
    versicherungsNr: 'GVL-887766',
    baujahrBauperiode: '1981-1983',
    gebaeudekategorie: 'Trafostation',
    gebaeudestatus: 'bestehend',
    adresse: 'Stationsweg 2, 6030 Ebikon',
    koordinaten: '2’669’310 / 1’213’887',
    egid: '990887766',
    verwaltungGebaeude: 'CKW AG',
    versicherungswert: "CHF 380'000",
    anzahlWohnungen: '0',
  },
  {
    nr: '102.001',
    versicherungsNr: 'GVL-220330',
    baujahrBauperiode: '1911-2018',
    gebaeudekategorie: 'Wohn- und Geschäftshaus',
    gebaeudestatus: 'bestehend',
    adresse: 'Bahnhofstrasse 14, 6003 Luzern',
    koordinaten: '2’665’902 / 1’211’911',
    egid: '110220330',
    verwaltungGebaeude: 'Privera AG, Luzern',
    versicherungswert: "CHF 6'250'000",
    anzahlWohnungen: '6',
  }
];
const DUMMY_PROJECTS: ProjectInfo[] = [
  {
    dossierNr: '2025-0660',
    bezeichnung: 'Umnutzung Gebäude Nr. 134a zu Abstell- und Lagerfläche für Malerbetrieb (nachträglich) und Einbau Spaltanlage in Gebäude Nr. 134d',
    status: 'Leitentscheid',
    amtlicheBaudossierNr: '2026-0023',
    eidgProjektidentifikator: '191396826',
    anzahlProjektierteWohnungen: '5',
    artDerArbeiten: 'Umbau',
    artDerBauwerke: 'Hochbau',
    typDerBauwerke: 'Garagen',
  },
  {
    dossierNr: '2022-4426',
    bezeichnung: 'Neubau einer Niederspannungsrohranlage und Abbruch der bestehenden Freileitung',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2022-4426',
    eidgProjektidentifikator: 'CH-LU-INF-224426',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Neubau / Rückbau',
    artDerBauwerke: 'Infrastrukturanlage',
    typDerBauwerke: 'Energieversorgung',
  },
  {
    dossierNr: '2017-1977',
    bezeichnung: 'Anbau Garage + Holzschnitzellager',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2017-1977',
    eidgProjektidentifikator: 'CH-LU-ANB-171977',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Anbau',
    artDerBauwerke: 'Nebenbau',
    typDerBauwerke: 'Garage / Lager',
  },
  {
    dossierNr: '2026-0572',
    bezeichnung: 'Einbau Wohnung',
    status: 'Leitentscheid',
    amtlicheBaudossierNr: 'BDS-LU-2026-0572',
    eidgProjektidentifikator: 'CH-LU-WOH-260572',
    anzahlProjektierteWohnungen: '1',
    artDerArbeiten: 'Innenausbau / Umnutzung',
    artDerBauwerke: 'Bestandesbau',
    typDerBauwerke: 'Wohnbau',
  },
  {
    dossierNr: '2024-0637',
    bezeichnung: 'Fassadensanierung und Anbau Balkone',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2024-0637',
    eidgProjektidentifikator: 'CH-LU-SAN-240637',
    anzahlProjektierteWohnungen: '6',
    artDerArbeiten: 'Sanierung / Anbau',
    artDerBauwerke: 'Bestandesbau',
    typDerBauwerke: 'Mehrfamilienhaus',
  },
  {
    dossierNr: '2026-0812',
    bezeichnung: 'Installation einer Photovoltaikanlage auf der Südwestdachfläche und Ersatz der Ölheizung durch eine Luft-Wasser-Wärmepumpe',
    status: 'In Prüfung',
    amtlicheBaudossierNr: 'BDS-LU-2026-0812',
    eidgProjektidentifikator: 'CH-LU-ENE-260812',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Energetische Sanierung',
    artDerBauwerke: 'Dachanlage / Haustechnik',
    typDerBauwerke: 'Energieanlage',
  },
  {
    dossierNr: '2025-1104',
    bezeichnung: 'Neubau Einfamilienhaus mit integrierter Doppelgarage und Umgebungsgestaltung',
    status: 'Leitentscheid',
    amtlicheBaudossierNr: 'BDS-LU-2025-1104',
    eidgProjektidentifikator: 'CH-LU-NBH-251104',
    anzahlProjektierteWohnungen: '1',
    artDerArbeiten: 'Neubau',
    artDerBauwerke: 'Hauptbau mit Nebenanlage',
    typDerBauwerke: 'Einfamilienhaus',
  },
  {
    dossierNr: '2024-0945',
    bezeichnung: 'Erstellung einer Stützmauer entlang der Parzellengrenze Nr. 452 und Terrainanpassung',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2024-0945',
    eidgProjektidentifikator: 'CH-LU-TER-240945',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Tiefbau / Umgebung',
    artDerBauwerke: 'Stützmauer',
    typDerBauwerke: 'Terrainbauwerk',
  },
  {
    dossierNr: '2026-0123',
    bezeichnung: 'Abbruch des bestehenden Ökonomiegebäudes und Neubau eines Mehrfamilienhauses mit 6 Wohneinheiten',
    status: 'Auflage',
    amtlicheBaudossierNr: 'BDS-LU-2026-0123',
    eidgProjektidentifikator: 'CH-LU-MFH-260123',
    anzahlProjektierteWohnungen: '6',
    artDerArbeiten: 'Abbruch / Neubau',
    artDerBauwerke: 'Hauptbau',
    typDerBauwerke: 'Mehrfamilienhaus',
  },
  {
    dossierNr: '2025-0789',
    bezeichnung: 'Aussenwärmedämmung und Fenstersanierung bei Wohnhaus Nr. 22b',
    status: 'Leitentscheid',
    amtlicheBaudossierNr: 'BDS-LU-2025-0789',
    eidgProjektidentifikator: 'CH-LU-SAN-250789',
    anzahlProjektierteWohnungen: '2',
    artDerArbeiten: 'Sanierung',
    artDerBauwerke: 'Bestandesbau',
    typDerBauwerke: 'Wohnhaus',
  },
  {
    dossierNr: '2023-3310',
    bezeichnung: 'Erstellung einer ungedeckten Parkplatzfläche für 4 Fahrzeuge',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2023-3310',
    eidgProjektidentifikator: 'CH-LU-PAR-233310',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Neuanlage',
    artDerBauwerke: 'Nebenanlage',
    typDerBauwerke: 'Parkierungsanlage',
  },
  {
    dossierNr: '2026-0441',
    bezeichnung: 'Umnutzung Ladenlokal Erdgeschoss zu Büroflächen und Einbau einer rollstuhlgängigen Toilettenanlage',
    status: 'In Prüfung',
    amtlicheBaudossierNr: 'BDS-LU-2026-0441',
    eidgProjektidentifikator: 'CH-LU-UMN-260441',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Umnutzung / Innenausbau',
    artDerBauwerke: 'Bestandesbau',
    typDerBauwerke: 'Dienstleistungsbau',
  },
  {
    dossierNr: '2025-1256',
    bezeichnung: 'Ersatz der bestehenden Holzheizung durch eine Pelletheizung inkl. Kaminanlage an der Nordfassade',
    status: 'Leitentscheid',
    amtlicheBaudossierNr: 'BDS-LU-2025-1256',
    eidgProjektidentifikator: 'CH-LU-ENE-251256',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Heizungsersatz',
    artDerBauwerke: 'Haustechnikanlage',
    typDerBauwerke: 'Energieanlage',
  },
  {
    dossierNr: '2022-5501',
    bezeichnung: 'Sanierung und Erweiterung der bestehenden Jauchegrube auf Parzelle Nr. 118',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2022-5501',
    eidgProjektidentifikator: 'CH-LU-LAN-225501',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Sanierung / Erweiterung',
    artDerBauwerke: 'Nebenbau / Anlage',
    typDerBauwerke: 'Landwirtschaftsbau',
  },
  {
    dossierNr: '2026-0902',
    bezeichnung: 'Erstellung eines Wintergartens (unbeheizt) auf der Westseite des bestehenden Gebäudes Nr. 88',
    status: 'Auflage',
    amtlicheBaudossierNr: 'BDS-LU-2026-0902',
    eidgProjektidentifikator: 'CH-LU-ANB-260902',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Anbau',
    artDerBauwerke: 'Nebenbau',
    typDerBauwerke: 'Wintergarten',
  },
  {
    dossierNr: '2024-0318',
    bezeichnung: 'Ersatz Backofen mit neuer Kamin- und Lüftungsanlage',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2024-0318',
    eidgProjektidentifikator: 'CH-LU-GEW-240318',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Anlagenerneuerung',
    artDerBauwerke: 'Haustechnikanlage',
    typDerBauwerke: 'Gewerbebau',
  },
  {
    dossierNr: '2026-0674',
    bezeichnung: 'Installation einer Luft/Wasser-Wärmepumpe',
    status: 'Vernehmlassung',
    amtlicheBaudossierNr: 'BDS-LU-2026-0674',
    eidgProjektidentifikator: 'CH-LU-ENE-260674',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Technikinstallation',
    artDerBauwerke: 'Haustechnikanlage',
    typDerBauwerke: 'Wärmepumpe',
  },
  {
    dossierNr: '2026-0721',
    bezeichnung: 'Neubau von zwei Mehrfamilienhäusern mit Einstellhallen',
    status: 'Vernehmlassung',
    amtlicheBaudossierNr: 'BDS-LU-2026-0721',
    eidgProjektidentifikator: 'CH-LU-MFH-260721',
    anzahlProjektierteWohnungen: '18',
    artDerArbeiten: 'Neubau',
    artDerBauwerke: 'Hauptbauten mit Einstellhalle',
    typDerBauwerke: 'Mehrfamilienhäuser',
  },
  {
    dossierNr: '2025-1188',
    bezeichnung: 'Aufstockung best. Mehrfamilienhaus und Energetische Sanierung',
    status: 'Entscheidung',
    amtlicheBaudossierNr: 'BDS-LU-2025-1188',
    eidgProjektidentifikator: 'CH-LU-SAN-251188',
    anzahlProjektierteWohnungen: '4',
    artDerArbeiten: 'Aufstockung / Sanierung',
    artDerBauwerke: 'Bestandesbau',
    typDerBauwerke: 'Mehrfamilienhaus',
  },
  {
    dossierNr: '2023-2875',
    bezeichnung: 'Prov. Baustelleninstallation Seetalplatz',
    status: 'Abgeschlossen',
    amtlicheBaudossierNr: 'BDS-LU-2023-2875',
    eidgProjektidentifikator: 'CH-LU-BAU-232875',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Temporäre Installation',
    artDerBauwerke: 'Baustelleneinrichtung',
    typDerBauwerke: 'Provisorium',
  },
  {
    dossierNr: '2026-0836',
    bezeichnung: 'Windanlage auf Dach über Werk 1',
    status: 'Vernehmlassung',
    amtlicheBaudossierNr: 'BDS-LU-2026-0836',
    eidgProjektidentifikator: 'CH-LU-ENE-260836',
    anzahlProjektierteWohnungen: '0',
    artDerArbeiten: 'Anlageninstallation',
    artDerBauwerke: 'Dachaufbau',
    typDerBauwerke: 'Windenergieanlage',
  }
];

const DUMMY_KATASTERWERTE = [
  "CHF 850'000", "CHF 1'200'000", "CHF 430'000", "CHF 2'100'000", "CHF 680'000", "CHF 3'400'000",
];
const DUMMY_DIENSTBARKEITEN: string[][] = [
  ['Wegrecht zugunsten Parz. 412', 'Leitungsrecht EW Luzern'],
  ['Baurecht Nr. 1024 (BRB 2005)', 'Näherbaurecht'],
  [],
  ['Fusswegrecht zugunsten Gemeinde'],
  ['Leitungsrecht Swisscom', 'Grenzbaurecht Parz. 881', 'Wegrecht'],
  [],
];
const DUMMY_ANMERKUNGEN: string[][] = [
  ['Altlastenverdachtsstandort (KbS-Nr. 1234)'],
  [],
  ['Denkmalschutzobjekt Kat. B', 'Innerhalb Gefahrenzone Wasser'],
  [],
  ['Im Bereich Lärmschutzzone'],
  ['Perimeter Gebäudeversicherung angepasst'],
];
const DUMMY_GRUNDPFANDRECHTE: string[][] = [
  ["Schuldbrief CHF 500'000 (Luzerner Kantonalbank)"],
  ["Schuldbrief CHF 780'000 (UBS AG)", "Schuldbrief CHF 200'000 (Raiffeisen)"],
  [],
  ["Inhaberschuldbrief CHF 1'000'000"],
  [],
  ["Schuldbrief CHF 300'000 (ZKB)"],
];
const DUMMY_ERWERBSARTEN: string[][] = [
  ['Hans Muster: Kauf 01.01.2026', 'Peter Müller: Erbvertrag 15.10.2001'],
  ['Sandra Wolf: Kauf 14.03.2021'],
  ['Anna Keller: Schenkung 22.06.2015', 'Anna Keller: Erbteilung 22.06.2015'],
  ['Peter Bauer: Kauf 08.11.2003'],
  ['Maria Meier: Zwangsversteigerung 03.05.2019'],
  ['Hans Müller: Kauf 17.09.2012', 'Vreni Müller: Kauf 04.04.2001'],
];
const DUMMY_OFFENE_GESCHAEFTE: string[][] = [
  ['Eigentumsübertragung in Bearbeitung'],
  [],
  ['Servitutsänderung pendent'],
  ['Mutation (Grenzbereinigung) pendent', 'Planauflage läuft'],
  [],
  ['Pfandentlassung in Bearbeitung'],
];
const DUMMY_NACHFUEHRUNGSGEOMETER: ContactInfo[] = [
  {
    office: 'Ing.- und Vermessungsbüro Hans Ammann AG',
    person: 'Würsch Martin',
    street: 'Hauptstrasse 9',
    city: '6280 Hochdorf',
    phone: '041 914 60 00',
    email: 'info@ing-ammann.ch',
    website: 'ing-ammann.ch',
  },
  {
    office: 'Emch+Berger WSB AG',
    person: 'Erwin Vogel',
    street: 'Rüeggisingerstrasse 41',
    city: '6020 Emmenbrücke',
    phone: '041 269 40 00',
    email: 'info@emchberger.ch',
    website: 'emchberger.ch',
  },
  {
    office: 'Hans Ammann AG',
    person: 'Martin Würsch',
    street: 'Hauptstrasse 9',
    city: '6280 Hochdorf',
    phone: '041 914 60 00',
    email: 'info@ing-ammann.ch',
    website: 'ing-ammann.ch',
  },
  {
    office: 'Kost + Partner AG',
    person: 'Samuel Bühler',
    street: 'Industriestrasse 14',
    city: '6210 Sursee',
    phone: '041 926 06 06',
    email: 'info@kost-partner.ch',
    website: 'kost-partner.ch',
  },
  {
    office: 'Heini Geomatik AG',
    person: 'Andreas Heini',
    street: 'Vorstadt 19',
    city: '6130 Willisau',
    phone: '041 972 79 00',
    email: 'info@heinigeomatik.ch',
    website: 'heinigeomatik.ch',
  },
  {
    office: 'geopoint lütolf ag',
    person: 'Gregor Lütolf',
    street: 'Dorf 33',
    city: '6162 Entlebuch',
    phone: '041 482 60 00',
    email: 'info@geopoint-luetolf.ch',
    website: 'geopoint-luetolf.ch',
  },
];
const DUMMY_GRUNDBUCHAEMTER: ContactInfo[] = [
  {
    office: 'Grundbuchamt Luzern Ost – Geschäftsstelle Hochdorf',
    person: 'Grundbuchamt Luzern Ost',
    street: 'Hauptstrasse 5',
    city: '6280 Hochdorf',
    phone: '041 318 12 50',
    email: 'gbho@lu.ch',
    website: 'grundbuch.lu.ch',
  },
  {
    office: 'Grundbuchamt Luzern West',
    person: 'Grundbuchamt Luzern West',
    street: 'Bahnhofstrasse 5',
    city: '6170 Schüpfheim',
    phone: '041 228 39 00',
    email: 'gbsc@lu.ch',
    website: 'grundbuch.lu.ch',
  },
  {
    office: 'Grundbuchamt Luzern Ost – Geschäftsstelle Kriens',
    person: 'Grundbuchamt Luzern Ost',
    street: 'Meisterstrasse 4',
    city: '6010 Kriens',
    phone: '041 318 12 00',
    email: 'gbkr@lu.ch',
    website: 'grundbuch.lu.ch',
  },
];

function buildDummyInfo(seed: string, nummer?: string, egrid?: string): ObjectInfo {
  const h = hashStr(seed);
  const gemeinde = DUMMY_GEMEINDEN[h % DUMMY_GEMEINDEN.length];
  const flaeche = 200 + (h % 4800);
  return {
    grundstueckNummer: nummer ?? `${1000 + (h % 8000)}`,
    egrid:             egrid  ?? `CH${String(h % 1000000000000).padStart(12, '0')}`,
    grundstueckArt:    DUMMY_ARTEN[h % DUMMY_ARTEN.length],
    eigentuemer:       DUMMY_OWNERS[h % DUMMY_OWNERS.length],
    gemeinde:          gemeinde.name,
    bfsNr:             gemeinde.bfs,
    grundbuchNr:       gemeinde.gb,
    flurname:          DUMMY_FLURNAMEN[h % DUMMY_FLURNAMEN.length],
    bodenbedeckung:       DUMMY_BODENBEDECKUNG[h % DUMMY_BODENBEDECKUNG.length],
    grundnutzungZonenplan: DUMMY_GRUNDNUTZUNG[h % DUMMY_GRUNDNUTZUNG.length],
    flaecheGrundbuch:      `${flaeche.toLocaleString('de-CH')} m²`,
    gebaeude:          DUMMY_BUILDINGS.slice(0, 1 + (h % 3)),
    bauprojekte:       DUMMY_PROJECTS.slice(0, 1 + (h % Math.min(DUMMY_PROJECTS.length, 5))),
    nachfuehrungsgeometer: DUMMY_NACHFUEHRUNGSGEOMETER[h % DUMMY_NACHFUEHRUNGSGEOMETER.length],
    grundbuchamtKontakt:   DUMMY_GRUNDBUCHAEMTER[h % DUMMY_GRUNDBUCHAEMTER.length],
    katasterwert:      DUMMY_KATASTERWERTE[h % DUMMY_KATASTERWERTE.length],
    dienstbarkeiten:   DUMMY_DIENSTBARKEITEN[h % DUMMY_DIENSTBARKEITEN.length],
    anmerkungen:       DUMMY_ANMERKUNGEN[h % DUMMY_ANMERKUNGEN.length],
    grundpfandrechte:  DUMMY_GRUNDPFANDRECHTE[h % DUMMY_GRUNDPFANDRECHTE.length],
    erwerbsarten:      DUMMY_ERWERBSARTEN[h % DUMMY_ERWERBSARTEN.length],
    offeneGeschaefte:  DUMMY_OFFENE_GESCHAEFTE[h % DUMMY_OFFENE_GESCHAEFTE.length],
  };
}

function infoFromParcel(p: RealParcelProps): ObjectInfo {
  return buildDummyInfo(p.EGRIS_EGRID ?? p.Nummer ?? 'parcel', p.Nummer, p.EGRIS_EGRID);
}

interface SearchResult { label: string; subLabel: string; info: ObjectInfo; }

function buildSearchResults(query: string): SearchResult[] {
  return [0, 1].map(i => {
    const info = buildDummyInfo(query + i);
    return {
      label: `Grundstück ${info.grundstueckNummer} (${info.grundstueckArt})`,
      subLabel: `${info.egrid} — ${info.gemeinde}`,
      info,
    };
  });
}

// ─── Fixed-position overlays ──────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed', bottom: 'clamp(12px, 4vw, 32px)', left: 'clamp(12px, 4vw, 32px)', zIndex: 1000,
      width: 'min(360px, calc(100vw - 24px))',
      background: 'rgba(255,255,255,0.92)', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      padding: '12px 14px',
      fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 18 }}>⏳</span> Loading parcels…
    </div>
  );
}

function ErrorBox({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 'clamp(12px, 4vw, 32px)', left: 'clamp(12px, 4vw, 32px)', zIndex: 1000,
      width: 'min(420px, calc(100vw - 24px))',
      background: '#fff3f3', border: '1px solid #f5c5c5', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: '12px 14px', minWidth: 'unset',
      fontSize: 13, color: '#c0392b',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Error</strong>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}
          aria-label="Close">×</button>
      </div>
      <div style={{ marginTop: 6 }}>{message}</div>
    </div>
  );
}

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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}

function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        onClick={collapsible ? () => setOpen((value) => !value) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: open ? 8 : 0,
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: collapsible ? 'none' : 'auto',
        }}
        aria-expanded={collapsible ? open : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <SectionIcon title={title} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {title}
          </div>
        </div>

        {collapsible && (
          <span style={{ color: '#3388ff', fontWeight: 700, fontSize: 12 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>}
      <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: '12px 0 0 0' }} />
    </div>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px 14px', flexWrap: 'wrap', fontSize: 13, lineHeight: 1.45 }}>
      <span style={{ color: '#6b7280', flex: '1 1 140px', fontSize: 12 }}>{label}</span>
      <div style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'left', fontSize: mono ? 12 : 13, maxWidth: '100%', flex: '1 1 180px', wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function InlineMetaIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 14,
        height: 14,
        flexShrink: 0,
      }}
    >
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b7280', justifyContent: 'flex-start' }}>
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
        <div key={`${partei.name}-${index}`} style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{partei.name}</div>
          {partei.addresses.map((address, addressIndex) => (
            <div key={`${address.label}-${addressIndex}`} style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.45 }}>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{address.label}:</span>{' '}
              <span>{address.value}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div style={{ display: 'grid', gap: 8, width: '100%', textAlign: 'left' }}>
      <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{info.eigentumsform}</div>
      {info.beteiligungen?.length ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {info.beteiligungen.map((beteiligung, index) => (
            <div key={`${beteiligung.grundstueck}-${index}`} style={{ display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 8, background: '#fafafa', border: '1px solid #eceff3' }}>
              <div style={{ fontWeight: 700, color: '#1a1a1a' }}>
                {beteiligung.grundstueck}
                {beteiligung.anteil ? <span style={{ color: '#6b7280', fontWeight: 600 }}> ({beteiligung.anteil})</span> : null}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{beteiligung.eigentumsform}</div>
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
  const actionStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 999,
    background: '#f4f4f5',
    color: '#111',
    textDecoration: 'none',
    flexShrink: 0,
  } as const;
  const linkStyle = { color: '#4b5563', textDecoration: 'none' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, padding: '11px 12px', borderRadius: 10, background: '#fcfcfc', border: '1px solid #f1f1f1' }}>
      <span style={{ color: '#6b7280', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, lineHeight: 1.4, flex: '1 1 180px' }}>
          <span style={{ fontWeight: 700, color: '#111827' }}>{contact.office}</span>
          <span style={{ color: '#4b5563' }}>{contact.person}</span>
        </div>
        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <a href={phoneHref} aria-label={`Telefon ${label}`} style={actionStyle}><LuPhone size={13} /></a>
          <a href={`mailto:${contact.email}`} aria-label={`E-Mail ${label}`} style={actionStyle}><LuMail size={13} /></a>
          <a href={webHref} target="_blank" rel="noreferrer" aria-label={`Website ${label}`} style={actionStyle}><LuGlobe size={13} /></a>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, color: '#4b5563', lineHeight: 1.4 }}>
        <span>{contact.street}</span>
        <span>{contact.city}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 12 }}>
        <a href={phoneHref} style={linkStyle}>{contact.phone}</a>
        <a href={`mailto:${contact.email}`} style={linkStyle}>{contact.email}</a>
        <a href={webHref} target="_blank" rel="noreferrer" style={linkStyle}>{contact.website}</a>
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function handleDummyPdfExport(info: ObjectInfo, isAuthenticated: boolean) {
  const popup = window.open('', '_blank', 'width=900,height=700');
  if (!popup) {
    window.alert('Bitte Pop-ups erlauben, um den PDF-Export zu öffnen.');
    return;
  }

  const renderList = (title: string, values: string[]) => `
    <div class="block">
      <h3>${title}</h3>
      <p>${values.length ? escapeHtml(values.join(', ')) : '—'}</p>
    </div>
  `;

  const renderProtectedValue = (value: string) => isAuthenticated ? escapeHtml(value) : 'Login erforderlich';
  const renderProtectedList = (title: string, values: string[]) => renderList(title, isAuthenticated ? values : ['Login erforderlich']);
  const renderPartyHtml = (partei: OwnerParty) => `
    <div style="margin-top: 6px;">
      <strong>${escapeHtml(partei.name)}</strong><br />
      ${partei.addresses.map((address) => `${escapeHtml(address.label)}: ${escapeHtml(address.value)}`).join('<br />')}
    </div>
  `;
  const renderOwnershipBlock = (title: string, ownerInfo: OwnershipInfo) => {
    if (!isAuthenticated) {
      return `
        <div class="block">
          <h3>${title}</h3>
          <p>Login erforderlich</p>
        </div>
      `;
    }

    const ownershipDetails = ownerInfo.beteiligungen?.length
      ? ownerInfo.beteiligungen.map((beteiligung) => `
          <div style="margin-top: 8px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <strong>${escapeHtml(beteiligung.grundstueck)}${beteiligung.anteil ? ` (${escapeHtml(beteiligung.anteil)})` : ''}</strong><br />
            <span style="color: #6b7280;">${escapeHtml(beteiligung.eigentumsform)}</span>
            ${beteiligung.parteien.map(renderPartyHtml).join('')}
          </div>
        `).join('')
      : ownerInfo.parteien.map(renderPartyHtml).join('');

    return `
      <div class="block">
        <h3>${title}</h3>
        <p><strong>${escapeHtml(ownerInfo.eigentumsform)}</strong></p>
        ${ownershipDetails}
      </div>
    `;
  };

  const renderContact = (title: string, contact: ContactInfo) => `
    <div class="block">
      <h3>${title}</h3>
      <p>
        <strong>${escapeHtml(contact.office)}</strong><br />
        ${escapeHtml(contact.person)}<br />
        ${escapeHtml(contact.street)}<br />
        ${escapeHtml(contact.city)}<br />
        ${escapeHtml(contact.phone)}<br />
        ${escapeHtml(contact.email)}<br />
        ${escapeHtml(contact.website)}
      </p>
    </div>
  `;

  const buildingRows = info.gebaeude.map(g => `
    <tr>
      <td>${escapeHtml(g.nr)}</td>
      <td>${escapeHtml(g.versicherungsNr || '—')}</td>
      <td>${escapeHtml(g.baujahrBauperiode || '—')}</td>
      <td>${escapeHtml(g.gebaeudekategorie || '—')}</td>
      <td>${escapeHtml(g.gebaeudestatus || '—')}</td>
      <td>${escapeHtml(g.adresse || '—')}</td>
      <td>${escapeHtml(g.koordinaten || '—')}</td>
      <td>${escapeHtml(g.egid)}</td>
      <td>${isAuthenticated ? escapeHtml(g.verwaltungGebaeude || '—') : 'Login erforderlich'}</td>
      <td>${isAuthenticated ? escapeHtml(g.versicherungswert || '—') : 'Login erforderlich'}</td>
      <td>${isAuthenticated ? escapeHtml(g.anzahlWohnungen || '—') : 'Login erforderlich'}</td>
    </tr>
  `).join('');

  const projectRows = info.bauprojekte.map(p => `
    <tr>
      <td>${escapeHtml(p.dossierNr)}</td>
      <td>${escapeHtml(p.bezeichnung)}</td>
      <td>${escapeHtml(p.status)}</td>
    </tr>
  `).join('');

  popup.document.write(`
    <!doctype html>
    <html lang="de">
      <head>
        <meta charset="UTF-8" />
        <title>Grundstück ${escapeHtml(info.grundstueckNummer)} – Export</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; padding: 24px; line-height: 1.45; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          h2 { margin: 24px 0 8px; font-size: 15px; text-transform: uppercase; color: #4b5563; }
          h3 { margin: 0 0 4px; font-size: 13px; color: #374151; }
          p { margin: 0; }
          .meta { color: #6b7280; margin-bottom: 16px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
          .block { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 4px; text-align: left; font-size: 12px; vertical-align: top; }
          th { color: #6b7280; font-size: 11px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <h1>Grundstück ${escapeHtml(info.grundstueckNummer)}</h1>
        <div class="meta">Dummy-PDF-Export – alle verfügbaren Grundstücksdaten</div>

        <h2>Stammdaten</h2>
        <div class="grid">
          <div class="block"><h3>EGRID</h3><p>${escapeHtml(info.egrid)}</p></div>
          <div class="block"><h3>Gemeinde</h3><p>${escapeHtml(info.gemeinde)} (${escapeHtml(info.bfsNr)})</p></div>
          <div class="block"><h3>Grundbuch</h3><p>${escapeHtml(info.grundbuchNr)}</p></div>
          <div class="block"><h3>Grundstückart</h3><p>${escapeHtml(info.grundstueckArt)}</p></div>
          <div class="block"><h3>Flurname</h3><p>${escapeHtml(info.flurname)}</p></div>
          <div class="block"><h3>Fläche</h3><p>${escapeHtml(info.flaecheGrundbuch)}</p></div>
        </div>

        <h2>Grundstück</h2>
        <div class="grid">
          ${renderOwnershipBlock('Eigentümer', info.eigentuemer)}
          <div class="block"><h3>Katasterwert</h3><p>${renderProtectedValue(info.katasterwert)}</p></div>
        </div>
        ${renderProtectedList('Dienstbarkeiten / Grundlasten', info.dienstbarkeiten)}
        ${renderProtectedList('Anmerkungen', info.anmerkungen)}
        ${renderProtectedList('Grundpfandrechte', info.grundpfandrechte)}
        ${renderProtectedList('Erwerbsarten', info.erwerbsarten)}
        ${renderProtectedList('Offene Geschäfte', info.offeneGeschaefte)}

        <h2>Gebäude</h2>
        <table>
          <thead><tr><th>Nr.</th><th>Versicherungs-Nr.</th><th>Baujahr / Bauperiode</th><th>Gebäudekategorie</th><th>Gebäudestatus</th><th>Adresse</th><th>Koordinaten</th><th>EGID</th><th>Verwaltung Gebäude</th><th>Versicherungswert</th><th>Anzahl Wohnungen</th></tr></thead>
          <tbody>${buildingRows}</tbody>
        </table>

        <h2>Bauprojekte</h2>
        <table>
          <thead><tr><th>Dossier</th><th>Bezeichnung</th><th>Status</th></tr></thead>
          <tbody>${projectRows}</tbody>
        </table>

        <h2>Zuständige Stellen</h2>
        ${renderContact('Nachführungsgeometer', info.nachfuehrungsgeometer)}
        ${renderContact('Grundbuchamt', info.grundbuchamtKontakt)}
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 200);
}

function ExportSection({ info, isAuthenticated }: { info: ObjectInfo; isAuthenticated: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 0' }}>
      <span style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.45 }}>
        Exportiere alle aktuell verfügbaren Grundstücksdaten als PDF über den Browser-Druckdialog.
      </span>
      <button
        onClick={() => handleDummyPdfExport(info, isAuthenticated)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: 'flex-end',
          padding: '9px 12px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: '#fff',
          color: '#111827',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <LuDownload size={14} /> Als PDF exportieren
      </button>
    </div>
  );
}

type ChatMessage = { role: 'assistant' | 'user'; text: string };
type FaqMatcherEntry = { keywords: string[]; answer: string };

const CHATBOT_LUZERN_BLUE = '#009fe3';
const DUMMY_CHATBOT_GREETING = 'Guten Tag! Ich bin der Chatbot vom Kanton Luzern. Ich unterstütze Sie bei Fragen im Zusammenhang mit dem Objektwesen.\nDa ich noch lerne, ist es möglich, dass ich nicht jede Frage korrekt beantworten kann.\nWie kann ich Ihnen helfen?';

export const faqMatcher: FaqMatcherEntry[] = [
  {
    keywords: ['funktioniert', 'wie funktioniert', 'erklarung', 'was ist das', 'wie lauft das'],
    answer: 'Diese Anwendung zeigt geografische Daten auf einer interaktiven Karte. Klicken Sie auf ein Grundstück, um Informationen dazu zu erhalten.'
  },
  {
    keywords: ['hallo', 'hi', 'hey', 'guten tag'],
    answer: 'Hallo 🙂 Wie kann ich Ihnen helfen?'
  },
  {
    keywords: ['wie geht', 'wie geht es dir', 'alles gut'],
    answer: 'Danke 🙂 Ich bin ein Demo-Chatbot und jederzeit bereit zu helfen.'
  },
  {
    keywords: ['wer bist du', 'was bist du', 'bot', 'chatbot'],
    answer: 'Ich bin ein einfacher Chatbot und helfe Ihnen bei Fragen zu dieser Kartenanwendung.'
  },
  {
    keywords: ['wer steckt dahinter', 'entwickler', 'firma', 'anbieter'],
    answer: 'Diese Anwendung ist ein Prototyp und wurde zu Demonstrationszwecken entwickelt.'
  },
  {
    keywords: ['geo luzern', 'kanton luzern geo', 'geodaten luzern'],
    answer: 'Die Geoinformation des Kantons Luzern stellt geografische Daten wie Grundstücke, Karten und Luftbilder bereit.'
  },
  {
    keywords: ['wie bedienen', 'bedienung', 'wie nutzen', 'anleitung'],
    answer: 'Sie können die Karte bewegen, zoomen und auf Grundstücke klicken, um Informationen zu erhalten.'
  },
  {
    keywords: ['hilfe', 'support', 'kontakt', 'wer hilft'],
    answer: 'Bitte wenden Sie sich an die zuständige Fachstelle oder den Betreiber der Anwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne helfe ich weiter. Stellen Sie mir einfach Ihre Frage zum Objektwesen oder zur Kartenanwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin für Sie da. Beschreiben Sie kurz Ihr Anliegen, dann versuche ich zu helfen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Natürlich. Sie können mir eine Frage zu Grundstücken, Daten oder zur Bedienung der Karte stellen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn etwas unklar ist, fragen Sie mich einfach. Ich unterstütze Sie gerne im Rahmen dieser Demo.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen allgemeine Hinweise zur Anwendung und zu den angezeigten Grundstücksdaten geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Teilen Sie mir bitte mit, wobei Sie Unterstützung benötigen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie können mich beispielsweise zur Karte, zu Parzellen oder zur Nutzung der Anwendung befragen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne. Ich beantworte einfache Fragen zur Demo-Anwendung so gut ich kann.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Bitte formulieren Sie Ihre Frage möglichst konkret, damit ich besser unterstützen kann.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich helfe Ihnen gerne beim Verständnis der Kartenansicht und der Grundstücksinformationen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie möchten, können Sie direkt eine Frage zu einem Grundstück oder zu den Daten stellen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin ein Demo-Chatbot und gebe Ihnen gerne eine erste Orientierung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Fragen Sie mich ruhig – ich versuche, verständlich und kurz zu antworten.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen erklären, wie die Anwendung funktioniert und welche Informationen angezeigt werden.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Falls Sie Unterstützung brauchen, schreiben Sie einfach Ihr Anliegen in einem Satz.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Gerne unterstütze ich Sie bei allgemeinen Fragen zum Objektwesen und zur Kartenbedienung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie dürfen mir jederzeit eine neue Frage stellen, wenn etwas unklar geblieben ist.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin zwar noch in der Demo-Phase, aber ich versuche, nützliche Hinweise zu geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wobei darf ich Sie aktuell unterstützen?' 
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Sie können mich nach der Bedeutung von Datenfeldern oder nach der Bedienung fragen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich unterstütze Sie gerne bei ersten Fragen rund um diese Demo des Kantons Luzern.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie möchten, beginnen Sie mit einer kurzen Frage wie zum Beispiel: Was zeigt diese Karte?'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen bei der Orientierung in der Anwendung eine erste Hilfestellung geben.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Schreiben Sie mir einfach, was Sie wissen möchten.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich beantworte gern allgemeine Fragen zu Karte, Grundstücken und verfügbaren Informationen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Wenn Sie Hilfe brauchen, formuliere ich auch gerne eine kurze Erklärung zur Anwendung.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich kann Ihnen eine erste Auskunft geben – für verbindliche Angaben wenden Sie sich bitte an die zuständige Stelle.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Probieren Sie es einfach mit einer konkreten Frage, ich antworte so gut wie möglich.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich bin bereit. Welche Information suchen Sie?' 
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Bei Unsicherheiten zur Nutzung der Anwendung können Sie mich jederzeit ansprechen.'
  },
  {
    keywords: ['hilfe', 'helfen', 'hilf', 'help', 'frage', 'fragen', 'unklar', 'wissen', 'jetzt'],
    answer: 'Ich unterstütze Sie gerne mit allgemeinen Antworten rund um diese Kartenanwendung.'
  },
  {
    keywords: ['daten', 'woher daten', 'quelle', 'herkunft'],
    answer: 'Die Daten stammen aus offiziellen Geodiensten des Kantons Luzern.'
  },
  {
    keywords: ['kosten', 'gratis', 'preis', 'bezahlen'],
    answer: 'Diese Demo-Anwendung ist kostenlos nutzbar.'
  },
  {
    keywords: ['grundstuck', 'parzelle', 'land', 'flache'],
    answer: 'Ein Grundstück ist eine abgegrenzte Fläche Land mit eigener Nummer und Nutzung.'
  },
  {
    keywords: ['karte', 'map', 'ansicht', 'layer', 'karteninhalt'],
    answer: 'Die Karte zeigt geografische Informationen und dient zur Navigation und Analyse.'
  },
  {
    keywords: ['zoom', 'vergrossern', 'verkleinern'],
    answer: 'Sie können mit dem Mausrad oder Touch-Gesten hinein- und herauszoomen.'
  },
  {
    keywords: ['klicken', 'auswahlen', 'antippen'],
    answer: 'Klicken Sie auf ein Grundstück, um Details dazu anzuzeigen.'
  },
  {
    keywords: ['fehler', 'geht nicht', 'problem', 'bug'],
    answer: 'Es scheint ein Problem zu geben. Bitte laden Sie die Seite neu oder versuchen Sie es später erneut.'
  },
  {
    keywords: ['mobile', 'handy', 'smartphone'],
    answer: 'Die Anwendung funktioniert auch auf mobilen Geräten mit Touch-Bedienung.'
  },
  {
    keywords: ['browser', 'chrome', 'firefox', 'safari'],
    answer: 'Die Anwendung läuft in modernen Webbrowsern wie Chrome, Firefox oder Safari.'
  },
  {
    keywords: ['genauigkeit', 'prazision', 'wie genau'],
    answer: 'Die Genauigkeit hängt von den zugrunde liegenden Geodaten ab und kann variieren.'
  },
  {
    keywords: ['aktualitat', 'update', 'wie aktuell'],
    answer: 'Die Daten werden regelmässig aktualisiert, jedoch kann es zu Verzögerungen kommen.'
  },
  {
    keywords: ['mehr infos', 'details', 'weitere infos'],
    answer: 'Weitere Informationen sind in einer erweiterten Version oder bei den offiziellen Stellen verfügbar.'
  }
];

function normalizeChatText(value: string): string {

  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function questionMatchesKeyword(normalizedQuestion: string, questionWords: string[], keyword: string): boolean {
  const normalizedKeyword = normalizeChatText(keyword).trim();
  if (!normalizedKeyword) return false;

  if (normalizedKeyword.includes(' ')) {
    return normalizedQuestion.includes(normalizedKeyword);
  }

  return questionWords.includes(normalizedKeyword);
}

function getFaqAnswer(question: string, previousAnswer?: string | null): string {
  const normalizedQuestion = normalizeChatText(question);
  const questionWords = normalizedQuestion.split(/[^a-z0-9]+/).filter(Boolean);

  const matchingAnswers = faqMatcher
    .filter(entry => entry.keywords.some(keyword => questionMatchesKeyword(normalizedQuestion, questionWords, keyword)))
    .map(entry => entry.answer);

  if (matchingAnswers.length === 0) {
    return 'Danke für Ihre Nachricht. Dies ist aktuell ein Dummy-Chatbot des Kantons Luzern und dient nur zur Demo.';
  }

  const uniqueAnswers = Array.from(new Set(matchingAnswers));
  const answerPool = previousAnswer && uniqueAnswers.length > 1
    ? uniqueAnswers.filter(answer => answer !== previousAnswer)
    : uniqueAnswers;

  return answerPool[Math.floor(Math.random() * answerPool.length)];
}

function LuzernChatFabIcon({ size = 28, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path
        d="M9 7.5h14A4.5 4.5 0 0 1 27.5 12v6A4.5 4.5 0 0 1 23 22.5h-4.6L12 27v-4.5H9A4.5 4.5 0 0 1 4.5 18v-6A4.5 4.5 0 0 1 9 7.5Z"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 13h10M11 16.5h7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function DummyChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [lastFaqAnswer, setLastFaqAnswer] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: DUMMY_CHATBOT_GREETING },
  ]);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [open, messages]);

  const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const answer = getFaqAnswer(text, lastFaqAnswer);

    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'assistant', text: answer },
    ]);
    setLastFaqAnswer(answer);
    setDraft('');
  };

  return (
    <>
      {open && (
        <div style={{
          position: 'fixed',
          right: 8,
          bottom: 88,
          width: 'min(360px, calc(100vw - 16px))',
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: 'min(70vh, 520px)',
          background: '#fff',
          border: '1px solid #d9e7ef',
          borderRadius: 16,
          boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          zIndex: 1700,
        }}>
          <div style={{
            background: CHATBOT_LUZERN_BLUE,
            color: '#fff',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
              <LuzernChatFabIcon size={18} />
              Chatbot Kanton Luzern
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
              aria-label="Chatbot schliessen"
            >
              <LuX size={18} />
            </button>
          </div>

          <div
            ref={messagesRef}
            style={{
              maxHeight: 'min(42vh, 320px)',
              overflowY: 'auto',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#f7fbfe',
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: message.role === 'user' ? '#dff2fd' : '#fff',
                  color: '#1f2937',
                  border: message.role === 'user' ? '1px solid #c5e8fb' : '1px solid #e8eef2',
                  borderRadius: 12,
                  padding: '9px 10px',
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-line',
                }}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, borderTop: '1px solid #eef2f6', background: '#fff' }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Frage eingeben …"
              style={{
                flex: '1 1 180px',
                minWidth: 0,
                border: '1px solid #d1d5db',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                border: 'none',
                borderRadius: 10,
                background: CHATBOT_LUZERN_BLUE,
                color: '#fff',
                padding: '10px 12px',
                minHeight: 40,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Senden
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Chatbot schliessen' : 'Chatbot öffnen'}
        title="Chatbot"
        style={{
          position: 'fixed',
          right: 'clamp(12px, 4vw, 24px)',
          bottom: 'clamp(12px, 4vw, 20px)',
          width: 62,
          height: 62,
          borderRadius: 999,
          border: 'none',
          background: CHATBOT_LUZERN_BLUE,
          color: '#fff',
          boxShadow: '0 10px 22px rgba(0, 159, 227, 0.32)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1700,
        }}
      >
        <LuzernChatFabIcon size={36} />
      </button>
    </>
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
    <span title={title} aria-hidden="true" style={{ display: 'inline-flex', width: 12, height: 12, flexShrink: 0, marginTop: 2 }}>
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
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Grundnutzung Zonenplan</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', overflowX: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0 8px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
              <span>Zonentyp</span>
              <span>Gemeinde</span>
              <span style={{ textAlign: 'right' }}>Fläche</span>
              <span style={{ textAlign: 'right' }}>Anteil</span>
            </div>
            {entries.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0 8px', fontSize: 12, alignItems: 'center' }}>
                <span style={{ color: '#555', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <TinyLegendSymbol fill={getZoneColor(e.zonentyp, e.gemeinde)} title={e.zonentyp} variant="zonenplan" />
                  <span>{e.zonentyp}</span>
                </span>
                <span style={{ color: '#555' }}>{e.gemeinde}</span>
                <span style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>{e.flaeche}</span>
                <span style={{ fontWeight: 600, color: '#1a1a1a', textAlign: 'right' }}>{e.anteil}</span>
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
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Bauprojekte</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', overflowX: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 420 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 120px', gap: '0 8px', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: 3, borderBottom: '1px solid #f0f0f0' }}>
              <span>Dossier</span>
              <span>Bezeichnung</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>
            {entries.map((p, i) => {
              const c = STATUS_BADGE[p.status] ?? { bg: '#eee', color: '#555' };
              const isExpanded = expandedDossier === p.dossierNr;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 120px', gap: '0 8px', fontSize: 12, alignItems: 'baseline' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedDossier((value) => value === p.dossierNr ? null : p.dossierNr)}
                      aria-expanded={isExpanded}
                      style={{
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        margin: 0,
                        color: '#3388ff',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      title="Details anzeigen"
                    >
                      {p.dossierNr}
                    </button>
                    <span style={{ color: '#1a1a1a' }}>{p.bezeichnung}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: c.bg, color: c.color, whiteSpace: 'nowrap', justifySelf: 'end' }}>{p.status}</span>
                  </div>

                  {isExpanded && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 10,
                      background: '#f8fafc',
                      padding: '10px 12px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '10px 12px',
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Amtliche Baudossier-Nr.</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{p.amtlicheBaudossierNr || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Eidg. Projektidentifikator</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{p.eidgProjektidentifikator || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Anzahl projektierte Wohnungen</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{p.anzahlProjektierteWohnungen || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Art der Arbeiten</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{p.artDerArbeiten || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Art der Bauwerke</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{p.artDerBauwerke || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>Typ der Bauwerke</div>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{p.typDerBauwerke || '—'}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsibleGebaeude({ entries, isAuthenticated }: { entries: BuildingInfo[]; isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const renderProtectedValue = (value: string) => (
    isAuthenticated ? (
      <span style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{value || '—'}</span>
    ) : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b7280', justifyContent: 'flex-start' }}>
        <InlineMetaIcon><LuLock size={12} color="#111" /></InlineMetaIcon>
        <span>Login erforderlich</span>
      </span>
    )
  );

  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Gebäude</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>
          {open ? '▲ zuklappen' : `▼ ${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'}`}
        </span>
      </div>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map((g, i) => {
            const c = STATUS_BADGE[g.gebaeudestatus] ?? { bg: '#eee', color: '#555' };
            return (
              <div
                key={`${g.egid}-${i}`}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  background: '#f9fafb',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Gebäude {i + 1}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', wordBreak: 'break-word' }}>
                      Nr. {g.nr}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                    {g.gebaeudestatus}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 12px' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Versicherungs-Nr.</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{g.versicherungsNr || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Baujahr / Bauperiode</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{g.baujahrBauperiode || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Gebäudekategorie</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{g.gebaeudekategorie || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Gebäudestatus</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{g.gebaeudestatus || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Adresse</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', wordBreak: 'break-word' }}>{g.adresse || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Koordinaten (Gebäudeschwerpunkt)</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{g.koordinaten || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>EGID</div>
                    <div style={{ fontWeight: 600, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{g.egid}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Verwaltung Gebäude</div>
                    <div>{renderProtectedValue(g.verwaltungGebaeude)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Versicherungswert</div>
                    <div>{renderProtectedValue(g.versicherungswert)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Anzahl Wohnungen</div>
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
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>Bodenbedeckung</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#555', display: 'inline-flex', alignItems: 'center', gap: 6, flex: '1 1 180px', minWidth: 0 }}>
                <TinyLegendSymbol fill={getBodenbedeckungColor(e.label)} title={e.label} variant="bodenbedeckung" />
                <span>{e.label}</span>
              </span>
              <span style={{ fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>{e.area}</span>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
      </div>
    );
  }
  return (
    <div style={{ fontSize: 13 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#666' }}>{label}</span>
        <span style={{ color: '#3388ff', fontWeight: 600, fontSize: 12 }}>{open ? '▲ zuklappen' : `▼ ${entries.length} Einträge`}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map((e, i) => (
            <span key={i} style={{ fontSize: 12, color: '#1a1a1a' }}>{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectInfoPanel({ info, onClose }: { info: ObjectInfo; onClose: () => void }) {
  const [authUser, setAuthUser] = useState<string | null>(null);

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

  const isAuthenticated = Boolean(authUser);

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderTop: 'none',
      borderRadius: '0 0 12px 12px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'rgba(0,159,227,0.9)', color: '#fff',
        padding: '10px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontWeight: 500, fontSize: 16 }}>Grundstück {info.grundstueckNummer}</span>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}
          aria-label="Schliessen"><LuX size={28} /></button>
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'min(65vh, calc(100dvh - 180px))', overflowY: 'auto' }}>
        <Section title="Stammdaten">
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

        <Section title="Grundstück">
          {!isAuthenticated && (
            <div style={{ padding: '8px 10px', borderRadius: 8, background: '#f9fafb', border: '1px solid #eceff3', color: '#6b7280', fontSize: 12, lineHeight: 1.45 }}>
              Für alle Angaben unter Grundstück bitte{' '}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent(AUTH_OPEN_LOGIN_EVENT));
                  }
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  margin: 0,
                  color: '#009fe3',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  fontWeight: 700,
                }}
              >
                einloggen
              </button>
              .
            </div>
          )}
          <ProtectedFieldRow label="Eigentümer"                    value={<OwnershipValue info={info.eigentuemer} />} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Katasterwert"                  value={info.katasterwert} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Dienstbarkeiten / Grundlasten" value={info.dienstbarkeiten.length ? info.dienstbarkeiten.join(', ') : '—'} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Anmerkungen"                   value={info.anmerkungen.length ? info.anmerkungen.join(', ') : '—'} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Grundpfandrechte"              value={info.grundpfandrechte.length ? info.grundpfandrechte.join(', ') : '—'} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Erwerbsarten"                  value={info.erwerbsarten.length ? info.erwerbsarten.join(', ') : '—'} isAuthenticated={isAuthenticated} />
          <ProtectedFieldRow label="Offene Geschäfte"              value={info.offeneGeschaefte.length ? info.offeneGeschaefte.join(', ') : '—'} isAuthenticated={isAuthenticated} />
        </Section>

        <Section title="Gebäude">
          <CollapsibleGebaeude entries={info.gebaeude} isAuthenticated={isAuthenticated} />
        </Section>
        <Section title="Bauprojekte">
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
  objectInfo, onSelect, onClose,
}: {
  objectInfo: ObjectInfo | null;
  onSelect:   (info: ObjectInfo) => void;
  onClose:    () => void;
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
    <div style={{
      position: 'fixed', top: 52, left: 'clamp(12px, 3vw, 25px)', zIndex: 1500,
      width: hasPanel ? 'min(520px, calc(100vw - 24px))' : 'min(400px, calc(100vw - 24px))',
      transition: 'width 0.18s ease',
    }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', display: 'flex', pointerEvents: 'none' }}><LuSearch size={17} color="#888" /></span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && !hasPanel && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Grundstück suchen…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px 11px 38px',
            border: '1px solid #ddd',
            borderRadius: (showDrop || hasPanel) ? '8px 8px 0 0' : 8,
            fontSize: 14, outline: 'none',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            background: '#fff',
          }}
        />
      </div>

      {/* Dropdown */}
      {showDrop && (
        <div style={{
          background: '#fff', border: '1px solid #ddd', borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {results.map((r, i) => (
            <div key={i}
              onMouseDown={() => { onSelect(r.info); setQuery(r.label); setShowDropdown(false); }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderTop: i > 0 ? '1px solid #f0f0f0' : 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f5f9ff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{r.subLabel}</div>
            </div>
          ))}
        </div>
      )}

      {/* Info panel */}
      {hasPanel && (
        <ObjectInfoPanel info={objectInfo} onClose={() => { onClose(); setQuery(''); }} />
      )}
    </div>
  );
}

// ─── ParcelLayer (must render inside MapContainer) ────────────────────────────
//
// This component manages the full lifecycle of the WFS vector parcel layer:
//
//  1. On mount and on every "moveend" / "zoomend" Leaflet event:
//     a. Read the current map zoom and bounding box.
//     b. If zoom < MIN_ZOOM_FOR_PARCELS → clear the layer (viewport too large).
//     c. Cancel any in-flight WFS request via AbortController.
//     d. Issue a new WFS GetFeature request with the current BBOX.
//     e. If the WFS returns 0 features (area not covered) → fall back to mock data.
//     f. Render the FeatureCollection as a Leaflet GeoJSON layer.
//
//  2. Per-feature click interaction (no React state re-renders involved):
//     • Each feature's Leaflet layer gets a "click" event handler via onEachFeature.
//     • On click: reset the previous highlight, apply VECTOR_HIGHLIGHT_STYLE to
//       the clicked layer via Leaflet's imperative l.setStyle() API, then notify
//       the parent with the feature's properties.
//     • Using direct Leaflet style manipulation (not re-keying the GeoJSONLayer)
//       means all other polygons stay rendered — only the highlight changes.

interface ParcelLayerProps {
  onFeatureSelect:  (props: RealParcelProps | null) => void;
  onLoadingChange:  (loading: boolean) => void;
  onError:          (msg: string | null) => void;
  onZoomChange:     (zoom: number) => void;
}

function ParcelLayer({ onFeatureSelect, onLoadingChange, onError, onZoomChange }: ParcelLayerProps) {
  const map = useMap();

  const [parcels,  setParcels]  = useState<FeatureCollection | null>(null);
  // Key increments each time new data arrives, forcing GeoJSONLayer to remount.
  const [layerKey, setLayerKey] = useState(0);

  // Tracks the Leaflet Path layer that is currently highlighted.
  // Direct mutation avoids a React re-render on every click.
  const highlightedRef = useRef<L.Path | null>(null);

  // AbortController so panning quickly cancels the previous in-flight request.
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest callback props in a ref so event handlers never go stale.
  const cbRef = useRef({ onFeatureSelect, onLoadingChange, onError, onZoomChange });
  useEffect(() => {
    cbRef.current = { onFeatureSelect, onLoadingChange, onError, onZoomChange };
  });

  // Stable async function — recreated only when `map` changes (never in practice).
  const loadParcels = useCallback(async () => {
    const zoom  = map.getZoom();
    const { onFeatureSelect, onLoadingChange, onError, onZoomChange } = cbRef.current;

    onZoomChange(zoom);

    if (zoom < MIN_ZOOM_FOR_PARCELS) {
      setParcels(null);
      onFeatureSelect(null);
      return;
    }

    // Cancel any outstanding request before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    onLoadingChange(true);
    onError(null);
    highlightedRef.current = null; // clear stale ref before data changes
    onFeatureSelect(null);

    try {
      const b = map.getBounds();
      let data = await fetchParcelsByBbox(
        b.getSouth(), b.getWest(), b.getNorth(), b.getEast(),
        controller.signal,
      );

      if (data.features.length === 0) {
        // WFS returned nothing for this viewport (canton not subscribed).
        // Generate mock parcels so the app remains interactive.
        data = buildMockFeatures(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
      }

      setParcels(data);
      setLayerKey(k => k + 1);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      onError(err instanceof Error ? err.message : 'Failed to load parcel data.');
    } finally {
      onLoadingChange(false);
    }
  }, [map]);

  // Initial load on mount, and rebind Leaflet events.
  // useEffect deps [loadParcels, map] are both stable → runs exactly once.
  useEffect(() => {
    void loadParcels();

    const handler = () => void loadParcels();
    map.on('moveend', handler);
    map.on('zoomend', handler);

    return () => {
      map.off('moveend', handler);
      map.off('zoomend', handler);
      abortRef.current?.abort();
    };
  }, [loadParcels, map]);

  // onEachFeature is called by react-leaflet for every feature at mount.
  // Uses refs for all external values so no stale closures occur.
  const onEachFeature = useCallback((feature: Feature, layer: L.Layer) => {
    layer.on('click', () => {
      // Reset the previously highlighted polygon.
      if (highlightedRef.current) {
        highlightedRef.current.setStyle(VECTOR_STYLE);
      }
      // Highlight the clicked polygon.
      (layer as L.Path).setStyle(VECTOR_HIGHLIGHT_STYLE);
      highlightedRef.current = layer as L.Path;
      // Notify parent to show the info box.
      cbRef.current.onFeatureSelect(feature.properties as RealParcelProps);
    });
  }, []);

  if (!parcels) return null;

  return (
    <GeoJSONLayer
      key={layerKey}
      data={parcels}
      style={VECTOR_STYLE}
      onEachFeature={onEachFeature}
    />
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

// Map center: Lucerne, Switzerland (zoom 14).
//
// WFS parcel data note:
//   The geodienste.ch WFS (ms:RESF) does NOT currently cover Lucerne canton.
//   Mock parcels are shown at this location.
//   Navigate to one of these cantons for real WFS data:
//     • Zug (ZG)              — e.g. 47.17°N, 8.52°E
//     • Valais (VS)           — e.g. 46.23°N, 7.36°E
//     • Basel-Landschaft (BL) — e.g. 47.48°N, 7.73°E
const MAP_CENTER: [number, number] = [47.0502, 8.3093];

export default function MapPageV2() {
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [objectInfo,  setObjectInfo]  = useState<ObjectInfo | null>(null);
  const [currentZoom, setCurrentZoom] = useState(14);

  return (
    <div style={{ width: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>

      <Header />

      <MapContainer center={MAP_CENTER} zoom={14} zoomControl={false} style={{ width: '100%', flex: 1 }}>

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <WMSTileLayer
          url={WMS_URL}
          layers={WMS_LAYERS}
          format="image/png"
          transparent={true}
          version="1.3.0"
          opacity={0.7}
          attribution={WMS_ATTRIBUTION}
        />

        <ZoomControl position="bottomleft" />

        <ParcelLayer
          onFeatureSelect={props => setObjectInfo(props ? infoFromParcel(props) : null)}
          onLoadingChange={setLoading}
          onError={setError}
          onZoomChange={setCurrentZoom}
        />

      </MapContainer>

      {loading && <LoadingOverlay />}
      {error && !loading && <ErrorBox message={error} onClose={() => setError(null)} />}

      <SearchPanel
        objectInfo={objectInfo}
        onSelect={setObjectInfo}
        onClose={() => setObjectInfo(null)}
      />

      <DummyChatbotWidget />
    </div>
  );
}
