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
