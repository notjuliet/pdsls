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

export const CopyMenu = (props: { copyContent: string; label: string; icon?: string }) => {
  const ctx = useContext(MenuContext);

  return (
    <button
      onClick={() => {
        addToClipboard(props.copyContent);
        ctx?.setShowMenu(false);
      }}
      class="flex items-center gap-1.5 rounded-lg p-1 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    >
      <Show when={props.icon}>
        <span class={"iconify shrink-0 " + props.icon}></span>
      </Show>
      <span class="whitespace-nowrap">{props.label}</span>
    </button>
  );
};

export const NavMenu = (props: { href: string; label: string; icon: string; newTab?: boolean }) => {
  const ctx = useContext(MenuContext);

  return (
    <A
      href={props.href}
      onClick={() => ctx?.setShowMenu(false)}
      class="flex items-center gap-1.5 rounded-lg p-1 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      target={props.newTab ? "_blank" : undefined}
    >
      <span class={"iconify shrink-0 " + props.icon}></span>
      <span class="whitespace-nowrap">{props.label}</span>
    </A>
  );
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

  const clickEvent = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!menuButton()?.contains(target) && !menu()?.contains(target)) ctx?.setShowMenu(false);
  };

  onMount(() => window.addEventListener("click", clickEvent));
  onCleanup(() => window.removeEventListener("click", clickEvent));

  return (
    <div class="relative">
      <button
        class={
          "flex items-center hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 " +
          props.buttonClass
        }
        ref={setMenuButton}
        onClick={() => ctx?.setShowMenu(!ctx?.showMenu())}
      >
        <span class={"iconify " + props.icon}></span>
      </button>
      <Show when={ctx?.showMenu()}>
        <div
          ref={setMenu}
          class={
            "dark:bg-dark-300 dark:shadow-dark-800 absolute right-0 z-20 flex flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 shadow-md dark:border-neutral-700 " +
            props.menuClass
          }
        >
          {props.children}
        </div>
      </Show>
    </div>
  );
};
