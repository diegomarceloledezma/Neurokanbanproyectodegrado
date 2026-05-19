import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Loader2, SearchX } from "lucide-react";

type IconComponent = ComponentType<{ className?: string }>;

type PageStateProps = {
  icon?: IconComponent;
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  minHeightClassName?: string;
  variant?: "neutral" | "error" | "warning" | "success";
};

const variantStyles: Record<NonNullable<PageStateProps["variant"]>, string> = {
  neutral: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300",
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  warning: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  success: "border-green-500/30 bg-green-500/10 text-green-300",
};

export function PageState({
  icon: Icon = SearchX,
  eyebrow,
  title,
  description,
  children,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  minHeightClassName = "min-h-[320px]",
  variant = "neutral",
}: PageStateProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8 ${minHeightClassName}`}
    >
      <div className="max-w-xl text-center">
        <div className="mb-5 flex justify-center">
          <div className={`rounded-2xl border p-4 ${variantStyles[variant]}`}>
            <Icon className="h-9 w-9" />
          </div>
        </div>

        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            {eyebrow}
          </p>
        )}

        <h2 className="text-2xl font-semibold text-white">{title}</h2>

        {description && (
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
            {description}
          </p>
        )}

        {children && <div className="mt-5 text-sm text-slate-300">{children}</div>}

        {(actionLabel || secondaryActionLabel) && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {secondaryActionLabel && onSecondaryAction && (
              <button
                type="button"
                onClick={onSecondaryAction}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:bg-slate-700"
              >
                {secondaryActionLabel}
              </button>
            )}

            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/10 transition-all hover:from-cyan-600 hover:to-purple-700"
              >
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type LoadingStateProps = {
  title?: string;
  description?: string;
  minHeightClassName?: string;
};

export function LoadingState({
  title = "Cargando información...",
  description = "Estamos preparando los datos del sistema.",
  minHeightClassName = "min-h-[320px]",
}: LoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8 ${minHeightClassName}`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-cyan-300">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  minHeightClassName?: string;
};

export function ErrorState({
  title = "No se pudo cargar la información",
  message,
  actionLabel,
  onAction,
  minHeightClassName = "min-h-[280px]",
}: ErrorStateProps) {
  return (
    <PageState
      icon={AlertTriangle}
      eyebrow="Revisión necesaria"
      title={title}
      description={message}
      actionLabel={actionLabel}
      onAction={onAction}
      minHeightClassName={minHeightClassName}
      variant="error"
    />
  );
}

type EmptyStateProps = Omit<PageStateProps, "variant">;

export function EmptyState(props: EmptyStateProps) {
  return <PageState {...props} variant="neutral" />;
}