import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

export type Notification = {
  id: string;
  message: string;
  progress?: number;
  total?: number;
  type?: "info" | "success" | "error";
};

const [notifications, setNotifications] = createStore<Notification[]>([]);
const [removingIds, setRemovingIds] = createSignal<Set<string>>(new Set());

export const addNotification = (notification: Omit<Notification, "id">) => {
  const id = `notification-${Date.now()}-${Math.random()}`;
  setNotifications(notifications.length, { ...notification, id });
  return id;
};

export const updateNotification = (id: string, updates: Partial<Notification>) => {
  setNotifications((n) => n.id === id, updates);
};

export const removeNotification = (id: string) => {
  setRemovingIds(new Set([...removingIds(), id]));
  setTimeout(() => {
    setNotifications((n) => n.filter((notification) => notification.id !== id));
    setRemovingIds((ids) => {
      const newIds = new Set(ids);
      newIds.delete(id);
      return newIds;
    });
  }, 250);
};

export const NotificationContainer = () => {
  return (
    <div class="pointer-events-none fixed bottom-4 left-4 z-60 flex flex-col gap-2">
      <For each={notifications}>
        {(notification) => (
          <div
            class="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto flex min-w-64 flex-col gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 shadow-md select-none dark:border-neutral-700"
            classList={{
              "border-blue-500 dark:border-blue-400": notification.type === "info",
              "border-green-500 dark:border-green-400": notification.type === "success",
              "border-red-500 dark:border-red-400": notification.type === "error",
              "animate-[slideIn_0.25s_ease-in]": !removingIds().has(notification.id),
              "animate-[slideOut_0.25s_ease-in]": removingIds().has(notification.id),
            }}
            onClick={() => removeNotification(notification.id)}
          >
            <div class="flex items-center gap-2 text-sm">
              <Show when={notification.progress !== undefined}>
                <span class="iconify lucide--download" />
              </Show>
              <Show when={notification.type === "success"}>
                <span class="iconify lucide--check-circle text-green-600 dark:text-green-400" />
              </Show>
              <Show when={notification.type === "error"}>
                <span class="iconify lucide--x-circle text-red-500 dark:text-red-400" />
              </Show>
              <span>{notification.message}</span>
            </div>
            <Show when={notification.progress !== undefined}>
              <div class="flex flex-col gap-1">
                <Show
                  when={notification.total !== undefined && notification.total > 0}
                  fallback={
                    <div class="text-xs text-neutral-600 dark:text-neutral-400">
                      {notification.progress} MB
                    </div>
                  }
                >
                  <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                    <div
                      class="h-full rounded-full bg-blue-500 transition-all dark:bg-blue-400"
                      style={{ width: `${notification.progress}%` }}
                    />
                  </div>
                  <div class="text-xs text-neutral-600 dark:text-neutral-400">
                    {notification.progress}%
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
