import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,       // data stays fresh 30s — no refetch on every render
        gcTime: 5 * 60 * 1000,      // keep unused cache for 5 min (good for navigation)
        retry: 1,                   // retry once on failure (default is 3 — too noisy)
        refetchOnWindowFocus: false, // don't refetch on tab switch
      },
      mutations: {
        retry: 0, // never auto-retry mutations
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
