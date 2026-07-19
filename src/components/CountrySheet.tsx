import { useStore } from '../state/store';
import { countryByCode, STATUS_LABEL, type Status } from '../data/countries';

const OPTIONS: { status: Status; icon: string }[] = [
  { status: 'visited', icon: '✅' },
  { status: 'home', icon: '🏠' },
  { status: 'soon', icon: '🧳' },
];

export function CountrySheet({ code, onClose }: { code: string; onClose: () => void }) {
  const { statuses, setStatus } = useStore();
  const country = countryByCode.get(code);
  if (!country) return null;

  const current = statuses[code];

  const choose = (status: Status | null) => {
    setStatus(code, status);
    onClose();
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={country.name}>
        <div className="sheet-title">
          <span>{country.flag}</span>
          <span>{country.name}</span>
        </div>
        <div className="sheet-sub">
          {country.continent}
          {current ? ` · currently: ${STATUS_LABEL[current]}` : ''}
        </div>
        <div className="status-buttons">
          {OPTIONS.map((o) => (
            <button
              key={o.status}
              className={current === o.status ? `active-${o.status}` : ''}
              onClick={() => choose(current === o.status ? null : o.status)}
            >
              {o.icon} {STATUS_LABEL[o.status]}
            </button>
          ))}
          <button onClick={() => choose(null)}>✖️ Clear</button>
        </div>
      </div>
    </>
  );
}
