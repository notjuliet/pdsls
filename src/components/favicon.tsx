import { createSignal, JSX, Match, Show, Switch } from "solid-js";

export const Favicon = (props: {
  domain: string;
  reverse?: boolean;
  wrapper?: (children: JSX.Element) => JSX.Element;
}) => {
  const [loaded, setLoaded] = createSignal(false);
  const [src, setSrc] = createSignal("");
  const domain = () => (props.reverse ? props.domain.split(".").reverse().join(".") : props.domain);

  const workerUrl = () => `/favicon?domain=${encodeURIComponent(domain())}`;
  const directUrl = () => `https://${domain()}/favicon.ico`;

  const content = (
    <Switch>
      <Match when={domain() === "tangled.sh" || domain() === "tangled.org"}>
        <span class="iconify i-tangled size-4" />
      </Match>
      <Match when={true}>
        <Show when={!loaded()}>
          <span class="iconify lucide--globe size-4 text-neutral-400 dark:text-neutral-500" />
        </Show>
        <img
          src={src() || workerUrl()}
          class="size-4"
          classList={{ hidden: !loaded() }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!src()) {
              setSrc(directUrl());
            } else {
              setLoaded(false);
            }
          }}
        />
      </Match>
    </Switch>
  );

  return props.wrapper ?
      props.wrapper(content)
    : <div class="flex h-5 w-4 shrink-0 items-center justify-center">{content}</div>;
};
