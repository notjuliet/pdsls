import { A } from "@solidjs/router";
import { For, JSX } from "solid-js";
import { setOpenManager, setShowAddAccount } from "../auth/state";
import { Button } from "../components/button";
import { SearchButton } from "../components/search";

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
    { did: "did:plc:oisofpd7lj26yvgiivf3lxsi", handle: "hailey.at" },
    { did: "did:plc:vwzwgnygau7ed7b7wt5ux7y2", handle: "retr0.id" },
    { did: "did:plc:uu5axsmbm2or2dngy4gwchec", handle: "futur.blue" },
    { did: "did:plc:ia76kvnndjutgedggx2ibrem", handle: "mary.my.id" },
    { did: "did:plc:hdhoaan3xa3jiuq4fg4mefid", handle: "bad-example.com" },
    { did: "did:plc:q6gjnaw2blty4crticxkmujt", handle: "jaz.sh" },
    { did: "did:plc:jrtgsidnmxaen4offglr5lsh", handle: "quilling.dev" },
    { did: "did:plc:3c6vkaq7xf5kz3va3muptjh5", handle: "aylac.top" },
    { did: "did:plc:gwd5r7dbg3zv6dhv75hboa3f", handle: "mofu.run" },
    { did: "did:plc:tzrpqyerzt37pyj54hh52xrz", handle: "rainy.pet" },
    { did: "did:plc:qx7in36j344d7qqpebfiqtew", handle: "futanari.observer" },
    { did: "did:plc:ucaezectmpny7l42baeyooxi", handle: "sapphic.moe" },
    { did: "did:plc:6v6jqsy7swpzuu53rmzaybjy", handle: "computer.fish" },
    { did: "did:plc:w4nvvt6feq2l3qgnwl6a7g7d", handle: "emilia.wtf" },
    { did: "did:plc:xwhsmuozq3mlsp56dyd7copv", handle: "paizuri.moe" },
    { did: "did:plc:aokggmp5jzj4nc5jifhiplqc", handle: "dreary.blacksky.app" },
    { did: "did:plc:k644h4rq5bjfzcetgsa6tuby", handle: "natalie.sh" },
    { did: "did:plc:ttdrpj45ibqunmfhdsb4zdwq", handle: "nekomimi.pet" },
    { did: "did:plc:fz2tul67ziakfukcwa3vdd5d", handle: "nullekko.moe" },
    { did: "did:plc:qxichs7jsycphrsmbujwqbfb", handle: "isabelroses.com" },
    { did: "did:plc:fnvdhaoe7b5abgrtvzf4ttl5", handle: "isuggest.selfce.st" },
    { did: "did:plc:p5yjdr64h7mk5l3kh6oszryk", handle: "blooym.dev" },
    { did: "did:plc:hvakvedv6byxhufjl23mfmsd", handle: "number-one-warned.rat.mom" },
    { did: "did:plc:6if5m2yo6kroprmmency3gt5", handle: "olaren.dev" },
    { did: "did:plc:w7adfxpixpi77e424cjjxnxy", handle: "anyaustin.bsky.social" },
    { did: "did:plc:h6as5sk7tfqvvnqvfrlnnwqn", handle: "cwonus.org" },
    { did: "did:plc:mo7bk6gblylupvhetkqmndrv", handle: "claire.on-her.computer" },
    { did: "did:plc:73gqgbnvpx5syidcponjrics", handle: "coil-habdle.ebil.club" },
    { did: "did:plc:gy5roooborfiyvl2xadsam3e", handle: "slug.moe" },
    { did: "did:plc:dadnngq7hpnuglhxm556wgzi", handle: "drunk.moe" },
    { did: "did:plc:ra3gxl2udc22odfbvcfslcn3", handle: "notnite.com" },
    { did: "did:plc:h5wsnqetncv6lu2weom35lg2", handle: "nel.pet" },
    { did: "did:plc:irs2tcoeuvuwj3m4yampbuco", handle: "shi.gg" },
    { did: "did:plc:vafqb3yhndyawabm2t2zhw5z", handle: "neko.moe.observer" },
  ];

  for (let i = allExampleProfiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allExampleProfiles[i], allExampleProfiles[j]] = [allExampleProfiles[j], allExampleProfiles[i]];
  }
  const profiles = allExampleProfiles.slice(0, 3);

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
        <section class="mb-1 flex flex-col gap-3">
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
                    classList={{
                      "animate-[spin_5s_linear_infinite] [animation-play-state:paused] group-hover:[animation-play-state:running]":
                        profile.handle === "coil-habdle.ebil.club",
                    }}
                  />
                  <span class="w-full truncate px-0.5 text-center text-xs text-neutral-600 dark:text-neutral-300">
                    @{profile.handle}
                  </span>
                </A>
              )}
            </For>
          </div>
        </section>
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
