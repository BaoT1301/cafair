import { getInitials, AVATAR_COLORS } from "@/lib/recruiter-utils";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  index?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-14 h-14 text-lg",
};

export function Avatar({
  name,
  avatarUrl,
  index = 0,
  size = "md",
  className,
}: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizes[size]} rounded-full object-cover shrink-0 ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold shrink-0 ${className ?? ""}`}
    >
      {getInitials(name)}
    </div>
  );
}
