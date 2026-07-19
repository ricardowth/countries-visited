export function Legend() {
  return (
    <div className="legend">
      <span>
        <span className="dot" style={{ background: 'var(--visited)' }} />
        Visited
      </span>
      <span>
        <span className="dot" style={{ background: 'var(--home)' }} />
        Home
      </span>
      <span>
        <span className="dot" style={{ background: 'var(--soon)' }} />
        Going soon
      </span>
    </div>
  );
}
