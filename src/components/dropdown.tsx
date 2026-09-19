import { A } from "@solidjs/router";
import {
  Accessor,
  createContext,
  createSignal,
  JSX,
  onCleanup,
  onMount,
  Setter,
  Show,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { addToClipboard } from "../utils/copy";

const MenuContext = createContext<{
  showMenu: Accessor<boolean>;
  setShowMenu: Setter<boolean>;
}>();

export const MenuProvider = (props: { children?: JSX.Element }) => {
  const [showMenu, setShowMenu] = createSignal(false);
  const value = { showMenu, setShowMenu };

  return <MenuContext.Provider value={value}>{props.children}</MenuContext.Provider>;
};

export const CopyMenu = (props: { content: string; label: string; icon?: string }) => {
  const ctx = useContext(MenuContext);

  return (
    <button
      type="button"
      onClick={() => {
        addToClipboard(props.content);
        ctx?.setShowMenu(false);
      }}
      class="flex w-full items-center gap-2 rounded-md p-1.5 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      <Show when={props.icon}>
        <span
          class={"iconify shrink-0 text-neutral-500 dark:text-neutral-400 " + props.icon}
        ></span>
      </Show>
      <span class="whitespace-nowrap">{props.label}</span>
    </button>
  );
};

export const NavMenu = (props: {
  href: string;
  label: string;
  icon?: string;
  children?: JSX.Element;
  class?: string;
  newTab?: boolean;
  external?: boolean;
  shortcut?: string;
}) => {
  const ctx = useContext(MenuContext);

  return (
    <A
      href={props.href}
      onClick={() => ctx?.setShowMenu(false)}
      class={`flex w-full items-center gap-2 rounded-md p-1.5 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 ${props.class ?? ""}`}
      classList={{ "justify-between": props.external || !!props.shortcut }}
      target={props.newTab ? "_blank" : undefined}
    >
      {props.children ?? (
        <>
          <div class="flex items-center gap-2">
            <Show when={props.icon}>
              <span
                class={"iconify shrink-0 text-neutral-500 dark:text-neutral-400 " + props.icon}
              ></span>
            </Show>
            <span class="whitespace-nowrap">{props.label}</span>
          </div>
          <Show when={props.shortcut}>
            <kbd class="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400">
              {props.shortcut}
            </kbd>
          </Show>
          <Show when={props.external}>
            <span class="iconify lucide--external-link"></span>
          </Show>
        </>
      )}
    </A>
  );
};

export const ActionMenu = (props: {
  label: string;
  icon?: string | JSX.Element;
  onClick: () => unknown;
  keepOpen?: boolean;
  trailing?: JSX.Element;
}) => {
  const ctx = useContext(MenuContext);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await props.onClick();
        } finally {
          if (!props.keepOpen) ctx?.setShowMenu(false);
        }
      }}
      class="flex w-full items-center justify-between gap-3 rounded-md p-1.5 text-left whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      <span class="flex min-w-0 items-center gap-2">
        <Show when={props.icon}>
          {typeof props.icon === "string" ? (
            <span
              class={"iconify shrink-0 text-neutral-500 dark:text-neutral-400 " + props.icon}
            ></span>
          ) : (
            props.icon
          )}
        </Show>
        <span class="truncate">{props.label}</span>
      </span>
      <Show when={props.trailing}>{props.trailing}</Show>
    </button>
  );
};

export const FileActionMenu = (props: {
  label: string;
  icon: string;
  accept?: string;
  onChange: (event: Event) => void;
}) => {
  const ctx = useContext(MenuContext);
  let inputRef!: HTMLInputElement;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        class="hidden"
        onChange={(event) => {
          props.onChange(event);
          ctx?.setShowMenu(false);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.click()}
        class="flex w-full items-center gap-2 rounded-md p-1.5 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      >
        <span
          class={`iconify ${props.icon} shrink-0 text-neutral-500 dark:text-neutral-400`}
        ></span>
        <span>{props.label}</span>
      </button>
    </>
  );
};

export const MenuSeparator = () => {
  return <div class="my-1 h-[0.5px] bg-neutral-300 dark:bg-neutral-600" />;
};

export const DropdownMenu = (props: {
  icon?: string;
  buttonContent?: JSX.Element;
  buttonLabel?: string;
  buttonClass?: string;
  menuClass?: string;
  menuWidth?: number;
  children?: JSX.Element;
}) => {
  const ctx = useContext(MenuContext);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [menuButton, setMenuButton] = createSignal<HTMLButtonElement>();
  const [buttonRect, setButtonRect] = createSignal<{ bottom: number; right: number }>();

  const clickEvent = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!menuButton()?.contains(target) && !menu()?.contains(target)) ctx?.setShowMenu(false);
  };

  const updatePosition = () => {
    const rect = menuButton()?.getBoundingClientRect();
    if (rect) {
      const isTouchDevice = window.matchMedia("(hover: none)").matches;
      const vv = isTouchDevice ? window.visualViewport : null;
      setButtonRect({
        bottom: rect.bottom + (vv?.offsetTop ?? 0),
        right: rect.right + (vv?.offsetLeft ?? 0),
      });
    }
  };

  onMount(() => {
    window.addEventListener("click", clickEvent);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
  });

  onCleanup(() => {
    window.removeEventListener("click", clickEvent);
    window.removeEventListener("scroll", updatePosition, true);
    window.removeEventListener("resize", updatePosition);
    window.visualViewport?.removeEventListener("resize", updatePosition);
    window.visualViewport?.removeEventListener("scroll", updatePosition);
  });

  return (
    <div class="relative">
      <button
        type="button"
        aria-label={props.buttonLabel}
        aria-haspopup="menu"
        aria-expanded={ctx?.showMenu()}
        class={
          "flex items-center hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700/50 dark:active:bg-neutral-700 " +
          props.buttonClass
        }
        ref={setMenuButton}
        onClick={() => {
          updatePosition();
          ctx?.setShowMenu(!ctx?.showMenu());
        }}
      >
        {props.buttonContent ?? <span class={"iconify " + props.icon}></span>}
      </button>
      <Show when={ctx?.showMenu()}>
        <Portal>
          <div
            ref={setMenu}
            style={{
              position: "fixed",
              top: `${(buttonRect()?.bottom ?? 0) + 4}px`,
              left: `${Math.max(8, (buttonRect()?.right ?? 0) - (props.menuWidth ?? 160))}px`,
              width: props.menuWidth ? `${props.menuWidth}px` : undefined,
            }}
            role="menu"
            class={
              "dark:bg-dark-300 dark:shadow-dark-700 z-50 flex min-w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-sm shadow-md dark:border-neutral-700 " +
              props.menuClass
            }
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </div>
  );
};
