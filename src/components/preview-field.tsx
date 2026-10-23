import { createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";

import type { JSONType } from "./json.jsx";

const PREVIEW_VALUE_MAX_LENGTH = 200;
const PREVIEW_FIELD_OPTION_MAX_DEPTH = 2;

const isRecordObject = (value: unknown): value is Record<string, JSONType> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const getPathValue = (value: JSONType, path: string) => {
  let current: JSONType | undefined = value;

  for (const segment of path.split(".")) {
    if (!segment) return;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
      current = current[index];
    } else if (isRecordObject(current)) {
      if (!Object.hasOwn(current, segment)) return;
      current = current[segment];
    } else return;
  }

  return current;
};

export const addPreviewFieldOptions = (
  value: JSONType,
  fields: Set<string>,
  path = "",
  depth = 1,
) => {
  if (!isRecordObject(value) || depth > PREVIEW_FIELD_OPTION_MAX_DEPTH) return;

  for (const key of Object.keys(value)) {
    if (key === "$type") continue;

    const fieldPath = path ? `${path}.${key}` : key;
    fields.add(fieldPath);
    addPreviewFieldOptions(value[key], fields, fieldPath, depth + 1);
  }
};

export const formatPreviewValue = (value: JSONType | undefined) => {
  if (value === undefined) return;

  const str =
    typeof value === "string"
      ? JSON.stringify(value)
      : typeof value === "number" || typeof value === "boolean" || value === null
        ? String(value)
        : JSON.stringify(value);

  if (str.length <= PREVIEW_VALUE_MAX_LENGTH) return str;

  return `${str.slice(0, PREVIEW_VALUE_MAX_LENGTH)}...`;
};

export const PreviewFieldMenu = (props: {
  value: string;
  options: string[];
  onChange: (field: string) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [button, setButton] = createSignal<HTMLButtonElement>();
  const [buttonRect, setButtonRect] = createSignal<DOMRect>();

  const updatePosition = () => {
    const rect = button()?.getBoundingClientRect();
    if (rect) setButtonRect(rect);
  };

  const menuStyle = (): JSX.CSSProperties | undefined => {
    const rect = buttonRect();
    if (!rect) return;

    const menuWidth = Math.min(260, window.innerWidth - 16);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - menuWidth - 8);

    return {
      position: "fixed",
      top: `${rect.top - 4}px`,
      left: `${left}px`,
      width: `${menuWidth}px`,
      transform: "translateY(-100%)",
    };
  };

  const closeOnOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!button()?.contains(target) && !menu()?.contains(target)) setOpen(false);
  };

  const selectField = (field: string) => {
    props.onChange(field);
    setOpen(false);
  };

  onMount(() => {
    window.addEventListener("click", closeOnOutsideClick);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
  });

  onCleanup(() => {
    window.removeEventListener("click", closeOnOutsideClick);
    window.removeEventListener("scroll", updatePosition, true);
    window.removeEventListener("resize", updatePosition);
  });

  return (
    <>
      <button
        type="button"
        ref={setButton}
        class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex max-w-44 min-w-0 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
        classList={{
          "text-blue-500! dark:text-blue-400! border-blue-500! dark:border-blue-400!":
            !!props.value,
        }}
        onClick={() => {
          updatePosition();
          setOpen(!open());
        }}
      >
        <span class="min-w-0 truncate">{props.value ? `Preview: ${props.value}` : "Preview"}</span>
        <span class="iconify lucide--chevron-down shrink-0 text-[10px]"></span>
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={setMenu}
            style={menuStyle()}
            class="dark:bg-dark-300 dark:shadow-dark-700 z-50 flex max-h-80 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs shadow-md dark:border-neutral-700"
          >
            <button
              type="button"
              class="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              onClick={() => selectField("")}
            >
              <span
                class="iconify shrink-0"
                classList={{
                  "iconify lucide--check text-blue-500 dark:text-blue-400": !props.value,
                  "lucide--minus text-neutral-400 dark:text-neutral-500": !!props.value,
                }}
              ></span>
              <span>None</span>
            </button>
            <Show when={props.options.length}>
              <div class="my-1 h-[0.5px] bg-neutral-300 dark:bg-neutral-600" />
              <div class="flex max-h-42 flex-col overflow-y-auto">
                <For each={props.options}>
                  {(field) => (
                    <button
                      type="button"
                      class="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      onClick={() => selectField(field)}
                    >
                      <span
                        class="iconify shrink-0"
                        classList={{
                          "lucide--check text-blue-500 dark:text-blue-400": props.value === field,
                          "lucide--minus text-transparent": props.value !== field,
                        }}
                      ></span>
                      <span class="min-w-0 truncate">{field}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <input
              type="text"
              spellcheck={false}
              autocapitalize="off"
              autocomplete="off"
              class="dark:bg-dark-100 mt-2 rounded-md bg-white px-2 py-1 outline-1 outline-neutral-200 select-none placeholder:font-sans placeholder:text-xs focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
              placeholder="custom path"
              value={props.value}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
          </div>
        </Portal>
      </Show>
    </>
  );
};
