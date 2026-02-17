import { A } from "@solidjs/router";
import { createSignal, For, JSX, onCleanup, onMount } from "solid-js";
import { setOpenManager, setShowAddAccount } from "../auth/state";
import { Button } from "../components/button";
import { Favicon } from "../components/favicon";
import { JSONValue } from "../components/json";
import { SearchButton } from "../components/search";

const SLIDES = ["Record", "Repository", "PDS"] as const;

const slideLinks = [
  "/at://did:plc:ia76kvnndjutgedggx2ibrem/app.bsky.feed.post/3kenlltlvus2u",
  "/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2",
  "/npmx.social",
] as const;

const exampleRecord = {
  text: "ma'am do you know where the petard is, i'd like to hoist myself with it",
  $type: "app.bsky.feed.post",
  langs: ["en"],
  createdAt: "2023-11-20T21:44:21.000Z",
};

const exampleCollections = [
  { authority: "app.bsky", nsids: ["actor.profile", "feed.post", "feed.like", "graph.follow"] },
  { authority: "sh.tangled", nsids: ["actor.profile", "repo.pull"] },
  { authority: "place.stream", nsids: ["chat.message"] },
];

const exampleRepos = [
  "did:plc:ty2jdjtqqq4jn7kk7p3mpwae",
  "did:plc:byfvayavc7z2ldyu6bu5myz2",
  "did:plc:n34gdj7o3o6ktuxp5qfbgllu",
  "did:plc:vh7y4mqklsu2uui5tlwl42dy",
  "did:plc:uz76j2yr2ps7apdxtlgqljwk",
];

