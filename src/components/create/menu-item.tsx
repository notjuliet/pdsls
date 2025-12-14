export const MenuItem = (props: { icon: string; label: string; onClick: () => void }) => {
  return (
    <button
      type="button"
      class="flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      onClick={props.onClick}
    >
      <span class={`iconify ${props.icon}`}></span>
      <span>{props.label}</span>
    </button>
  );
};
