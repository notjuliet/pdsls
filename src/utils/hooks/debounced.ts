import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";

export const createDebouncedValue = <T>(
  accessor: Accessor<T>,
  delay: number,
  equals?: false | ((prev: T, next: T) => boolean),
): Accessor<T> => {
  const initial = accessor();
  const [state, setState] = createSignal(initial, { equals });

  createEffect((prev: T) => {
    const next = accessor();

    if (prev !== next) {
      const timeout = setTimeout(() => setState(() => next), delay);
      onCleanup(() => clearTimeout(timeout));
    }

    return next;
  }, initial);

  return state;
};
