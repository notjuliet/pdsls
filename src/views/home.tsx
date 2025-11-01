export const Home = () => {
  return (
    <div class="flex w-full flex-col gap-4 wrap-break-word">
      <div>
        <div>
          <span class="text-lg font-semibold">AT Protocol Explorer</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--search" />
          <span>
            Browse the public data on{" "}
            <a class="underline" href="https://atproto.com" target="_blank">
              atproto
            </a>
            .
          </span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--user-round" />
          <span>Login to manage records in your repository.</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--radio-tower" />
          <span>Jetstream and firehose streaming.</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--send-to-back" />
          <span>
            Backlinks support with{" "}
            <a href="https://constellation.microcosm.blue" class="underline" target="_blank">
              constellation
            </a>
            .
          </span>
        </div>
        <div class="flex items-center gap-1">
          <div class="iconify lucide--tag" />
          <span>Query labels from moderation services.</span>
        </div>
      </div>
      <div class="text-center text-sm italic">
        Made by{" "}
        <a
          href="https://juli.ee"
          class="font-pecita relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-current after:transition-[width] after:duration-300 after:ease-out hover:after:w-full"
        >
          Juliet
        </a>{" "}
        with love
      </div>
    </div>
  );
};
