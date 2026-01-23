import { createSignal, JSX, Match, Show, Switch } from "solid-js";

export const Favicon = (props: {
  authority: string;
  wrapper?: (children: JSX.Element) => JSX.Element;
}) => {
  const [loaded, setLoaded] = createSignal(false);
  const domain = () => props.authority.split(".").reverse().join(".");

  const content = (
    <Switch>
      <Match when={domain() === "tangled.sh"}>
        <span class="iconify i-tangled size-4" />
      </Match>
      <Match when={["bsky.app", "bsky.chat"].includes(domain())}>
        <img src="https://web-cdn.bsky.app/static/apple-touch-icon.png" class="size-4" />
      </Match>
      <Match when={true}>
        <Show when={!loaded()}>
          <span class="iconify lucide--globe size-4 text-neutral-400 dark:text-neutral-500" />
        </Show>
        <img
          src={`https://${domain()}/favicon.ico`}
          class="size-4"
          classList={{ hidden: !loaded() }}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
        />
      </Match>
    </Switch>
  );

  return props.wrapper ?
      props.wrapper(content)
    : <div class="flex h-5 w-4 shrink-0 items-center justify-center">{content}</div>;
};
