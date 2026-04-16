import { LuDownload } from 'react-icons/lu';
import type { ObjectInfo, OwnershipInfo, OwnerParty, ContactInfo } from './mockData';

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
          body { font-family: Inter, system-ui, sans-serif; color: #111; padding: 24px; line-height: 1.45; }
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

export default function ExportSection({ info, isAuthenticated }: { info: ObjectInfo; isAuthenticated: boolean }) {
  return (
    <div className="export-section">
      <span className="export-section__desc">
        Exportiere alle aktuell verfügbaren Grundstücksdaten als PDF über den Browser-Druckdialog.
      </span>
      <button
        onClick={() => handleDummyPdfExport(info, isAuthenticated)}
        className="export-btn"
      >
        <LuDownload size={14} /> Als PDF exportieren
      </button>
    </div>
  );
}
