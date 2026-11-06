import { A } from "@solidjs/router";
import { For, JSX } from "solid-js";

import { agent } from "../auth/state.js";
import { AtmosphereGlobe } from "../components/atmosphere-globe.jsx";
import { STREAM_CONFIGS, STREAM_TYPES } from "./stream/config";

const repositoryExamples = [
  {
    type: "Repo",
    value: "@atproto.com",
    href: "/at://did:plc:ewvi7nxzyoun6zhxrhs64oiz",
  },
  {
    type: "Record",
    value: "at://pds.ls/app.bsky.actor.profile/self",
    href: "/at://did:plc:6q5daed5gutiyerimlrnojnz/app.bsky.actor.profile/self",
  },
  {
    type: "PDS",
    value: "selfhosted.social",
    href: "/selfhosted.social",
  },
  {
    type: "Lexicon",
    value: "place.stream.chat.message",
    href: "/at://did:web:stream.place/com.atproto.lexicon.schema/place.stream.chat.message#schema",
  },
  {
    type: "Labels",
    value: "recordcollector.edavis.dev",
    href: "/at://did:plc:vfibt4bgozsdx6rnnnpha3x7#labels",
  },
  {
    type: "Backlinks",
    value: "microcosm.blue",
    href: "/at://did:plc:lulmyldiq4sb2ikags5sfb25#backlinks",
  },
];

// Signed out, adding an account is signing in.
const manageLinks = () => [
  {
    label: agent() ? "Add account" : "Sign in",
    summary: "Manage your records",
    href: "/account/add",
  },
  { label: "Spaces", summary: "Non-public data", href: "/spaces" },
];