const ExplorerShowcase = () => {
  const [slide, setSlide] = createSignal(0);

  onMount(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    onCleanup(() => clearInterval(id));
  });

  return (
    <div class="flex flex-col gap-1.5">
      <A
        href={slideLinks[slide()]}
        class="relative block h-42 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 transition-colors hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600"
      >
        {/* Record slide */}
        <div
          class="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap transition-opacity duration-700 sm:text-sm"
          classList={{ "opacity-0": slide() !== 0 }}
        >
          <JSONValue data={exampleRecord as any} repo="did:plc:ia76kvnndjutgedggx2ibrem" />
        </div>

        {/* Collections slide */}
        <div
          class="pointer-events-none absolute inset-0 flex flex-col gap-1 overflow-hidden px-3 py-2 text-sm wrap-anywhere transition-opacity duration-700"
          classList={{ "opacity-0": slide() !== 1 }}
        >
          <For each={exampleCollections}>
            {({ authority, nsids }) => (
              <div class="flex items-start gap-2">
                <Favicon authority={authority} />
                <div class="flex flex-col">
                  <For each={nsids}>
                    {(nsid) => (
                      <span>
                        <span class="text-neutral-500 dark:text-neutral-400">{authority}.</span>
                        <span>{nsid}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Repos slide */}
        <div
          class="pointer-events-none absolute inset-0 overflow-hidden py-0.5 transition-opacity duration-700"
          classList={{ "opacity-0": slide() !== 2 }}
        >
          <For each={exampleRepos}>
            {(did) => (
              <div class="flex min-w-0 items-center gap-2 p-1.5 font-mono text-sm">
                <span class="flex shrink-0 items-center text-neutral-400 dark:text-neutral-500">
                  <span class="iconify lucide--chevron-right" />
                </span>
                <span class="truncate text-blue-500 dark:text-blue-400">{did}</span>
              </div>
            )}
          </For>
        </div>
      </A>

      {/* Slide indicator */}
      <div class="flex items-center justify-between px-0.5">
        <span class="text-xs text-neutral-400 dark:text-neutral-500">{SLIDES[slide()]}</span>
        <div class="flex gap-1">
          <For each={SLIDES}>
            {(_, i) => (
              <button
                onClick={() => setSlide(i())}
                class="h-1 rounded-full transition-all duration-300"
                classList={{
                  "w-4 bg-neutral-400 dark:bg-neutral-500": slide() === i(),
                  "w-1.5 bg-neutral-300 dark:bg-neutral-600": slide() !== i(),
                }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export const Home = () => {
  const FooterLink = (props: {
    href: string;
    color: string;
    darkColor?: string;
    children: JSX.Element;
  }) => (
    <a
      href={props.href}
      class={`relative flex items-center gap-1.5 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current ${props.color} after:transition-[width] after:duration-300 after:ease-out hover:after:w-full ${props.darkColor ?? ""}`}
      target="_blank"
    >
      {props.children}
    </a>
  );

  return (
    <div class="flex w-full flex-col gap-5 px-2 wrap-break-word">
      {/* Welcome Section */}
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-lg font-medium">Atmosphere Explorer</h1>
          <div class="text-sm text-neutral-600 dark:text-neutral-300">
            <p>
              Browse the public data on the{" "}
              <a
                href="https://atproto.com"
                target="_blank"
                class="underline decoration-neutral-400 transition-colors hover:text-blue-500 hover:decoration-blue-500 dark:decoration-neutral-500 dark:hover:text-blue-400"
              >
                AT Protocol
              </a>
            </p>
          </div>
        </div>

        <ExplorerShowcase />

        <div class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <SearchButton />
          <span>to find any account</span>
        </div>
        <div class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Button
            onClick={() => {
              setOpenManager(true);
              setShowAddAccount(true);
            }}
          >
            <span class="iconify lucide--user-round"></span>
            Sign in
          </Button>
          <span>to manage records</span>
        </div>
      </div>

      <div class="flex flex-col gap-4 text-sm">
        <div class="flex flex-col gap-2">
          <A
            href="/jetstream"
            class="group grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-neutral-700 transition-colors hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <div class="iconify lucide--radio-tower" />
            <span class="underline decoration-transparent group-hover:decoration-current">
              Jetstream
            </span>
            <div />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Event stream with filtering
            </span>
          </A>
          <A
            href="/firehose"
            class="group grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-neutral-700 transition-colors hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <div class="iconify lucide--rss" />
            <span class="underline decoration-transparent group-hover:decoration-current">
              Firehose
            </span>
            <div />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Raw relay event stream
            </span>
          </A>
          <A
            href="/spacedust"
            class="group grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-neutral-700 transition-colors hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <div class="iconify lucide--orbit" />
            <span class="underline decoration-transparent group-hover:decoration-current">
              Spacedust
            </span>
            <div />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Interaction links stream
            </span>
          </A>
        </div>

        <div class="flex flex-col gap-2">
          <A
            href="/labels"
            class="group grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-neutral-700 transition-colors hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <div class="iconify lucide--tag" />
            <span class="underline decoration-transparent group-hover:decoration-current">
              Labels
            </span>
            <div />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Query labeler services
            </span>
          </A>
          <A
            href="/car"
            class="group grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-neutral-700 transition-colors hover:text-blue-500 dark:text-neutral-300 dark:hover:text-blue-400"
          >
            <div class="iconify lucide--folder-archive" />
            <span class="underline decoration-transparent group-hover:decoration-current">
              Archive
            </span>
            <div />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Explore and unpack CAR files
            </span>
          </A>
        </div>
      </div>

      <div class="flex justify-center gap-1.5 text-sm text-neutral-600 sm:gap-2 dark:text-neutral-300">
        <FooterLink
          href="https://juli.ee"
          color="after:text-rose-400"
          darkColor="dark:after:text-rose-300"
        >
          <span class="iconify lucide--terminal text-rose-400 dark:text-rose-300"></span>
          <span class="font-pecita">juliet</span>
        </FooterLink>
        •
        <FooterLink href="https://raycast.com/juliet_philippe/pdsls" color="after:text-[#FF6363]">
          <span class="iconify-color i-raycast-light block dark:hidden"></span>
          <span class="iconify-color i-raycast-dark hidden dark:block"></span>
          Raycast
        </FooterLink>
        •
        <FooterLink
          href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz"
          color="after:text-[#0085ff]"
        >
          <span class="simple-icons--bluesky iconify text-[#0085ff]"></span>
          Bluesky
        </FooterLink>
        •
        <FooterLink
          href="https://tangled.org/did:plc:6q5daed5gutiyerimlrnojnz/pdsls/"
          color="after:text-black"
          darkColor="dark:after:text-white"
        >
          <span class="iconify i-tangled text-black dark:text-white"></span>
          Source
        </FooterLink>
      </div>
    </div>
  );
};
