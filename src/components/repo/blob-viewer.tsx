import * as CID from "@atcute/cid";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  ErrorBoundary,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";

import { formatFileSize } from "../../lib/format.js";
import { BackLink } from "../ui/back-link.jsx";
import { Button } from "../ui/button.jsx";
import { ExternalLink } from "../ui/external-link.jsx";
import { CopyValue, InfoRow, MUTED_CLASS } from "../ui/info.jsx";
import { Spinner } from "../ui/states.jsx";
import { ZoomableImage } from "../ui/zoomable-image.jsx";

/** The info rows' labels are four letters at most, so their column is narrower than usual. */
const LABEL_CLASS = "min-w-10 shrink-0 font-sans";
/** Lines a note up with the values, past that column and the row's gap. */
const UNDER_LABEL_CLASS = "pl-11";

const SIZE_CAP = 50 * 1024 * 1024; // 50 MiB

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

type BlobResult =
  | { kind: "oversized"; size: number; mimeType: string | undefined }
  | {
      kind: "loaded";
      blob: Blob;
      size: number;
      mimeType: string;
      digest: Uint8Array;
      expected: Uint8Array;
      matches: boolean;
    };

export const BlobViewer = (props: {
  cid: string;
  sourceKey: string;
  backHref: string;
  backLabel: string;
  fetchBlob: () => Promise<Blob>;
  inspectBlob?: () => Promise<{ size?: number; mimeType?: string }>;
  rawUrl?: string;
  unavailableMessage?: string;
}) => {
  const [overrideKey, setOverrideKey] = createSignal<string>();

  const parsedCid = createMemo(() => {
    try {
      return { ok: true as const, cid: CID.fromString(props.cid) };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });

  const [blob] = createResource(
    () =>
      parsedCid().ok && !props.unavailableMessage
        ? { sourceKey: props.sourceKey, override: overrideKey() === props.sourceKey }
        : null,
    async ({ override }): Promise<BlobResult> => {
      let size: number | undefined;
      let mimeType: string | undefined;

      if (props.inspectBlob) {
        try {
          const metadata = await props.inspectBlob();
          size = metadata.size;
          mimeType = metadata.mimeType;
        } catch {}
      }

      if (size !== undefined && size > SIZE_CAP && !override) {
        return { kind: "oversized", size, mimeType };
      }

      const data = await props.fetchBlob();
      const finalMime = data.type || mimeType || "application/octet-stream";
      const bytes = new Uint8Array(await data.arrayBuffer());
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const parsed = parsedCid();
      const expected =
        parsed.ok && parsed.cid.digest.codec === CID.HASH_SHA256
          ? parsed.cid.digest.contents
          : new Uint8Array();
      const matches =
        expected.length === digest.length &&
        digest.every((byte, index) => byte === expected[index]);

      return {
        kind: "loaded",
        blob: data,
        size: data.size,
        mimeType: finalMime,
        digest,
        expected,
        matches,
      };
    },
  );

  const blobValue = createMemo<BlobResult | undefined>(() => {
    if (blob.loading || blob.error) return undefined;
    return blob();
  });

  const objectUrl = createMemo<string | undefined>((previous) => {
    if (previous) URL.revokeObjectURL(previous);
    const value = blobValue();
    if (value?.kind !== "loaded") return undefined;
    return URL.createObjectURL(value.blob);
  });
  onCleanup(() => {
    const url = objectUrl();
    if (url) URL.revokeObjectURL(url);
  });

  createEffect(() => {
    document.title = `Blob ${props.cid.slice(0, 12)}… - PDSls`;
  });

  const previewKind = (mime: string) =>
    mime.startsWith("image/")
      ? "image"
      : mime === "video/mp4"
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "none";

  const unsupportedHash = () => {
    const parsed = parsedCid();
    return parsed.ok && parsed.cid.digest.codec !== CID.HASH_SHA256
      ? parsed.cid.digest.codec
      : undefined;
  };

  const rawHref = () => props.rawUrl;

  return (
    <ErrorBoundary
      fallback={(err) => (
        <div class="mx-auto w-full max-w-3xl px-2">
          <div class="rounded border border-red-500 px-3 py-2 text-red-500">{String(err)}</div>
        </div>
      )}
    >
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-2 pb-20">
        {/* Pulled into the padding so the label lines up with the content below. */}
        <BackLink href={props.backHref} class="-mx-2">
          {props.backLabel}
        </BackLink>

        <Show when={!parsedCid().ok}>
          <div class="rounded border border-red-500 px-3 py-2 text-red-500">
            Invalid CID: {(parsedCid() as { ok: false; error: string }).error}
          </div>
        </Show>

        <Show when={parsedCid().ok && props.unavailableMessage}>
          <div class="rounded border border-amber-500 px-3 py-2 text-amber-600 dark:text-amber-400">
            {props.unavailableMessage}
          </div>
        </Show>

        <Switch>
          <Match when={blob.loading}>
            <div class="self-center">
              <Spinner centered class="text-xl" />
            </div>
          </Match>
          <Match when={blob.error}>
            <div class="rounded border border-red-500 px-3 py-2 text-red-500">
              Failed to fetch blob: {String(blob.error)}
            </div>
          </Match>
          <Match
            when={
              blobValue()?.kind === "oversized" &&
              (blobValue() as Extract<BlobResult, { kind: "oversized" }>)
            }
          >
            {(value) => (
              <div class="flex flex-col gap-3 rounded border border-amber-500 px-3 py-3">
                <div class="text-amber-600 dark:text-amber-400">
                  Blob is {formatFileSize(value().size)} (over the {formatFileSize(SIZE_CAP)}
                  auto-fetch cap). The hash will not be verified until you fetch it.
                </div>
                <Show when={value().mimeType}>
                  <div class="text-sm text-neutral-600 dark:text-neutral-400">
                    Content-Type: {value().mimeType}
                  </div>
                </Show>
                <div class="flex gap-2">
                  <Button onClick={() => setOverrideKey(props.sourceKey)}>Fetch anyway</Button>
                  <Show when={rawHref()}>
                    {(href) => (
                      <a
                        href={href()}
                        target="_blank"
                        rel="noopener"
                        class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
                      >
                        <span class="iconify lucide--external-link" />
                        Open raw
                      </a>
                    )}
                  </Show>
                </div>
              </div>
            )}
          </Match>
          <Match
            when={
              blobValue()?.kind === "loaded" &&
              (blobValue() as Extract<BlobResult, { kind: "loaded" }>)
            }
          >
            {(value) => {
              const unsupported = unsupportedHash();
              return (
                <>
                  {/* A few plain rows, with a label column only as wide as these short labels. */}
                  <div class="flex flex-col gap-1 wrap-anywhere">
                    <InfoRow label="CID" labelClass={LABEL_CLASS}>
                      <CopyValue value={props.cid} />
                    </InfoRow>
                    <InfoRow label="Hash" labelClass={LABEL_CLASS}>
                      <span
                        class="flex items-center gap-1.5"
                        classList={{
                          "text-green-600 dark:text-green-400":
                            unsupported === undefined && value().matches,
                          "text-red-500 dark:text-red-400":
                            unsupported === undefined && !value().matches,
                          "text-amber-600 dark:text-amber-400": unsupported !== undefined,
                        }}
                      >
                        <span
                          class="iconify shrink-0"
                          classList={{
                            "lucide--check": unsupported === undefined && value().matches,
                            "lucide--x": unsupported === undefined && !value().matches,
                            "lucide--triangle-alert": unsupported !== undefined,
                          }}
                        />
                        {unsupported !== undefined
                          ? "Not checked"
                          : value().matches
                            ? "Valid"
                            : "Mismatch"}
                      </span>
                    </InfoRow>
                    <Show when={unsupported === undefined && !value().matches}>
                      <div class={`${UNDER_LABEL_CLASS} text-xs text-red-500 dark:text-red-400`}>
                        The fetched bytes don't match the CID.
                        <div class="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 font-mono text-neutral-600 dark:text-neutral-300">
                          <span class={MUTED_CLASS}>expected</span>
                          <span class="wrap-anywhere">{toHex(value().expected)}</span>
                          <span class={MUTED_CLASS}>actual</span>
                          <span class="wrap-anywhere">{toHex(value().digest)}</span>
                        </div>
                      </div>
                    </Show>
                    <Show when={unsupported !== undefined}>
                      <div
                        class={`${UNDER_LABEL_CLASS} text-xs text-amber-600 dark:text-amber-400`}
                      >
                        Hash multicodec 0x{unsupported!.toString(16)} isn't recognised.
                      </div>
                    </Show>
                    <InfoRow label="Size" labelClass={LABEL_CLASS}>
                      {formatFileSize(value().size)}
                    </InfoRow>
                    <InfoRow label="Type" labelClass={LABEL_CLASS}>
                      {value().mimeType}
                    </InfoRow>
                  </div>

                  <Show when={previewKind(value().mimeType) !== "none" && objectUrl()}>
                    <Show when={previewKind(value().mimeType) === "image"}>
                      <ZoomableImage src={objectUrl()} class="h-auto max-h-96 max-w-fit" />
                    </Show>
                    <Show when={previewKind(value().mimeType) === "video"}>
                      <video
                        class="max-h-80 max-w-[20rem]"
                        src={objectUrl()}
                        controls
                        playsinline
                      />
                    </Show>
                    <Show when={previewKind(value().mimeType) === "audio"}>
                      <audio class="my-0.5 max-w-96" controls>
                        <source
                          src={objectUrl()}
                          type={
                            value().mimeType === "audio/x-flac" ? "audio/flac" : value().mimeType
                          }
                        />
                      </audio>
                    </Show>
                  </Show>

                  <Show when={rawHref()}>
                    {(href) => <ExternalLink href={href()}>Open raw</ExternalLink>}
                  </Show>
                </>
              );
            }}
          </Match>
        </Switch>
      </div>
    </ErrorBoundary>
  );
};
