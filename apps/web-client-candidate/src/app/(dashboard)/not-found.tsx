import { PageError } from "@/components/error-display";

export default function DashboardNotFound() {
  return (
    <PageError
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      variant="notFound"
    />
  );
}
