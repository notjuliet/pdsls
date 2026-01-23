import { A } from "@solidjs/router";
import { For, JSX } from "solid-js";
import { setOpenManager } from "../auth/state";

type ProfileData = {
  did: string;
  handle: string;
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

  const allExampleProfiles: ProfileData[] = [
    { did: "did:plc:7vimlesenouvuaqvle42yhvo", handle: "juli.ee" },
    { did: "did:plc:oisofpd7lj26yvgiivf3lxsi", handle: "hailey.at" },
    { did: "did:plc:vwzwgnygau7ed7b7wt5ux7y2", handle: "retr0.id" },
    { did: "did:plc:oky5czdrnfjpqslsw2a5iclo", handle: "jay.bsky.team" },
    { did: "did:plc:ragtjsm2j2vknwkz3zp4oxrd", handle: "pfrazee.com" },
    { did: "did:plc:vc7f4oafdgxsihk4cry2xpze", handle: "jcsalterego.bsky.social" },
    { did: "did:plc:uu5axsmbm2or2dngy4gwchec", handle: "futur.blue" },
    { did: "did:plc:ia76kvnndjutgedggx2ibrem", handle: "mary.my.id" },
    { did: "did:plc:fpruhuo22xkm5o7ttr2ktxdo", handle: "danabra.mov" },
    { did: "did:plc:hdhoaan3xa3jiuq4fg4mefid", handle: "bad-example.com" },
    { did: "did:plc:yk4dd2qkboz2yv6tpubpc6co", handle: "dholms.at" },
    { did: "did:plc:q6gjnaw2blty4crticxkmujt", handle: "jaz.sh" },
  ];

  const profiles = [...allExampleProfiles].sort(() => Math.random() - 0.5).slice(0, 3);

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

        {/* Example Repos */}
        <section class="flex flex-col gap-3">
          <div class="flex justify-between">
            <For each={profiles}>
              {(profile) => (
                <A
                  href={`/at://${profile.did}`}
                  class="group flex min-w-0 basis-1/3 flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-105"
                >
                  <img
                    src={`/avatar/${profile.handle}.jpg`}
                    alt={`Bluesky profile picture of ${profile.handle}`}
                    class="size-16 rounded-full ring-2 ring-transparent transition-all group-hover:ring-blue-500 active:ring-blue-500 dark:group-hover:ring-blue-400 dark:active:ring-blue-400"
                  />
                  <span class="w-full truncate text-center text-xs text-neutral-600 dark:text-neutral-300">
                    @{profile.handle}
                  </span>
                </A>
              )}
            </For>
          </div>
        </section>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          or use the search{" "}
          <kbd class="rounded bg-neutral-200 px-1 py-0.5 font-mono text-[10px] dark:bg-neutral-700">
            Ctrl+K
          </kbd>{" "}
          to find any account
        </p>
        <button
          type="button"
          onclick={() => setOpenManager(true)}
          class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 w-fit rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
        >
          Sign in to manage records
        </button>
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
