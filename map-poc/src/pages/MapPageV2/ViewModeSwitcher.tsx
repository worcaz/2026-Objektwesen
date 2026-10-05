import { LuMap, LuColumns2, LuListTree } from 'react-icons/lu';
import type { ViewMode } from './viewMode';

const VIEW_OPTIONS: { mode: ViewMode; label: string; title: string; Icon: typeof LuMap }[] = [
  { mode: 'map',    label: 'Karte',  title: 'Kartenzentrierte Ansicht',      Icon: LuMap },
  { mode: 'hybrid', label: 'Hybrid', title: 'Hybride Ansicht',               Icon: LuColumns2 },
  { mode: 'data',   label: 'Daten',  title: 'Objektdatenzentrierte Ansicht', Icon: LuListTree },
];

export default function ViewModeSwitcher({ value, onChange, modes }: { value: ViewMode; onChange: (m: ViewMode) => void; modes?: ViewMode[] }) {
  return (
    <div className="view-switcher" role="group" aria-label="Ansicht wählen">
      {VIEW_OPTIONS.filter(o => !modes || modes.includes(o.mode)).map(({ mode, label, title, Icon }) => (
        <button
          key={mode}
          type="button"
          title={title}
          aria-label={title}
          aria-pressed={value === mode}
          className={`view-switcher__btn${value === mode ? ' view-switcher__btn--active' : ''}`}
          onClick={() => onChange(mode)}
        >
          <Icon size={14} />
          <span className="view-switcher__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
