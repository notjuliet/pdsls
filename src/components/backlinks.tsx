import { createSignal } from "solid-js";
// import { getAllBacklinks, resolveHandle, resolvePDS } from "../utils/api.js";

const Backlinks = ({ links }: { links: JSONType }) => {
  const [showLinks, setShowLinks] = createSignal(null);

  return (
    <div class="flex flex-col pb-2">
      <p class="font-sans font-semibold text-stone-600 dark:text-stone-400">
        Backlinks 🌌
      </p>
      <For each={Object.keys(links).toSorted()}>
        {collection => (
          <For each={Object.keys(links[collection]).toSorted()}>
            {path => (
              <div key={`${collection}-${path}`} class="mt-2 font-mono text-sm sm:text-base">
                <p>
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
                      onclick={() => setShowLinks({ collection, path, dids: false })}
                    >
                      {links[collection][path].records} records
                    </a>
                    {" from "}
                    <a
                      class="font-sans text-lightblue-500 hover:underline"
                      href="#"
                      title="Show linking DIDs"
                      onclick={() => setShowLinks({ collection, path, dids: true })}
                    >
                      {links[collection][path].distinct_dids} DIDs
                    </a>
                  </p>
                  <Show when={showLinks()?.collection === collection && showLinks()?.path === path}>
                    <p>sup {showLinks().collection} {showLinks().path} dids? {showLinks().dids && 'dids'}</p>
                  </Show>
                </div>
              </div>
            )}
          </For>
        )}
      </For>
    </div>
  );
};

export { Backlinks };
