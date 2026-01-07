import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";

export const CarView = () => {
  return (
    <div class="flex w-full max-w-3xl flex-col gap-y-4 px-2">
      <Title>Archive tools - PDSls</Title>
      <div class="flex flex-col gap-y-1">
        <h1 class="text-lg font-semibold">Archive tools</h1>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Tools for working with CAR (Content Addressable aRchive) files.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <A
          href="explore"
          class="dark:bg-dark-300 flex items-start gap-3 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
        >
          <span class="iconify lucide--folder-search mt-0.5 shrink-0 text-xl text-neutral-500 dark:text-neutral-400" />
          <div class="flex flex-col gap-1">
            <span class="font-medium">Explore archive</span>
            <span class="text-sm text-neutral-600 dark:text-neutral-400">
              Browse records inside a repository archive
            </span>
          </div>
        </A>

        <A
          href="unpack"
          class="dark:bg-dark-300 flex items-start gap-3 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 text-left transition-colors hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-600 dark:hover:border-neutral-500 dark:hover:bg-neutral-800"
        >
          <span class="iconify lucide--file-archive mt-0.5 shrink-0 text-xl text-neutral-500 dark:text-neutral-400" />
          <div class="flex flex-col gap-1">
            <span class="font-medium">Unpack archive</span>
            <span class="text-sm text-neutral-600 dark:text-neutral-400">
              Extract records from an archive into a ZIP file
            </span>
          </div>
        </A>
      </div>
    </div>
  );
};
