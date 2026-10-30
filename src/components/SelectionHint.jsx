export default function SelectionHint({ active, titleKey, title, tip }) {
  return (
    <div className={`selection-hint${active ? ' selection-hint-active' : ''}`}>
      <span className="selection-hint-title" key={titleKey}>{title}</span>
      {tip && <span className="selection-hint-tip">{tip}</span>}
    </div>
  );
}
