import neuroKanbanIcon from "../../assets/neurokanban-icon.png";

type BrandLogoVariant = "sidebar" | "auth" | "compact";

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  centered?: boolean;
  className?: string;
};

const variantStyles: Record<
  BrandLogoVariant,
  {
    wrapper: string;
    iconBox: string;
    icon: string;
    title: string;
    subtitle: string;
    showSubtitle: boolean;
  }
> = {
  sidebar: {
    wrapper: "items-center gap-3",
    iconBox: "h-12 w-12 rounded-2xl p-1.5",
    icon: "h-full w-full",
    title: "text-xl leading-none",
    subtitle: "text-[11px] mt-1",
    showSubtitle: true,
  },
  auth: {
    wrapper: "items-center gap-4",
    iconBox: "h-16 w-16 rounded-3xl p-2",
    icon: "h-full w-full",
    title: "text-3xl leading-none",
    subtitle: "text-sm mt-2",
    showSubtitle: true,
  },
  compact: {
    wrapper: "items-center gap-2",
    iconBox: "h-10 w-10 rounded-xl p-1.5",
    icon: "h-full w-full",
    title: "text-lg leading-none",
    subtitle: "hidden",
    showSubtitle: false,
  },
};

export default function BrandLogo({
  variant = "sidebar",
  centered = false,
  className = "",
}: BrandLogoProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`flex ${styles.wrapper} ${centered ? "justify-center" : ""} ${className}`}
      aria-label="NeuroKanban"
    >
      <div
        className={`${styles.iconBox} shrink-0 border border-cyan-400/25 bg-white shadow-lg shadow-cyan-500/10 ring-1 ring-white/10`}
      >
        <img
          src={neuroKanbanIcon}
          alt="Logo NeuroKanban"
          className={`${styles.icon} object-contain`}
        />
      </div>

      <div className={centered ? "text-left" : "min-w-0"}>
        <p className={`${styles.title} font-bold tracking-tight`}>
          <span className="text-white">Neuro</span>
          <span className="text-cyan-300">Kanban</span>
        </p>

        {styles.showSubtitle && (
          <p className={`${styles.subtitle} text-slate-400 leading-tight`}>
            IA aplicada a la gestión de tareas
          </p>
        )}
      </div>
    </div>
  );
}