import { createSignal, For, Show } from "solid-js";

import { TextInput } from "./text-input";

export const TagInput = (props: {
  name: string;
  placeholder?: string;
  initialValues?: string[];
  onChange?: (values: string[]) => void;
}) => {
  const [tags, setTags] = createSignal<string[]>(props.initialValues ?? []);
  const [inputValue, setInputValue] = createSignal("");

  const updateTags = (next: string[]) => {
    setTags(next);
    props.onChange?.(next);
  };

  const addTag = () => {
    const value = inputValue().trim();
    if (value && !tags().includes(value)) {
      setInputValue("");
      updateTags([...tags(), value]);
    }
  };

  // A pasted list, split by spaces or commas, becomes a tag per value; the last one stays to edit.
  const onInput = (input: HTMLInputElement) => {
    const parts = input.value.split(/[\s,]+/);
    const rest = parts.pop()!;
    const added = parts.filter(
      (part, i) => part && !tags().includes(part) && parts.indexOf(part) === i,
    );
    if (parts.length > 0) {
      input.value = rest;
      if (added.length > 0) updateTags([...tags(), ...added]);
    }
    setInputValue(rest);
  };

  const removeTag = (index: number) => {
    updateTags(tags().filter((_, i) => i !== index));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Values like NSIDs and DIDs never contain spaces, so a space ends one.
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div class="flex min-w-0 grow flex-col gap-1.5">
      <input
        type="hidden"
        name={props.name}
        value={[...tags(), inputValue().trim()].filter(Boolean).join(",")}
      />
      <div class="flex gap-1.5">
        <TextInput
          value={inputValue()}
          onInput={(e) => onInput(e.currentTarget)}
          onKeyDown={onKeyDown}
          placeholder={props.placeholder}
          class="min-w-0 grow"
        />
        <button
          type="button"
          onClick={addTag}
          class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
        >
          <span class="iconify lucide--plus text-xs"></span>
          Add
        </button>
      </div>
      <Show when={tags().length > 0}>
        <div class="flex flex-wrap gap-1">
          <For each={tags()}>
            {(tag, index) => (
              <button
                type="button"
                onClick={() => removeTag(index())}
                class="group dark:bg-dark-200 flex items-center gap-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-xs text-neutral-700 hover:bg-neutral-300/70 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <span class="max-w-48 truncate sm:max-w-none">{tag}</span>
                <span class="iconify lucide--x text-current opacity-40 group-hover:opacity-100"></span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
