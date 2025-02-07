import { createSignal, createMemo, onMount } from "solid-js";
import { getRecordBacklinks, getDidBacklinks } from "../utils/api.js";
import { JSONValue } from "../components/json.jsx";

// i just kind of think seeing a few incidentally-public atproto things could be opt-in
const FILTER_LINKS = {
  "app.bsky.graph.block": new Set([".subject"]),
};

// the actual backlink api will probably become closer to this
const linksBySource = (links, filter: bool) => {
  let out = [];
  let filterMatches = 0;
  Object.keys(links).toSorted().forEach(collection => {
    const paths = links[collection];
    Object.keys(paths).toSorted().forEach(path => {
      const matchesFilter = FILTER_LINKS[collection]?.has(path);
      if (matchesFilter) {
        filterMatches += 1;
        if (filter) return;
      }
      out.push({ collection, path, counts: paths[path], matchesFilter });
    });
  });
  return { links: out, filterMatches };
};

const Backlinks = ({ links, target }: { links: JSONType, target: String }) => {
  const [filter, setFilter] = createSignal(true);
  const [show, setShow] = createSignal(null);

  const filteredLinks = createMemo(() => linksBySource(links, filter()));

  return (
    <div class="flex flex-col pb-2">
      <p class="font-sans font-semibold text-stone-600 dark:text-stone-400">
        Backlinks{" "}
        <a
          href="https://links.bsky.bad-example.com"
          title="constellation: atproto backlink index"
          target="_blank"
        >
          🌌
        </a>
        {" "}
        <Show when={filteredLinks().filterMatches > 0}>
          <label
            class="float-right ml-2 text-stone-400 dark:text-stone-600"
            title="Some links, like blocks between accounts on Bluesky, are not shown by default."
          >
            show all ({filteredLinks().filterMatches}){" "}
            <input type="checkbox" oninput={(e) => setFilter(!e.target.checked)} checked={!filter()} />
          </label>
        </Show>
      </p>
      <For each={filteredLinks().links}>
        {({ collection, path, matchesFilter, counts }) => (
          <div key={`${collection}-${path}`} class="mt-2 font-mono text-sm sm:text-base">
            <p classList={{ "text-stone-400": matchesFilter }}>
              <span title="collection containing records linking here">
                {collection}
              </span>
              <span class="text-cyan-500">@</span>
              <span title="record path where thinks are found">
                {path.slice(1)}
              </span>
              :
            </p>
            <div class="font-sans pl-2.5">
              <p>
                <a
                  class="font-sans text-lightblue-500 hover:underline"
                  href="#"
                  title="Show linking records"
                  onclick={() => setShow({ collection, path, showDids: false })}
                >
                  {counts.records} records
                </a>
                {" from "}
                <a
                  class="font-sans text-lightblue-500 hover:underline"
                  href="#"
                  title="Show linking DIDs"
                  onclick={() => setShow({ collection, path, showDids: true })}
                >
                  {counts.distinct_dids} DIDs
                </a>
              </p>
              <Show when={show()?.collection === collection && show()?.path === path}>
                <Show when={show().showDids}>{/* putting this in the `dids` prop directly failed to re-render. idk how to solidjs. */}
                  <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
                    Distinct identities
                  </p>
                  <BacklinkItems target={target} collection={collection} path={path} dids={true} />
                </Show>
                <Show when={!show().showDids}>
                  <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
                    Records
                  </p>
                  <BacklinkItems target={target} collection={collection} path={path} dids={false} />
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
const BacklinkItems = ({ target, collection, path, dids, cursor }: {
  target: string,
  collection: string,
  path: string,
  dids: boolean,
  cursor?: string,
}) => {
  const [links, setLinks] = createSignal(null);
  const [more, setMore] = createSignal<boolean>(false);

  onMount(async () => {;
    const links = await (dids ? getDidBacklinks : getRecordBacklinks)(target, collection, path, cursor);
    setLinks(links);
  });

  // TODO: could pass the `total` into this component, which can be checked against each call to this endpoint to find if it's stale.
  // also hmm 'total' is misleading/wrong on that api

  return (
    <Show when={links()} fallback={(<p>Loading&hellip;</p>)}>
      <Show when={dids}>
        <For each={links().linking_dids}>
          {(did) => (
            <a
              href={`/at/${did}`}
              class="w-full flex font-mono text-lightblue-500 hover:underline relative"
            >
              {did}
            </a>
          )}
        </For>
      </Show>
      <Show when={!dids}>
        <For each={links().linking_records}>
          {({ did, collection, rkey }) => (
            <p class="w-full flex font-mono relative gap-1">
              <a
                href={`/at/${did}/${collection}/${rkey}`}
                class="text-lightblue-500 hover:underline"
              >
                {rkey}
              </a>
              <a
                href={`/at/${did}`}
                class="text-lightblue-700 hover:underline"
              >
                {did}
              </a>
            </p>
          )}
        </For>
      </Show>
      <Show when={links().cursor}>
        <Show when={more()} fallback={(
          <button
            type="button"
            onclick={() => setMore(true)}
            class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-gray-400 bg-white px-2 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            Load More
          </button>
        )}>
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
