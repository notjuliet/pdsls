import { ErrorBoundary, JSX, Suspense } from "solid-js";

export const LazyTab = (props: { children: JSX.Element }) => (
  <ErrorBoundary fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}>
    <Suspense
      fallback={
        <div class="iconify lucide--loader-circle mt-2 animate-spin self-center text-xl" />
      }
    >
      {props.children}
    </Suspense>
  </ErrorBoundary>
);
