import * as CID from "@atcute/cid";
import { A, useLocation, useParams } from "@solidjs/router";
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
import { Button } from "../../components/button.jsx";
import { Spinner } from "../../components/spinner.jsx";
import VideoPlayer from "../../components/video-player.jsx";
import { ZoomableImage } from "../../components/zoomable-image.jsx";
import { useRepo } from "../../lib/repo-context.jsx";
import { formatFileSize } from "../../utils/format.js";

const SIZE_CAP = 50 * 1024 * 1024; // 50 MiB

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

type BlobResult =
  | { kind: "oversized"; size: number; mimeType: string | undefined }
  | {
      kind: "loaded";
      bytes: Uint8Array<ArrayBuffer>;
      size: number;
      mimeType: string;
      digest: Uint8Array;
      expected: Uint8Array;
      matches: boolean;
    };

export const BlobDebugView = () => {
  const params = useParams();
  const location = useLocation();
  const repo = useRepo();
  const [overrideCap, setOverrideCap] = createSignal(false);

  const back = () => {
    const state = location.state as { from?: string; label?: string } | undefined;
    return {
      href: state?.from ?? `/at://${params.repo}#blobs`,
      label: state?.label ?? "Back to blobs",
    };
  };

  const parsedCid = createMemo(() => {
    try {
      return { ok: true as const, cid: CID.fromString(params.cid!) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

  const blobUrl = () =>
    `${repo.pds()}/xrpc/com.atproto.sync.getBlob?did=${params.repo}&cid=${params.cid}`;

  const [blob] = createResource(
    () => {
      const pds = repo.pds();
      if (!pds || !parsedCid().ok) return null;
      return { url: blobUrl(), override: overrideCap() };
    },
    async ({ url, override }): Promise<BlobResult> => {
      let size: number | undefined;
      let mimeType: string | undefined;
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (head.ok) {
          const cl = head.headers.get("content-length");
          size = cl ? parseInt(cl, 10) : undefined;
          mimeType = head.headers.get("content-type") ?? undefined;
        }
      } catch {}

      if (size !== undefined && size > SIZE_CAP && !override) {
        return { kind: "oversized", size, mimeType };
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const finalMime = res.headers.get("content-type") ?? mimeType ?? "application/octet-stream";
      const bytes = new Uint8Array(await res.arrayBuffer());
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const parsed = parsedCid();
      const expected =
        parsed.ok && parsed.cid.digest.codec === CID.HASH_SHA256 ?
          parsed.cid.digest.contents
        : new Uint8Array();
      const matches =
        expected.length === digest.length && digest.every((b, i) => b === expected[i]);

      return {
        kind: "loaded",
        bytes,
        size: bytes.byteLength,
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

  const objectUrl = createMemo<string | undefined>((prev) => {
    if (prev) URL.revokeObjectURL(prev);
    const b = blobValue();
    if (b?.kind !== "loaded") return undefined;
    return URL.createObjectURL(new Blob([b.bytes], { type: b.mimeType }));
  });
  onCleanup(() => {
    const u = objectUrl();
    if (u) URL.revokeObjectURL(u);
  });

  createEffect(() => {
    document.title = `Blob ${params.cid?.slice(0, 12)}… - PDSls`;
  });

  const previewKind = (mime: string) =>
    mime.startsWith("image/") ? "image"
    : mime === "video/mp4" ? "video"
    : mime.startsWith("audio/") ? "audio"
    : "none";

  const unsupportedHash = () => {
    const p = parsedCid();
    return p.ok && p.cid.digest.codec !== CID.HASH_SHA256 ? p.cid.digest.codec : undefined;
  };

  return (
    <ErrorBoundary
      fallback={(err) => (
        <div class="mx-auto w-full max-w-3xl px-3">
          <div class="rounded border border-red-500 px-3 py-2 text-red-500">{String(err)}</div>
        </div>
      )}
    >
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 pb-20">
        <A
          href={back().href}
          class="flex w-fit items-center gap-1 text-sm text-blue-500 hover:underline dark:text-blue-400"
        >
          <span class="iconify lucide--arrow-left" />
          {back().label}
        </A>

        <Show when={!parsedCid().ok}>
          <div class="rounded border border-red-500 px-3 py-2 text-red-500">
            Invalid CID: {(parsedCid() as { ok: false; error: string }).error}
          </div>
        </Show>

        <Show when={parsedCid().ok && !repo.pds()}>
          <div class="rounded border border-amber-500 px-3 py-2 text-amber-600 dark:text-amber-400">
            PDS unavailable for this repo.
          </div>
        </Show>

        <Switch>
          <Match when={blob.loading}>
            <div class="self-center">
              <Spinner />
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
            {(b) => (
              <div class="flex flex-col gap-3 rounded border border-amber-500 px-3 py-3">
                <div class="text-amber-600 dark:text-amber-400">
                  Blob is {formatFileSize(b().size)} (over the {formatFileSize(SIZE_CAP)} auto-fetch
                  cap). The hash will not be verified until you fetch it.
                </div>
                <Show when={b().mimeType}>
                  <div class="text-sm text-neutral-600 dark:text-neutral-400">
                    Content-Type: {b().mimeType}
                  </div>
                </Show>
                <div class="flex gap-2">
                  <Button onClick={() => setOverrideCap(true)}>Fetch anyway</Button>
                  <a
                    href={blobUrl()}
                    target="_blank"
                    rel="noopener"
                    class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    <span class="iconify lucide--external-link" />
                    Open raw
                  </a>
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
            {(b) => {
              const unsupported = unsupportedHash();
              return (
                <>
                  <div class="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 rounded border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                    <div class="col-span-2">
                      <div class="text-neutral-500 dark:text-neutral-400">CID</div>
                      <div dir="rtl" class="truncate text-left">
                        {params.cid}
                      </div>
                    </div>
                    <span class="text-neutral-500 dark:text-neutral-400">Hash</span>
                    <span class="flex flex-col gap-1">
                      <span
                        class="flex items-center gap-1.5"
                        classList={{
                          "text-green-600 dark:text-green-400":
                            unsupported === undefined && b().matches,
                          "text-red-600 dark:text-red-400":
                            unsupported === undefined && !b().matches,
                          "text-amber-600 dark:text-amber-400": unsupported !== undefined,
                        }}
                      >
                        <span
                          class="shrink-0"
                          classList={{
                            "iconify lucide--check": unsupported === undefined && b().matches,
                            "iconify lucide--x": unsupported === undefined && !b().matches,
                            "iconify lucide--triangle-alert": unsupported !== undefined,
                          }}
                        />
                        <span>
                          {unsupported !== undefined ?
                            "Unsupported"
                          : b().matches ?
                            "Valid"
                          : "Mismatch"}
                        </span>
                      </span>
                      <Show when={unsupported === undefined && !b().matches}>
                        <div class="text-xs wrap-break-word text-neutral-600 dark:text-neutral-300">
                          Fetched bytes do not match the requested CID.
                          <div class="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 font-mono">
                            <span class="text-neutral-500 dark:text-neutral-400">expected</span>
                            <span class="wrap-anywhere">{toHex(b().expected)}</span>
                            <span class="text-neutral-500 dark:text-neutral-400">actual</span>
                            <span class="wrap-anywhere">{toHex(b().digest)}</span>
                          </div>
                        </div>
                      </Show>
                      <Show when={unsupported !== undefined}>
                        <div class="text-xs wrap-break-word text-neutral-600 dark:text-neutral-300">
                          Hash multicodec 0x{unsupported!.toString(16)} not recognized.
                        </div>
                      </Show>
                    </span>
                    <span class="text-neutral-500 dark:text-neutral-400">Size</span>
                    <span>{formatFileSize(b().size)}</span>
                    <span class="text-neutral-500 dark:text-neutral-400">MIME</span>
                    <span>{b().mimeType}</span>
                  </div>

                  <Show when={previewKind(b().mimeType) !== "none"}>
                    <Show when={previewKind(b().mimeType) === "image"}>
                      <ZoomableImage src={objectUrl()} class="h-auto max-h-96 max-w-fit" />
                    </Show>
                    <Show when={previewKind(b().mimeType) === "video"}>
                      <ErrorBoundary fallback={() => <span>Failed to load video</span>}>
                        <VideoPlayer did={params.repo!} cid={params.cid!} />
                      </ErrorBoundary>
                    </Show>
                    <Show when={previewKind(b().mimeType) === "audio"}>
                      <audio class="my-0.5 max-w-96" controls>
                        <source
                          src={blobUrl()}
                          type={b().mimeType === "audio/x-flac" ? "audio/flac" : b().mimeType}
                        />
                      </audio>
                    </Show>
                  </Show>

                  <a
                    href={blobUrl()}
                    target="_blank"
                    rel="noopener"
                    class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex w-fit items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
                  >
                    <span class="iconify lucide--external-link" />
                    Open raw
                  </a>
                </>
              );
            }}
          </Match>
        </Switch>
      </div>
    </ErrorBoundary>
  );
};
