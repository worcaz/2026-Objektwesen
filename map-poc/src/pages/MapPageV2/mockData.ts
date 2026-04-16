import type { RealParcelProps } from '../wfsService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuildingInfo {
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
export interface ProjectInfo {
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
export interface BodenbedeckungEntry { label: string; area: string; }
export interface ZonenplanEntry    { zonentyp: string; gemeinde: string; flaeche: string; anteil: string; }
export interface ContactInfo {
  office: string;
  person: string;
  street: string;
  city: string;
  phone: string;
  email: string;
  website: string;
}
export interface OwnerAddress {
  label: string;
  value: string;
}
export interface OwnerParty {
  name: string;
  addresses: OwnerAddress[];
}
export interface OwnershipShareEntry {
  grundstueck: string;
  anteil?: string;
  eigentumsform: string;
  parteien: OwnerParty[];
}
export interface OwnershipInfo {
  eigentumsform: string;
  parteien: OwnerParty[];
  beteiligungen?: OwnershipShareEntry[];
}
export interface ObjectInfo {
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
  letzteAktualisierung: string;
  // Grundstück-Sektion
  katasterwert:      string;
  dienstbarkeiten:   string[];
  anmerkungen:       string[];
  grundpfandrechte:  string[];
  erwerbsarten:      string[];
  offeneGeschaefte:  string[];
}
export interface SearchResult { label: string; subLabel: string; info: ObjectInfo; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

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
  'Allmend',
  'Santenberg',
  'Gfäsch',
  'Hostrich',
  'Under-Zelg',
  'Gormund',
  'Mülimatte',
  'Blindei',
  'Chrotteloch',
  'Sonnenberg',
  'Wauwilermoos',
  'Gütsch',
  'Rengg',
  'Hinter-Bramberg',
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
    { label: 'Landwirtschaftsfläche',     area: '1\'840 m²' },
    { label: 'Gebäude (Scheune)',         area: '180 m²' },
  ],
  [
    { label: 'Wald',                     area: '2\'300 m²' },
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
    koordinaten: '2\'666\'412 / 1\'211\'084',
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
    koordinaten: '2\'666\'428 / 1\'211\'076',
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
    koordinaten: '2\'664\'915 / 1\'208\'644',
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
    koordinaten: '2\'671\'103 / 1\'214\'552',
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
    koordinaten: '2\'655\'441 / 1\'220\'910',
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
    koordinaten: '2\'663\'087 / 1\'216\'233',
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
    koordinaten: '2\'648\'224 / 1\'227\'404',
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
    koordinaten: '2\'648\'236 / 1\'227\'395',
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
    koordinaten: '2\'665\'081 / 1\'212\'638',
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
    koordinaten: '2\'669\'310 / 1\'213\'887',
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
    koordinaten: '2\'665\'902 / 1\'211\'911',
    egid: '110220330',
    verwaltungGebaeude: 'Privera AG, Luzern',
    versicherungswert: "CHF 6'250'000",
    anzahlWohnungen: '6',
  },
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
  },
];

function formatAktualisierung(): string {
  const past = new Date();
  past.setDate(past.getDate() - 31);
  const d = String(past.getDate()).padStart(2, '0');
  const m = String(past.getMonth() + 1).padStart(2, '0');
  const y = past.getFullYear();
  return `Vor 31 Tagen (${d}.${m}.${y} 08:00 Uhr)`;
}

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

// ─── Builder functions ────────────────────────────────────────────────────────

export function buildDummyInfo(seed: string, nummer?: string, egrid?: string): ObjectInfo {
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
    letzteAktualisierung: formatAktualisierung(),
    katasterwert:      DUMMY_KATASTERWERTE[h % DUMMY_KATASTERWERTE.length],
    dienstbarkeiten:   DUMMY_DIENSTBARKEITEN[h % DUMMY_DIENSTBARKEITEN.length],
    anmerkungen:       DUMMY_ANMERKUNGEN[h % DUMMY_ANMERKUNGEN.length],
    grundpfandrechte:  DUMMY_GRUNDPFANDRECHTE[h % DUMMY_GRUNDPFANDRECHTE.length],
    erwerbsarten:      DUMMY_ERWERBSARTEN[h % DUMMY_ERWERBSARTEN.length],
    offeneGeschaefte:  DUMMY_OFFENE_GESCHAEFTE[h % DUMMY_OFFENE_GESCHAEFTE.length],
  };
}

export function infoFromParcel(p: RealParcelProps): ObjectInfo {
  return buildDummyInfo(p.EGRIS_EGRID ?? p.Nummer ?? 'parcel', p.Nummer, p.EGRIS_EGRID);
}

export function buildSearchResults(query: string): SearchResult[] {
  return [0, 1].map(i => {
    const info = buildDummyInfo(query + i);
    return {
      label: `Grundstück ${info.grundstueckNummer} (${info.grundstueckArt})`,
      subLabel: `${info.egrid} — ${info.gemeinde}`,
      info,
    };
  });
}
