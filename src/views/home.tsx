import { A } from "@solidjs/router";
import { JSX } from "solid-js";
import { setOpenManager } from "../auth/state.js";

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
    <div class="flex w-full flex-col gap-6 px-2 wrap-break-word">
      <div class="flex flex-col gap-3">
        <h1 class="text-lg font-semibold">Atmosphere Explorer</h1>

        {/* Explore Section */}
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Explore
          </h2>
          <div class="flex flex-col gap-2">
            <a
              href="https://atproto.com"
              target="_blank"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--at-sign" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Browse the public data on atproto
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Inspect the content of any PDS
              </span>
            </a>
            <a
              href="https://microcosm.blue"
              target="_blank"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--sparkle" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Backlinks support with constellation
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Track links to any record or repository
              </span>
            </a>
            <button
              onclick={() => setOpenManager(true)}
              class="group grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 text-left hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--user-round-pen" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Sign in to manage your account
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Create, edit, and delete records
              </span>
            </button>
          </div>
        </section>

        {/* Relay Section */}
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Relay
          </h2>
          <div class="flex flex-col gap-2">
            <A
              href="/jetstream"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--radio-tower" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Jetstream
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Simplified JSON event stream
              </span>
            </A>
            <A
              href="/firehose"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--rss" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Firehose
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Raw repository event stream
              </span>
            </A>
            <A
              href="/spacedust"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--orbit" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Spacedust
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Interaction links event stream
              </span>
            </A>
          </div>
        </section>

        {/* Tools Section */}
        <section class="flex flex-col gap-2">
          <h2 class="text-sm font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Tools
          </h2>
          <div class="flex flex-col gap-2">
            <A
              href="/labels"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--tag" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Labels
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Query labels from moderation services
              </span>
            </A>
            <A
              href="/car"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--folder-archive" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Archive
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Explore and unpack repository archives
              </span>
            </A>
          </div>
        </section>
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
        {/* • */}
        {/* <FooterLink href="https://raycast.com/" color="after:text-[#FF6363]"> */}
        {/*   <span class="iconify-color i-raycast-light block dark:hidden"></span> */}
        {/*   <span class="iconify-color i-raycast-dark hidden dark:block"></span> */}
        {/*   Raycast */}
        {/* </FooterLink> */}•
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
