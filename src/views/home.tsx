import { A } from "@solidjs/router";

export const Home = () => {
  return (
    <div class="flex w-full flex-col gap-6 px-2 wrap-break-word">
      <div class="flex flex-col gap-3">
        <h1 class="text-xl font-semibold">Atmosphere Explorer</h1>

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
              <div class="iconify lucide--search" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Browse the public data on atproto
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Inspect the content of any PDS
              </span>
            </a>
            <a
              href="https://constellation.microcosm.blue"
              target="_blank"
              class="group grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5 hover:text-blue-500 dark:hover:text-blue-400"
            >
              <div class="iconify lucide--link" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Backlinks support with constellation
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Track links to any record or repository
              </span>
            </a>
            <div class="grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-0.5">
              <div class="iconify lucide--user-round" />
              <span>Sign in to manage your account</span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Create, edit, and delete records
              </span>
            </div>
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
              <div class="iconify lucide--antenna" />
              <span class="underline decoration-transparent group-hover:decoration-current">
                Firehose
              </span>
              <div />
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                Raw repository event stream
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

      <div class="text-center text-sm text-neutral-700 dark:text-neutral-300">
        Made by{" "}
        <a
          href="https://juli.ee"
          class="font-pecita relative text-rose-400 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-300 after:ease-out hover:after:w-full dark:text-rose-300"
        >
          Juliet
        </a>{" "}
        with love
      </div>
    </div>
  );
};
