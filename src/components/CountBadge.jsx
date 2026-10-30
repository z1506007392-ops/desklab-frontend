// A count drawn as a small badge. It is hidden from screen readers; the
// button carries the count in its aria-label instead (see countLabel in
// App.jsx), so its name stays "布局检查 (2)".
export function CountBadge({ count }) {
  if (!(count > 0)) return null;
  return <span className="count-badge" aria-hidden="true">{count}</span>;
}
