import { type JSX, Show } from "solid-js";

/** The loading indicator. Size and color come from `class`, e.g. `text-xl`. */
export const Spinner = (props: { class?: string; centered?: boolean }) => {
  const icon = (
    <span
      role="status"
      aria-label="Loading"
      class={`iconify lucide--loader-circle animate-spin ${props.class ?? ""}`}
    />
  );
  return props.centered ? <div class="mt-3 flex w-full justify-center">{icon}</div> : icon;
};

export const ErrorNotice = (props: { message: string }) => (
  <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
    {props.message}
  </div>
);

export const LoadingState = (props: { label: string }) => (
  <div class="flex w-full items-center justify-center gap-2 py-10 text-center font-sans text-sm text-neutral-500 dark:text-neutral-400">
    <Spinner class="text-lg" />
    {props.label}
  </div>
);

export const EmptyState = (props: {
  icon: string;
  message: string;
  /** A heading above the message, for a state that asks the user to do something. */
  title?: string;
  /** What to do about it, such as a button, shown under the message. */
  children?: JSX.Element;
}) => (
  <div class="flex flex-col items-center gap-2 py-10 text-center font-sans text-neutral-500 dark:text-neutral-400">
    <span class={`iconify ${props.icon} text-3xl`} />
    <div>
      <Show when={props.title}>
        <h2 class="font-medium text-neutral-800 dark:text-neutral-200">{props.title}</h2>
      </Show>
      <p class="text-sm">{props.message}</p>
    </div>
    <Show when={props.children}>
      <div class="mt-2">{props.children}</div>
    </Show>
  </div>
);
