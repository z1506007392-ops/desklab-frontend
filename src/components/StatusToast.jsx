export default function StatusToast({ text, type }) {
  if (!text) return null;
  return (
    <span className={`status-toast${type === 'error' ? ' is-error' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      {text}
    </span>
  );
}
