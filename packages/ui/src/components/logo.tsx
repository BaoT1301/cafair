import { Layers } from "lucide-react";

export function Logo() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/10 shadow-lg">
        <Layers className="h-8 w-8 text-primary-foreground" />
      </div>
      <span className="text-2xl font-bold text-primary-foreground">CaFair</span>
    </div>
  );
}
