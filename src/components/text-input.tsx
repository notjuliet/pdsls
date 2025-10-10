export interface TextInputProps {
  ref?: HTMLInputElement;
  class?: string;
  id?: string;
  type?: "text" | "email" | "password" | "search" | "tel" | "url";
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  spellcheck?: boolean;
  value?: string | string[];
  onInput?: (ev: InputEvent & { currentTarget: HTMLInputElement }) => void;
}

export const TextInput = (props: TextInputProps) => {
  return (
    <input
      type={props.type ?? "text"}
      id={props.id}
      name={props.name}
      value={props.value ?? ""}
      ref={props.ref}
      spellcheck={props.spellcheck ?? false}
      placeholder={props.placeholder}
      disabled={props.disabled}
      required={props.required}
      class={
        "dark:bg-dark-100 dark:shadow-dark-800 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1 shadow-xs select-none placeholder:text-sm focus:outline-[1px] focus:outline-neutral-600 dark:border-neutral-700 dark:focus:outline-neutral-400 " +
        props.class
      }
      onInput={props.onInput}
    />
  );
};
