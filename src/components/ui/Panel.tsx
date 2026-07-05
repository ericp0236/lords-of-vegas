/**
 * Shared surface panel with an optional uppercase heading — keeps every
 * sidebar/dock section visually consistent.
 */

export function Panel({
  title,
  children,
  className = "",
  bodyClassName = "",
  titleClassName = "",
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
          {title && (
            <h2
              className={`text-[10px] font-bold uppercase tracking-[0.14em] text-muted ${titleClassName}`}
            >
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      <div className={`p-2.5 ${title || actions ? "pt-1.5" : ""} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
