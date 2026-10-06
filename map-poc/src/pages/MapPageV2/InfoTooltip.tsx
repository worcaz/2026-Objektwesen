import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuInfo } from 'react-icons/lu';

export default function InfoTooltip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      // Popup ist min(240px, 55vw) breit – am rechten Viewport-Rand nach links ausweichen.
      const popupWidth = Math.min(240, window.innerWidth * 0.55);
      const x = Math.min(r.right + 8, window.innerWidth - popupWidth - 8);
      setCoords({ x, y: r.top + r.height / 2 });
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
      {/* Per Portal an <body>, damit sticky Tabellenzellen (eigener Stacking-Context) das Popup nicht überdecken. */}
      {coords && createPortal(
        <span
          className="info-tooltip__popup"
          style={{ left: coords.x, top: coords.y }}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
