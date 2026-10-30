// The app's few drawn icons: one 16px grid, one 1.75px round stroke,
// coloured by the text colour around them. Buttons using them carry their
// own aria-label.
function Icon({ children }) {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function CloseIcon() {
  return <Icon><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></Icon>;
}

export function MinusIcon() {
  return <Icon><path d="M4 8h8" /></Icon>;
}

export function PlusIcon() {
  return <Icon><path d="M8 4v8M4 8h8" /></Icon>;
}
