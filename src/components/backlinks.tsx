import * as TID from "@atcute/tid";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import {
  getAllBacklinks,
  getDidBacklinks,
  getRecordBacklinks,
  LinksWithDids,
  LinksWithRecords,
} from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { Button } from "./button.jsx";

type Backlink = {
  path: string;
  counts: { distinct_dids: number; records: number };
};

const linksBySource = (links: Record<string, any>) => {
  let out: Record<string, Backlink[]> = {};
  Object.keys(links)
    .toSorted()
    .forEach((collection) => {
      const paths = links[collection];
      Object.keys(paths)
        .toSorted()
        .forEach((path) => {
          if (paths[path].records === 0) return;
          if (out[collection]) out[collection].push({ path, counts: paths[path] });
          else out[collection] = [{ path, counts: paths[path] }];
        });
    });
  return out;
};

const Backlinks = (props: { target: string }) => {
  const fetchBacklinks = async () => {
    const res = await getAllBacklinks(props.target);
    return linksBySource(res.links);
  };

  const [response] = createResource(fetchBacklinks);

  const [show, setShow] = createSignal<{
    collection: string;
    path: string;
    showDids: boolean;
  } | null>();

  return (
    <div class="flex w-full flex-col gap-1 text-sm wrap-anywhere">
      <Show
        when={response() && Object.keys(response()!).length}
        fallback={<p>No backlinks found.</p>}
      >
        <For each={Object.keys(response()!)}>
          {(collection) => (
            <div>
              <div class="flex items-center gap-1">
                <span class="iconify lucide--book-text shrink-0"></span>
                {collection}
              </div>
              <For each={response()![collection]}>
                {({ path, counts }) => (
                  <div class="ml-4.5">
                    <div class="flex items-center gap-1">
                      <span class="iconify lucide--route shrink-0"></span>
                      {path.slice(1)}
                    </div>
                    <div class="ml-4.5">
                      <p>
                        <button
                          class="text-blue-400 hover:underline active:underline"
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
                        </button>
                        {" from "}
                        <button
                          class="text-blue-400 hover:underline active:underline"
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
                        </button>
                      </p>
                      <Show when={show()?.collection === collection && show()?.path === path}>
                        <Show when={show()?.showDids}>
                          <p class="w-full font-semibold">Distinct identities</p>
                          <BacklinkItems
                            target={props.target}
                            collection={collection}
                            path={path}
                            dids={true}
                          />
                        </Show>
                        <Show when={!show()?.showDids}>
                          <p class="w-full font-semibold">Records</p>
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
          )}
        </For>
      </Show>
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
  const [links, setLinks] = createSignal<LinksWithDids | LinksWithRecords>();
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
        <For each={(links() as LinksWithDids).linking_dids}>
          {(did) => (
            <a
              href={`/at://${did}`}
              class="relative flex w-full font-mono text-blue-400 hover:underline active:underline"
            >
              {did}
            </a>
          )}
        </For>
      </Show>
      <Show when={!dids}>
        <For each={(links() as LinksWithRecords).linking_records}>
          {({ did, collection, rkey }) => (
            <p class="relative flex w-full items-center gap-1 font-mono">
              <a
                href={`/at://${did}/${collection}/${rkey}`}
                class="text-blue-400 hover:underline active:underline"
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
      <Show when={links()?.cursor}>
        <Show when={more()} fallback={<Button onClick={() => setMore(true)}>Load More</Button>}>
          <BacklinkItems
            target={target}
            collection={collection}
            path={path}
            dids={dids}
            cursor={links()!.cursor}
          />
        </Show>
      </Show>
    </Show>
  );
};

export { Backlinks };