// Apps floating in an arc above the horizon.
const atmosphereApps: {
  name: string;
  /** Where its logo links to. */
  domain: string;
  /** A bundled icon, with its color. */
  icon?: string;
  /** A logo in `public/logos`, for those that have to keep their own colors. */
  image?: string;
  size: number;
  /** Fades less on the light theme, for a logo too pale to take the usual amount. */
  pale?: boolean;
  rotate: number;
  position: { x: string; y: string };
  /** Where it goes on small screens, following the tighter curve of the horizon. */
  compact: { x: string; y: string };
}[] = [
  {
    name: "Bluesky",
    domain: "bsky.app",
    icon: "simple-icons--bluesky text-[#0085ff]",
    size: 30,
    rotate: -8,
    position: { x: "5%", y: "22%" },
    compact: { x: "4%", y: "16%" },
  },
  {
    name: "Leaflet",
    domain: "leaflet.pub",
    image: "/logos/leaflet.svg",
    size: 24,
    rotate: 6,
    position: { x: "38%", y: "2%" },
    compact: { x: "36%", y: "0%" },
  },
  {
    name: "pckt",
    domain: "pckt.blog",
    image: "/logos/pckt.svg",
    size: 22,
    rotate: -5,
    position: { x: "22%", y: "10%" },
    compact: { x: "20%", y: "6%" },
  },
  {
    name: "Tangled",
    domain: "tangled.org",
    icon: "i-tangled text-neutral-700 dark:text-white",
    size: 28,
    rotate: 8,
    position: { x: "58%", y: "0%" },
    compact: { x: "56%", y: "0%" },
  },
  {
    name: "Streamplace",
    domain: "stream.place",
    icon: "i-streamplace text-neutral-700 dark:text-white",
    size: 26,
    rotate: -6,
    position: { x: "74%", y: "8%" },
    compact: { x: "72%", y: "6%" },
  },
  {
    name: "wisp.place",
    domain: "wisp.place",
    image: "/logos/wisp.svg",
    size: 38,
    pale: true,
    rotate: 5,
    position: { x: "89%", y: "16.5%" },
    compact: { x: "87%", y: "13.5%" },
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
        <div class="relative isolate flex w-full flex-col items-center pt-14 pb-6 sm:pt-16">
          <AtmosphereGlobe class="atmosphere-fade pointer-events-none absolute inset-x-0 -top-8 bottom-0 -z-10 h-[calc(100%+2rem)] w-full" />
          <For each={atmosphereApps}>
            {(app) => (
              <a
                href={`https://${app.domain}`}
                target="_blank"
                rel="noopener"
                aria-label={app.name}
                title={app.name}
                class="absolute top-(--compact-y) left-(--compact-x) text-[calc(var(--size)*0.75px)] transition duration-200 before:absolute before:-inset-2 before:content-[''] hover:scale-110 hover:opacity-100 sm:top-(--y) sm:left-(--x) sm:text-[calc(var(--size)*1px)]"
                classList={{
                  "opacity-70": !app.pale,
                  "opacity-85 dark:opacity-70 dark:hover:opacity-100": app.pale,
                }}
                style={{
                  "--x": app.position.x,
                  "--y": app.position.y,
                  "--compact-x": app.compact.x,
                  "--compact-y": app.compact.y,
                  "--size": app.size,
                  rotate: `${app.rotate}deg`,
                }}
              >
                {app.icon ? (
                  <span class={`iconify block ${app.icon}`} />
                ) : (
                  <img src={app.image} alt="" class="size-[1em] object-contain" />
                )}
              </a>
            )}
          </For>
          <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl dark:[text-shadow:0_1px_10px_rgb(0_0_0/0.65)]">
            Explore the Atmosphere
          </h1>
          <a
            href={getAtProtocolUrl()}
            target="_blank"
            class="mt-3 text-xs text-neutral-600 underline decoration-neutral-400 underline-offset-2 transition-colors hover:text-blue-500 hover:decoration-blue-500 dark:text-neutral-200 dark:decoration-neutral-600 dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.7)] dark:hover:text-blue-400"
          >
            About AT Protocol
          </a>
        </div>

        <div class="mt-6 w-full text-left">
          <div class="rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Browse</h2>
            <div class="mt-1 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
              <For each={repositoryExamples}>
                {(example) => (
                  <A
                    href={example.href}
                    class="flex min-w-0 items-baseline gap-2 rounded-md px-2 py-1 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-1.5 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <span class="w-16 shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                      {example.type}
                    </span>
                    <span class="truncate text-xs text-neutral-800 dark:text-neutral-200">
                      {example.value}
                    </span>
                  </A>
                )}
              </For>
            </div>
          </div>

          <div class="mt-3 rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Stream</h2>
            <div class="grid grid-cols-2 gap-1 sm:grid-cols-4">
              <For each={STREAM_TYPES}>
                {(type) => (
                  <A
                    href={`/streams?type=${type}`}
                    class="flex min-w-0 flex-col items-center justify-center rounded-md px-1.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-2 sm:text-sm dark:text-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <span class="max-w-full truncate">{STREAM_CONFIGS[type].label}</span>
                    <span class="max-w-full truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {STREAM_CONFIGS[type].summary}
                    </span>
                  </A>
                )}
              </For>
            </div>
          </div>

          <div class="mt-3 rounded-lg border border-neutral-200 p-2 sm:p-3 dark:border-neutral-700">
            <h2 class="px-2 py-1 text-sm font-medium sm:text-base">Manage</h2>
            <div class="grid grid-cols-2 gap-1">
              <For each={manageLinks()}>
                {(link) => (
                  <A
                    href={link.href}
                    class="flex min-w-0 flex-col items-center justify-center rounded-md px-1.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-200/60 active:bg-neutral-200 sm:py-2 sm:text-sm dark:text-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  >
                    <span class="max-w-full truncate">{link.label}</span>
                    <span class="max-w-full truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {link.summary}
                    </span>
                  </A>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      <footer class="flex justify-center gap-4 pb-2 text-sm text-neutral-500 dark:text-neutral-400">
        <FooterLink href="https://raycast.com/juliet_philippe/pdsls" color="after:text-[#FF6363]">
          <span class="iconify-color i-raycast-light block dark:hidden"></span>
          <span class="iconify-color i-raycast-dark hidden dark:block"></span>
          Raycast
        </FooterLink>
        <FooterLink
          href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz"
          color="after:text-[#0085ff]"
        >
          <span class="simple-icons--bluesky iconify text-[#0085ff]"></span>
          Bluesky
        </FooterLink>
        <FooterLink
          href="https://tangled.org/pds.ls/pdsls"
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
