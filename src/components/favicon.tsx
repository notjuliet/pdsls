import { createSignal, JSX, Show } from "solid-js";

export const Favicon = (props: {
  authority: string;
  wrapper?: (children: JSX.Element) => JSX.Element;
}) => {
  const [loaded, setLoaded] = createSignal(false);
  const domain = () => props.authority.split(".").reverse().join(".");

  const content = (
    <>
      <Show when={!loaded()}>
        <span class="iconify lucide--globe size-4 text-neutral-400 dark:text-neutral-500" />
      </Show>
      <img
        src={
          ["bsky.app", "bsky.chat"].includes(domain()) ?
            "https://web-cdn.bsky.app/static/apple-touch-icon.png"
          : `https://${domain()}/favicon.ico`
        }
        alt=""
        class="h-4 w-4"
        classList={{ hidden: !loaded() }}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </>
  );

  return props.wrapper ?
      props.wrapper(content)
    : <div class="flex h-5 w-4 shrink-0 items-center justify-center">{content}</div>;
};
