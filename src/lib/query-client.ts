import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000
      },
      dehydrate: {
        // Only dehydrate resolved queries. Dehydrating "pending" queries is the
        // React Query streaming-SSR pattern, which requires
        // <ReactQueryStreamedHydration>. This app uses the tRPC provider (no
        // streaming hydration), so a dehydrated pending query would arrive on
        // the client as `data: undefined` and crash useSuspenseQuery. Excluding
        // pending lets each page fetch client-side under Suspense instead.
        shouldDehydrateQuery: defaultShouldDehydrateQuery
      }
    }
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
