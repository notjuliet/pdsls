import { createSignal, onMount, Show, For, createResource } from "solid-js";
import { getRecordBacklinks, getDidBacklinks, getAllBacklinks } from "../utils/api.js";
import * as TID from "@atcute/tid";
import { localDateFromTimestamp } from "../utils/date.js";
import { Button } from "./button.jsx";

// the actual backlink api will probably become closer to this
const linksBySource = (links: Record<string, any>) => {
  let out: any[] = [];
  Object.keys(links)
    .toSorted()
    .forEach((collection) => {
      const paths = links[collection];
      Object.keys(paths)
        .toSorted()
        .forEach((path) => {
          if (paths[path].records === 0) return;
          out.push({ collection, path, counts: paths[path] });
        });
    });
  return out;
};

const Backlinks = (props: { target: string }) => {
  const fetchBacklinks = async () => {
    const res = await getAllBacklinks(props.target);
    setBacklinks(linksBySource(res.links));
    return res;
  };

  const [response] = createResource(fetchBacklinks);
  const [backlinks, setBacklinks] = createSignal<any>();

  const [show, setShow] = createSignal<{
    collection: string;
    path: string;
    showDids: boolean;
  } | null>();

  return (
    <Show when={response()}>
      <div class="break-anywhere flex w-full flex-col gap-1">
        <For each={backlinks()}>
          {({ collection, path, counts }) => (
            <div class="text-sm">
              <p>
                <span title="Collection containing linking records">{collection}</span>
                <span class="text-neutral-400">@</span>
                <span title="Record path where the link is found">{path.slice(1)}</span>
              </p>
              <div class="pl-2">
                <p>
                  <a
                    class="text-blue-400 hover:underline"
                    href="#"
                    title="Show linking records"
                    onclick={() =>
                      (
                        show()?.collection === collection &&
                        show()?.path === path &&
                        !show()?.showDids
                      ) ?
                        setShow(null)
                      : setShow({ collection, path, showDids: false })
                    }
                  >
                    {counts.records} record{counts.records < 2 ? "" : "s"}
                  </a>
                  {" from "}
                  <a
                    class="text-blue-400 hover:underline"
                    href="#"
                    title="Show linking DIDs"
                    onclick={() =>
                      (
                        show()?.collection === collection &&
                        show()?.path === path &&
                        show()?.showDids
                      ) ?
                        setShow(null)
                      : setShow({ collection, path, showDids: true })
                    }
                  >
                    {counts.distinct_dids} DID
                    {counts.distinct_dids < 2 ? "" : "s"}
                  </a>
                </p>
                <Show when={show()?.collection === collection && show()?.path === path}>
                  <Show when={show()?.showDids}>
                    {/* putting this in the `dids` prop directly failed to re-render. idk how to solidjs. */}
                    <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
                      Distinct identities
                    </p>
                    <BacklinkItems
                      target={props.target}
                      collection={collection}
                      path={path}
                      dids={true}
                    />
                  </Show>
                  <Show when={!show()?.showDids}>
                    <p class="w-full font-semibold text-stone-600 dark:text-stone-400">Records</p>
                    <BacklinkItems
                      target={props.target}
                      collection={collection}
                      path={path}
                      dids={false}
                    />
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
};

// switching on !!did everywhere is pretty annoying, this could probably be two components
// but i don't want to duplicate or think about how to extract the paging logic
const BacklinkItems = ({
  target,
  collection,
  path,
  dids,
  cursor,
}: {
  target: string;
  collection: string;
  path: string;
  dids: boolean;
  cursor?: string;
}) => {
  const [links, setLinks] = createSignal<any>();
  const [more, setMore] = createSignal<boolean>(false);

  onMount(async () => {
    const links = await (dids ? getDidBacklinks : getRecordBacklinks)(
      target,
      collection,
      path,
      cursor,
    );
    setLinks(links);
  });

  // TODO: could pass the `total` into this component, which can be checked against each call to this endpoint to find if it's stale.
  // also hmm 'total' is misleading/wrong on that api

  return (
    <Show when={links()} fallback={<p>Loading&hellip;</p>}>
      <Show when={dids}>
        <For each={links().linking_dids}>
          {(did) => (
            <a
              href={`/at://${did}`}
              class="relative flex w-full font-mono text-blue-400 hover:underline"
            >
              {did}
            </a>
          )}
        </For>
      </Show>
      <Show when={!dids}>
        <For each={links().linking_records}>
          {({ did, collection, rkey }) => (
            <p class="relative flex w-full items-center gap-1 font-mono">
              <a href={`/at://${did}/${collection}/${rkey}`} class="text-blue-400 hover:underline">
                {rkey}
              </a>
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {TID.validate(rkey) ?
                  localDateFromTimestamp(TID.parse(rkey).timestamp / 1000)
                : undefined}
              </span>
            </p>
          )}
        </For>
      </Show>
      <Show when={links().cursor}>
        <Show when={more()} fallback={<Button onClick={() => setMore(true)}>Load More</Button>}>
          <BacklinkItems
            target={target}
            collection={collection}
            path={path}
            dids={dids}
            cursor={links().cursor}
          />
        </Show>
      </Show>
    </Show>
  );
};

export { Backlinks };
