import { For } from "solid-js";
import { createMutable } from "solid-js/store";

interface LogEntry {
  type: "log" | "info" | "warn" | "error";
  at: number;
  msg: string;
}

interface PendingLogEntry {
  msg: string;
}

export const createLogger = () => {
  const pending = createMutable<PendingLogEntry[]>([]);

  let backlog: LogEntry[] | undefined = [];
  let push = (entry: LogEntry) => {
    backlog!.push(entry);
  };

  return {
    internal: {
      get pending() {
        return pending;
      },
      attach(fn: (entry: LogEntry) => void) {
        if (backlog !== undefined) {
          for (let idx = 0, len = backlog.length; idx < len; idx++) {
            fn(backlog[idx]);
          }
          backlog = undefined;
        }
        push = fn;
      },
    },
    log(msg: string) {
      push({ type: "log", at: Date.now(), msg });
    },
    info(msg: string) {
      push({ type: "info", at: Date.now(), msg });
    },
    warn(msg: string) {
      push({ type: "warn", at: Date.now(), msg });
    },
    error(msg: string) {
      push({ type: "error", at: Date.now(), msg });
    },
    progress(initialMsg: string, throttleMs = 500) {
      pending.unshift({ msg: initialMsg });

      let entry: PendingLogEntry | undefined = pending[0];

      return {
        update: throttle((msg: string) => {
          if (entry !== undefined) {
            entry.msg = msg;
          }
        }, throttleMs),
        destroy() {
          if (entry !== undefined) {
            const index = pending.indexOf(entry);
            pending.splice(index, 1);
            entry = undefined;
          }
        },
        [Symbol.dispose]() {
          this.destroy();
        },
      };
    },
  };
};

export type Logger = ReturnType<typeof createLogger>;

const formatter = new Intl.DateTimeFormat("en-US", { timeStyle: "short", hour12: false });

export const LoggerView = (props: { logger: Logger }) => {
  return (
    <ul class="flex flex-col font-mono text-xs empty:hidden">
      <For each={props.logger.internal.pending}>
        {(entry) => (
          <li class="flex gap-2 px-4 py-1 whitespace-pre-wrap">
            <span class="shrink-0 font-medium whitespace-pre-wrap text-neutral-400">-----</span>
            <span class="wrap-break-word">{entry.msg}</span>
          </li>
        )}
      </For>

      <div
        ref={(node) => {
          props.logger.internal.attach(({ type, at, msg }) => {
            let ecn = `flex gap-2 whitespace-pre-wrap px-4 py-1`;
            let tcn = `shrink-0 whitespace-pre-wrap font-medium`;
            if (type === "log") {
              tcn += ` text-neutral-500`;
            } else if (type === "info") {
              ecn += ` bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
              tcn += ` text-blue-500`;
            } else if (type === "warn") {
              ecn += ` bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`;
              tcn += ` text-amber-500`;
            } else if (type === "error") {
              ecn += ` bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
              tcn += ` text-red-500`;
            }

            const item = (
              <li class={ecn}>
                <span class={tcn}>{formatter.format(at)}</span>
                <span class="wrap-break-word">{msg}</span>
              </li>
            );

            if (item instanceof Node) {
              node.after(item);
            }
          });
        }}
      />
    </ul>
  );
};

const throttle = <T extends (...args: any[]) => void>(func: T, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;

  const invoke = () => {
    func(...lastArgs!);
    lastCallTime = Date.now();
    timeout = null;
  };

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    lastArgs = args;

    if (timeSinceLastCall >= wait) {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      invoke();
    } else if (timeout === null) {
      timeout = setTimeout(invoke, wait - timeSinceLastCall);
    }
  };
};
