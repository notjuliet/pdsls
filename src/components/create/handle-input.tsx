import { Handle } from "@atcute/lexicons";
import { createSignal, Show } from "solid-js";
import { resolveHandle } from "../../utils/api";
import { Button } from "../button.jsx";
import { TextInput } from "../text-input.jsx";
import { editorInstance } from "./state";

export const HandleInput = (props: { onClose: () => void }) => {
  const [resolving, setResolving] = createSignal(false);
  const [error, setError] = createSignal("");
  let handleFormRef!: HTMLFormElement;

  const resolveDid = async (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(handleFormRef);
    const handleValue = formData.get("handle")?.toString().trim();

    if (!handleValue) {
      setError("Please enter a handle");
      return;
    }

    setResolving(true);
    setError("");
    try {
      const did = await resolveHandle(handleValue as Handle);
      editorInstance.view.dispatch({
        changes: {
          from: editorInstance.view.state.selection.main.head,
          insert: `"${did}"`,
        },
      });
      props.onClose();
      handleFormRef.reset();
    } catch (err: any) {
      setError(err.message || "Failed to resolve handle");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-[20rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
      <h2 class="mb-2 font-semibold">Insert DID from handle</h2>
      <form ref={handleFormRef} onSubmit={resolveDid} class="flex flex-col gap-2 text-sm">
        <div class="flex flex-col gap-1">
          <label for="handle-input" class="select-none">
            Handle
          </label>
          <TextInput id="handle-input" name="handle" placeholder="user.bsky.social" />
        </div>
        <p class="text-xs text-neutral-600 dark:text-neutral-400">
          DID will be pasted after the cursor
        </p>
        <Show when={error()}>
          <span class="text-red-500 dark:text-red-400">Error: {error()}</span>
        </Show>
        <div class="flex justify-between gap-2">
          <Button
            type="button"
            onClick={() => {
              props.onClose();
              handleFormRef.reset();
              setError("");
            }}
          >
            Cancel
          </Button>
          <Show when={resolving()}>
            <div class="flex items-center gap-1">
              <span class="iconify lucide--loader-circle animate-spin"></span>
              <span>Resolving</span>
            </div>
          </Show>
          <Show when={!resolving()}>
            <Button
              type="submit"
              class="dark:shadow-dark-700 flex items-center gap-1 rounded-lg bg-blue-500 px-2 py-1.5 text-xs text-white shadow-xs select-none hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-400"
            >
              Insert
            </Button>
          </Show>
        </div>
      </form>
    </div>
  );
};
