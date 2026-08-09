import { redirect } from "next/navigation";

/**
 * Legacy placeholder. The candidate portal now lives at `/candidate`, outside
 * the recruiter `(dashboard)` shell — this route existed only to say "coming
 * soon", so it forwards rather than contradicting the shipped product.
 */
export default function CandidatesPage() {
  redirect("/candidate");
}
