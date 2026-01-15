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
      onClick={() => {
        addToClipboard(props.content);
        ctx?.setShowMenu(false);
      }}
      class="flex items-center gap-2 rounded-md p-1.5 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      <Show when={props.icon}>
        <span class={"iconify shrink-0 " + props.icon}></span>
      </Show>
      <span class="whitespace-nowrap">{props.label}</span>
    </button>
  );
};

export const NavMenu = (props: {
  href: string;
  label: string;
  icon?: string;
  newTab?: boolean;
  external?: boolean;
}) => {
  const ctx = useContext(MenuContext);

  return (
    <A
      href={props.href}
      onClick={() => ctx?.setShowMenu(false)}
      class="flex items-center gap-2 rounded-md p-1.5 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      classList={{ "justify-between": props.external }}
      target={props.newTab ? "_blank" : undefined}
    >
      <Show when={props.icon}>
        <span class={"iconify shrink-0 " + props.icon}></span>
      </Show>
      <span class="whitespace-nowrap">{props.label}</span>
      <Show when={props.external}>
        <span class="iconify lucide--external-link"></span>
      </Show>
    </A>
  );
};

export const ActionMenu = (props: { label: string; icon: string; onClick: () => void }) => {
  const ctx = useContext(MenuContext);

  return (
    <button
      onClick={() => {
        props.onClick();
        ctx?.setShowMenu(false);
      }}
      class="flex items-center gap-2 rounded-md p-1.5 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      <Show when={props.icon}>
        <span class={"iconify shrink-0 " + props.icon}></span>
      </Show>
      <span class="whitespace-nowrap">{props.label}</span>
    </button>
  );
};

export const MenuSeparator = () => {
  return <div class="my-1 h-[0.5px] bg-neutral-300 dark:bg-neutral-600" />;
};

export const DropdownMenu = (props: {
  icon: string;
  buttonClass?: string;
  menuClass?: string;
  children?: JSX.Element;
}) => {
  const ctx = useContext(MenuContext);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [menuButton, setMenuButton] = createSignal<HTMLButtonElement>();
  const [buttonRect, setButtonRect] = createSignal<DOMRect>();

  const clickEvent = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!menuButton()?.contains(target) && !menu()?.contains(target)) ctx?.setShowMenu(false);
  };

  const updatePosition = () => {
    const rect = menuButton()?.getBoundingClientRect();
    if (rect) setButtonRect(rect);
  };

  onMount(() => {
    window.addEventListener("click", clickEvent);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
  });

  onCleanup(() => {
    window.removeEventListener("click", clickEvent);
    window.removeEventListener("scroll", updatePosition, true);
    window.removeEventListener("resize", updatePosition);
  });

  return (
    <div class="relative">
      <button
        class={
          "flex items-center hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 " +
          props.buttonClass
        }
        ref={setMenuButton}
        onClick={() => {
          updatePosition();
          ctx?.setShowMenu(!ctx?.showMenu());
        }}
      >
        <span class={"iconify " + props.icon}></span>
      </button>
      <Show when={ctx?.showMenu()}>
        <Portal>
          <div
            ref={setMenu}
            style={{
              position: "fixed",
              top: `${(buttonRect()?.bottom ?? 0) + 4}px`,
              left: `${(buttonRect()?.right ?? 0) - 160}px`,
            }}
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
