export const ErrorNotice = (props: { message: string }) => (
  <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
    {props.message}
  </div>
);

export const LoadingState = (props: { label: string }) => (
  <div class="flex items-center justify-center gap-2 py-10 text-sm text-neutral-500 dark:text-neutral-400">
    <span class="iconify lucide--loader-circle animate-spin text-lg" />
    {props.label}
  </div>
);

export const EmptyState = (props: { icon: string; message: string }) => (
  <div class="flex flex-col items-center gap-2 py-10 text-center text-neutral-500 dark:text-neutral-400">
    <span class={`iconify ${props.icon} text-3xl`} />
    <p class="text-sm">{props.message}</p>
  </div>
);
