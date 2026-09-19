import { A } from "@solidjs/router";
import { For, JSX } from "solid-js";

const repositoryExamples = [
  {
    type: "Repo",
    value: "@retr0.id",
    href: "/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2",
  },
  {
    type: "Record",
    value: "at://futur.blue/app.bsky.actor.profile/self",
    href: "/at://did:plc:uu5axsmbm2or2dngy4gwchec/app.bsky.actor.profile/self",
  },
  {
    type: "PDS",
    value: "pds.witchcraft.systems",
    href: "/pds.witchcraft.systems",
  },
  {
    type: "Lexicon",
    value: "site.standard.document",
    href: "/at://did:plc:re3ebnp5v7ffagz6rb6xfei4/com.atproto.lexicon.schema/site.standard.document#schema",
  },
  {
    type: "Labels",
    value: "moderation.bsky.app",
    href: "/at://did:plc:ar7c4by46qjdydhdevvrndac#labels",
  },
  {
    type: "Backlinks",
    value: "mary.my.id",
    href: "/at://did:plc:ia76kvnndjutgedggx2ibrem#backlinks",
  },
];

const streamLinks = [
  {
    label: "Jetstream",
    icon: "lucide--radio-tower",
    href: "/streams?type=jetstream",
  },
  {
    label: "Firehose",
    icon: "lucide--rss",
    href: "/streams?type=firehose",
  },
  {
    label: "Spacedust",
    icon: "lucide--sparkles",
    href: "/streams?type=spacedust",
  },
];

const defaultAtProtocolUrl = "https://atproto.com";
const atProtoRefererUrl = "https://at-proto.com";

const getAtProtocolUrl = () => {
  try {
    return new URL(document.referrer).hostname === "at-proto.com"
      ? atProtoRefererUrl
      : defaultAtProtocolUrl;
  } catch {
    return defaultAtProtocolUrl;
  }
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

  document.title = "PDSls";
  return (
    <div class="flex min-h-[calc(100dvh-6rem)] w-full flex-col px-2 wrap-break-word">
      <section class="flex flex-1 flex-col items-center justify-center py-10 text-center sm:pb-16">
        <h1 class="text-2xl font-semibold tracking-tight">Explore the Atmosphere</h1>
        <a
          href={getAtProtocolUrl()}
          target="_blank"
          class="mt-3 text-xs text-neutral-500 underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-blue-500 hover:decoration-blue-500 dark:text-neutral-400 dark:decoration-neutral-600 dark:hover:text-blue-400"
        >
          About AT Protocol
        </a>

        <div class="mt-6 w-full max-w-lg text-left">
          <div class="rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Browse</h2>
            <div class="mt-1 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <For each={repositoryExamples}>
                {(example) => (
                  <A
                    href={example.href}
                    class="flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-1.5 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <span class="w-16 shrink-0 text-[10px] font-medium tracking-wide text-neutral-400 uppercase dark:text-neutral-500">
                      {example.type}
                    </span>
                    <span class="truncate text-xs text-neutral-600 dark:text-neutral-300">
                      {example.value}
                    </span>
                  </A>
                )}
              </For>
            </div>
          </div>

          <div class="mt-3 rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Stream</h2>
            <div class="grid grid-cols-3 gap-1">
              <For each={streamLinks}>
                {(stream) => (
                  <A
                    href={stream.href}
                    class="flex min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-2 sm:text-sm dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <span
                      class={`iconify ${stream.icon} shrink-0 text-neutral-500 dark:text-neutral-400`}
                    />
                    <span class="truncate">{stream.label}</span>
                  </A>
                )}
              </For>
            </div>
          </div>

          <div class="mt-3 rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Manage</h2>
            <div class="grid grid-cols-2 gap-1">
              <A
                href="/account/add"
                class="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-xs text-neutral-600 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-2 sm:text-sm dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
              >
                <span class="iconify lucide--user-round-plus shrink-0 text-neutral-500 dark:text-neutral-400" />
                Add account
              </A>
              <A
                href="/spaces"
                class="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-xs text-neutral-600 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-2 sm:text-sm dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
              >
                <span class="iconify lucide--lock-keyhole shrink-0 text-neutral-500 dark:text-neutral-400" />
                Spaces
              </A>
            </div>
          </div>
        </div>
      </section>

      <footer class="flex justify-center gap-1.5 pb-2 text-sm text-neutral-500 sm:gap-2 dark:text-neutral-400">
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
          href="https://tangled.org/did:plc:6q5daed5gutiyerimlrnojnz/3lvzxnfwb7u22"
          color="after:text-black"
          darkColor="dark:after:text-white"
        >
          <span class="iconify i-tangled text-black dark:text-white"></span>
          Source
        </FooterLink>
      </footer>
    </div>
  );
};
