// Path: apps/web-client/src/lib/aihire/apply-agent/detectApplicationProvider.ts

export type ApplicationProvider =
  | "greenhouse"
  | "workday"
  | "ashby"
  | "unknown";

export function detectApplicationProvider(
  targetUrl: string,
): ApplicationProvider {
  try {
    const url = new URL(targetUrl);
    const host = url.hostname.toLowerCase();

    if (host.includes("greenhouse.io")) {
      return "greenhouse";
    }

    if (
      host.includes("myworkdayjobs.com") ||
      host.includes("workdayjobs.com")
    ) {
      return "workday";
    }

    if (host.includes("ashbyhq.com")) {
      return "ashby";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}