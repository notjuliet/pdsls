import { addNotification } from "../components/notification";

export const addToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  addNotification({
    message: "Copied to clipboard",
    type: "success",
    duration: 3000,
  });
};
