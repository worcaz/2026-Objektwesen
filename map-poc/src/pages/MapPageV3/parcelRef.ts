import type { ObjectInfo } from '../MapPageV2/mockData';
import { buildDummyInfo, infoFromParcel } from '../MapPageV2/mockData';
import type { ParcelRef } from './historyData';

// Example parcel for the empty state: Grundstück 3814 in Schötz (matches the v2 mockup data).
export const EXAMPLE_INFO: ObjectInfo = {
  ...buildDummyInfo('80698814', '3814', 'CH000080698814'),
  flurname: 'Allmend',
  flaecheGrundbuch: "1'414 m²",
};

export const refOf = (i: ObjectInfo): ParcelRef => ({ nummer: i.grundstueckNummer, egrid: i.egrid });

export function infoFromRef(ref: ParcelRef): ObjectInfo {
  if (ref.egrid === EXAMPLE_INFO.egrid) return EXAMPLE_INFO;
  return infoFromParcel({ Nummer: ref.nummer, EGRIS_EGRID: ref.egrid });
}
