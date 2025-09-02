import { createSignal } from "solid-js";
import { TextInput } from "../components/text-input.jsx";

export const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");

const Settings = () => {
  return (
    <div class="w-[22rem] sm:w-[24rem]">
      <div class="mb-2 flex items-center gap-1 font-semibold">
        <span>Settings</span>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-0.5">
          <label for="plcDirectory" class="select-none">
            PLC Directory
          </label>
          <TextInput
            id="plcDirectory"
            value={localStorage.plcDirectory || "https://plc.directory"}
            onInput={(e) => {
              e.currentTarget.value.length ?
                (localStorage.plcDirectory = e.currentTarget.value)
              : localStorage.removeItem("plcDirectory");
            }}
          />
        </div>
        <div class="flex justify-between">
          <div class="flex items-center gap-1">
            <input
              id="disableMedia"
              class="size-4"
              type="checkbox"
              checked={localStorage.hideMedia === "true"}
              onChange={(e) => {
                localStorage.hideMedia = e.currentTarget.checked;
                setHideMedia(e.currentTarget.checked);
              }}
            />
            <label for="disableMedia" class="select-none">
              Hide media embeds
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Settings };
