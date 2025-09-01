import { A } from "@solidjs/router";

const Home = () => {
  return (
    <div class="mt-4 flex w-[22rem] flex-col gap-3 break-words sm:w-[24rem]">
      <div>
        <div>
          <span class="font-semibold">AT Protocol Explorer</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--search" />
          <span>
            Browse the public data on{" "}
            <a
              class="text-blue-400 hover:underline active:underline"
              href="https://atproto.com"
              target="_blank"
            >
              atproto
            </a>
            .
          </span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--user-round" />
          <span>Login to manage records in your repo.</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--radio-tower" />
          <div>
            <A href="/jetstream" class="text-blue-400 hover:underline active:underline">
              Jetstream
            </A>{" "}
            and{" "}
            <A href="/firehose" class="text-blue-400 hover:underline active:underline">
              firehose
            </A>{" "}
            streaming.
          </div>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--send-to-back" />
          <span>
            Backlinks support with{" "}
            <A
              href="https://constellation.microcosm.blue"
              class="text-blue-400 hover:underline active:underline"
              target="_blank"
            >
              constellation
            </A>
            .
          </span>
        </div>
      </div>
      <div>
        <span class="font-semibold">Examples</span>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--hard-drive" />
          <A href="/pds.kelinci.net" class="text-blue-400 hover:underline active:underline">
            https://pds.kelinci.net
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--book-user" />
          <A
            href="/at://did:plc:vwzwgnygau7ed7b7wt5ux7y2"
            class="text-blue-400 hover:underline active:underline"
          >
            at://did:plc:vwzwgnygau7ed7b7wt5ux7y2
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--file-json shrink-0" />
          <A
            href="/at://did:plc:oisofpd7lj26yvgiivf3lxsi/app.bsky.actor.profile/self"
            class="text-blue-400 hover:underline active:underline"
          >
            at://hailey.at/app.bsky.actor.profile/self
          </A>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--tag" />
          <A
            href="/at://did:plc:wkoofae5uytcm7bjncmev6n6/labels"
            class="text-blue-400 hover:underline active:underline"
          >
            at://pronouns.diy/labels
          </A>
        </div>
      </div>
      <div class="flex gap-2">
        <A href="https://tangled.sh/@pdsls.dev/pdsls/" target="_blank">
          <div class="iconify i-tangled text-xl" />
        </A>
        <A href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz" target="_blank">
          <div class="iconify tabler--brand-bluesky text-xl" />
        </A>
      </div>
    </div>
  );
};

export { Home };
