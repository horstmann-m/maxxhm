import type { ReactNode } from "react";

/** Consistent page header: eyebrow label + serif title + subtitle, optional actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-3xl md:text-[2.5rem] md:leading-[1.1] font-semibold">
          {title}
        </h1>
        {subtitle && <p className="text-muted mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
