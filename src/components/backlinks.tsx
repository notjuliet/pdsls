import { createSignal, createMemo, onMount, Show, For } from "solid-js";
import { getRecordBacklinks, getDidBacklinks, LinkData } from "../utils/api.js";
import * as TID from "@atcute/tid";
import { localDateFromTimestamp } from "../utils/date.js";

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
  return { links: out };
};

const Backlinks = ({ links, target }: { links: LinkData; target: string }) => {
  const [show, setShow] = createSignal<{
    collection: string;
    path: string;
    showDids: boolean;
  } | null>();

  const filteredLinks = createMemo(() => linksBySource(links));

  return (
    <div class="flex flex-col pb-2">
      <p class="font-sans font-semibold text-stone-600 dark:text-stone-400">
        Backlinks{" "}
        <a
          href="https://constellation.microcosm.blue"
          title="constellation: atproto backlink index"
          target="_blank"
        >
          🌌
        </a>{" "}
      </p>
      <For each={filteredLinks().links}>
        {({ collection, path, matchesFilter, counts }) => (
          <div class="mt-2 font-mono text-sm sm:text-base">
            <p classList={{ "text-stone-400": matchesFilter }}>
              <span title="Collection containing linking records">
                {collection}
              </span>
              <span class="text-cyan-500">@</span>
              <span title="Record path where the link is found">
                {path.slice(1)}
              </span>
              :
            </p>
            <div class="pl-2.5 font-sans">
              <p>
                <a
                  class="text-lightblue-500 font-sans hover:underline"
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
                  class="text-lightblue-500 font-sans hover:underline"
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
              <Show
                when={
                  show()?.collection === collection && show()?.path === path
                }
              >
                <Show when={show()?.showDids}>
                  {/* putting this in the `dids` prop directly failed to re-render. idk how to solidjs. */}
                  <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
                    Distinct identities
                  </p>
                  <BacklinkItems
                    target={target}
                    collection={collection}
                    path={path}
                    dids={true}
                  />
                </Show>
                <Show when={!show()?.showDids}>
                  <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
                    Records
                  </p>
                  <BacklinkItems
                    target={target}
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
              class="text-lightblue-500 relative flex w-full font-mono hover:underline"
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
              <a
                href={`/at://${did}/${collection}/${rkey}`}
                class="text-lightblue-500 hover:underline"
              >
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
        <Show
          when={more()}
          fallback={
            <button
              type="button"
              onclick={() => setMore(true)}
              class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-gray-400 bg-white px-2 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              Load More
            </button>
          }
        >
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
