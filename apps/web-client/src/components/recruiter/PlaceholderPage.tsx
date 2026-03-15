import { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="max-w-[1200px]">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Coming Soon</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            This feature is under development and will be available in a future release.
          </p>
        </div>
      </div>
    </div>
  );
}
