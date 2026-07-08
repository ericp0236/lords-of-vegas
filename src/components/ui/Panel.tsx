/**
 * Shared surface panel with an optional uppercase heading — keeps every
 * sidebar/dock section visually consistent. Ornate gold chrome with a
 * centered diamond-flanked title, per the Vegas concept mock.
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
    <section className={`panel-ornate ${className}`}>
      {(title || actions) && (
        <div className="panel-ornate__header">
          {title && (
            <>
              <span className="panel-ornate__rule" aria-hidden />
              <span className="panel-ornate__diamond" aria-hidden />
              <h2 className={`panel-ornate__title ${titleClassName}`}>{title}</h2>
              <span className="panel-ornate__diamond" aria-hidden />
              <span className="panel-ornate__rule panel-ornate__rule--end" aria-hidden />
            </>
          )}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      )}
      <div className={`p-2.5 ${title || actions ? "pt-1" : ""} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
