import { A } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  JSX,
  onCleanup,
  Show,
  useContext,
} from "solid-js";

/** Closes the menu an item is in. */
const MenuContext = createContext<() => void>();

export const NavMenu = (props: {
  href: string;
  label: string;
  icon?: string;
  children?: JSX.Element;
}) => {
  const closeMenu = useContext(MenuContext);

  return (
    <A
      href={props.href}
      onClick={() => closeMenu?.()}
      class="flex w-full items-center gap-2 rounded-md p-1.5 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      {props.children ?? (
        <>
          <Show when={props.icon}>
            <span
              class={"iconify shrink-0 text-neutral-500 dark:text-neutral-400 " + props.icon}
            ></span>
          </Show>
          <span class="whitespace-nowrap">{props.label}</span>
        </>
      )}
    </A>
  );
};

export const ActionMenu = (props: {
  label: string;
  icon?: string | JSX.Element;
  onClick: () => unknown;
  trailing?: JSX.Element;
}) => {
  const closeMenu = useContext(MenuContext);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await props.onClick();
        } finally {
          closeMenu?.();
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

export const MenuSeparator = () => {
  return <div class="my-1 h-[0.5px] bg-neutral-300 dark:bg-neutral-600" />;
};

export const DropdownMenu = (props: {
  buttonContent: JSX.Element;
  buttonLabel?: string;
  buttonClass?: string;
  menuClass?: string;
  menuWidth?: number;
  children?: JSX.Element;
}) => {
  const id = createUniqueId();
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [menuButton, setMenuButton] = createSignal<HTMLButtonElement>();
  const [open, setOpen] = createSignal(false);
  const [buttonRect, setButtonRect] = createSignal<{ bottom: number; right: number }>();

  const top = () => (buttonRect()?.bottom ?? 0) + 4;

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

  // An item can finish after the menu was dismissed, e.g. when switching accounts.
  const close = () => {
    if (menu()?.matches(":popover-open")) menu()?.hidePopover();
  };

  createEffect(() => {
    if (!open()) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    onCleanup(() => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    });
  });

  return (
    <>
      <button
        type="button"
        aria-label={props.buttonLabel}
        aria-expanded={open()}
        popovertarget={id}
        class={
          "flex items-center hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700/50 dark:active:bg-neutral-700 " +
          props.buttonClass
        }
        ref={setMenuButton}
      >
        {props.buttonContent}
      </button>
      <div
        ref={setMenu}
        id={id}
        popover="auto"
        onBeforeToggle={(event) => {
          if (event.newState !== "open") return;
          updatePosition();
          setOpen(true);
        }}
        // The items stay until the menu has closed, so the browser can restore focus from them.
        onToggle={(event) => setOpen(event.newState === "open")}
        style={{
          top: `${top()}px`,
          left: `${Math.max(8, (buttonRect()?.right ?? 0) - (props.menuWidth ?? 160))}px`,
          width: props.menuWidth ? `${props.menuWidth}px` : undefined,
          "max-height": `calc(100dvh - ${top()}px - 8px)`,
        }}
        class={
          "dark:bg-dark-300 dark:shadow-dark-700 inset-auto min-w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-sm text-inherit shadow-md open:flex dark:border-neutral-700 " +
          props.menuClass
        }
      >
        <Show when={open()}>
          <MenuContext.Provider value={close}>{props.children}</MenuContext.Provider>
        </Show>
      </div>
    </>
  );
};
