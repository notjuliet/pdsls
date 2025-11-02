import { addNotification, removeNotification } from "../components/notification";

export const addToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  const id = addNotification({
    message: "Copied to clipboard",
    type: "success",
  });
  setTimeout(() => removeNotification(id), 3000);
};
