import { useParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

import { didDocCache } from "../lib/api";
import { localDateFromTimestamp } from "../utils/format";
import { BreadcrumbRow, Breadcrumbs } from "./breadcrumbs";
import { timestampFromRkey } from "./record-row";

const [pds, setPDS] = createSignal<string>();
export { setPDS };

export const NavBar = () => {
  const params = useParams();
  const [handle, setHandle] = createSignal(params.repo);
  const isCustomDomain = () => handle() && !handle()!.endsWith(".bsky.social");
  const missingPds = () => pds() === "Missing PDS";

  createEffect(() => {
    pds();
    if (!params.repo) return;
    const hdl =
      didDocCache[params.repo]?.alsoKnownAs
        ?.filter((alias) => alias.startsWith("at://"))[0]
        ?.split("at://")[1] ?? params.repo;
    setHandle(hdl);
  });

  const rkeyDate = () => {
    const timestamp = params.rkey ? timestampFromRkey(params.rkey) : undefined;
    return timestamp === undefined ? undefined : localDateFromTimestamp(timestamp);
  };

  return (
    <Breadcrumbs>
      <BreadcrumbRow
        icon={
          missingPds() && params.repo?.startsWith("did:") ? "lucide--unplug" : "lucide--hard-drive"
        }
        iconClass={
          missingPds() && params.repo?.startsWith("did:")
            ? "text-red-500 dark:text-red-400"
            : undefined
        }
        iconTooltip="PDS"
        faviconDomain={pds() && !missingPds() ? pds() : undefined}
        label={pds() && (!missingPds() || params.repo?.startsWith("did:")) ? pds() : ""}
        labelClass={missingPds() ? "text-red-500 dark:text-red-400" : undefined}
        href={params.repo && pds() && !missingPds() ? `/${pds()}` : undefined}
        copy={pds() && !missingPds() ? { content: pds()!, label: "Copy PDS" } : undefined}
      />

      <Show when={params.repo}>
        <BreadcrumbRow
          icon="lucide--book-user"
          iconTooltip="Repository"
          faviconDomain={isCustomDomain() ? handle() : undefined}
          label={handle() !== params.repo ? handle() : params.repo}
          preserveLabel={handle() !== params.repo}
          detail={handle() !== params.repo ? params.repo : undefined}
          href={params.collection ? `/at://${params.repo}` : undefined}
          copy={{ content: params.repo!, label: "Copy DID" }}
        />
      </Show>

      <Show when={params.collection}>
        <BreadcrumbRow
          icon="lucide--folder-open"
          iconTooltip="Collection"
          faviconDomain={params.collection!.split(".").slice(0, 2).reverse().join(".")}
          label={params.collection}
          href={params.rkey ? `/at://${params.repo}/${params.collection}` : undefined}
          copy={{ content: `at://${params.repo}/${params.collection}`, label: "Copy AT URI" }}
        />
      </Show>

      <Show when={params.rkey}>
        <BreadcrumbRow
          icon="lucide--file-json"
          iconTooltip="Record"
          label={params.rkey}
          detail={rkeyDate()}
          copy={{
            content: `at://${params.repo}/${params.collection}/${params.rkey}`,
            label: "Copy AT URI",
          }}
        />
      </Show>
    </Breadcrumbs>
  );
};
