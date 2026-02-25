import { A } from "@solidjs/router";
import { JSX, Show } from "solid-js";
import { agent, avatars, sessions, setOpenManager, setShowAddAccount } from "../auth/state";
import { setShowSearch } from "../components/search";

const baseCardClass =
  "group flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-neutral-700 transition-colors dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 hover:bg-neutral-50/50 dark:hover:bg-neutral-800";

const accentCard = {
  blue: `${baseCardClass} hover:border-blue-500 dark:hover:border-blue-400`,
  orange: `${baseCardClass} hover:border-red-500 dark:hover:border-red-400`,
  violet: `${baseCardClass} hover:border-emerald-500 dark:hover:border-emerald-400`,
};

const accentIcon = {
  blue: "text-neutral-400 dark:text-neutral-500 group-hover:text-blue-500 dark:group-hover:text-blue-400",
  orange:
    "text-neutral-400 dark:text-neutral-500 group-hover:text-red-500 dark:group-hover:text-red-400",
  violet:
    "text-neutral-400 dark:text-neutral-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400",
};

type Accent = "blue" | "orange" | "violet";

const CardContent = (props: {
  icon: string | JSX.Element;
  title: string;
  description: string;
  accent: Accent;
}) => (
  <>
    <span class="flex min-w-0 items-center gap-1.5 text-xs sm:text-base">
      {typeof props.icon === "string" ?
        <span class={`${props.icon} iconify shrink-0 ${accentIcon[props.accent]}`} />
      : props.icon}
      <span class="truncate font-medium">{props.title}</span>
    </span>
    <span class="text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
      {props.description}
    </span>
  </>
);

const ButtonCard = (props: {
  onClick: () => void;
  icon: string | JSX.Element;
  title: string;
  description: string;
  accent: Accent;
}) => (
  <button onClick={props.onClick} class={`${accentCard[props.accent]} text-left`}>
    <CardContent
      icon={props.icon}
      title={props.title}
      description={props.description}
      accent={props.accent}
    />
  </button>
);

const LinkCard = (props: {
  href: string;
  icon: string | JSX.Element;
  title: string;
  description: string;
  accent: Accent;
}) => (
  <A href={props.href} class={accentCard[props.accent]}>
    <CardContent
      icon={props.icon}
      title={props.title}
      description={props.description}
      accent={props.accent}
    />
  </A>
);

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
      {/* Welcome Section */}
      <div class="flex flex-col gap-1">
        <h1 class="text-lg font-medium">Atmosphere Explorer</h1>
        <div class="text-sm text-neutral-600 dark:text-neutral-300/80">
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

      <div class="flex flex-col gap-3 text-sm">
        <div class="grid grid-cols-2 gap-2 text-sm">
          <ButtonCard
            onClick={() => setShowSearch(true)}
            icon="lucide--search"
            title="Search"
            description="Find any user or record"
            accent="blue"
          />
          <Show
            when={agent()?.sub && sessions[agent()!.sub]?.signedIn}
            fallback={
              <ButtonCard
                onClick={() => {
                  setOpenManager(true);
                  setShowAddAccount(true);
                }}
                icon="lucide--user-round"
                title="Sign in"
                description="Manage records"
                accent="blue"
              />
            }
          >
            <LinkCard
              href={`/at://${agent()!.sub}`}
              icon={
                avatars[agent()!.sub] ?
                  <img
                    src={avatars[agent()!.sub].replace("img/avatar/", "img/avatar_thumbnail/")}
                    class="size-4 shrink-0 rounded-full sm:size-5"
                  />
                : "lucide--user-round"
              }
              title={sessions[agent()!.sub]?.handle ?? agent()!.sub}
              description="View your repo"
              accent="blue"
            />
          </Show>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <LinkCard
            href="/jetstream"
            icon="lucide--radio-tower"
            title="Jetstream"
            description="Simplified stream"
            accent="orange"
          />
          <LinkCard
            href="/firehose"
            icon="lucide--rss"
            title="Firehose"
            description="Raw event stream"
            accent="orange"
          />
          <LinkCard
            href="/spacedust"
            icon="lucide--sparkles"
            title="Spacedust"
            description="Backlinks stream"
            accent="orange"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <LinkCard
            href="/labels"
            icon="lucide--tag"
            title="Labels"
            description="Query labeler services"
            accent="violet"
          />
          <LinkCard
            href="/car"
            icon="lucide--folder-archive"
            title="Archive"
            description="Explore CAR files"
            accent="violet"
          />
        </div>
      </div>

      <div class="flex justify-center gap-1.5 text-sm text-neutral-600 sm:gap-2 sm:text-base dark:text-neutral-300">
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
