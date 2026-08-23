interface FilterInputProps {
  value: string;
  placeholder: string;
  name?: string;
  class?: string;
  inputClass?: string;
  inputRef?: (input: HTMLInputElement) => void;
  onInput: (value: string) => void;
}

export const FilterInput = (props: FilterInputProps) => (
  <div
    class={`dark:bg-dark-200 flex min-w-0 cursor-text items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-sm dark:border-neutral-700 ${props.class ?? ""}`}
    onClick={(event) => {
      const input = event.currentTarget.querySelector("input");
      if (event.target !== input) input?.focus();
    }}
  >
    <span class="iconify lucide--filter shrink-0 text-neutral-500 dark:text-neutral-400" />
    <input
      ref={(input) => props.inputRef?.(input)}
      type="text"
      spellcheck={false}
      autocapitalize="off"
      autocomplete="off"
      name={props.name}
      class={
        props.inputClass ?? "min-w-0 grow py-1.5 select-none placeholder:text-xs focus:outline-none"
      }
      placeholder={props.placeholder}
      value={props.value}
      onInput={(event) => props.onInput(event.currentTarget.value)}
    />
  </div>
);
