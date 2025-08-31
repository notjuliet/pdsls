import { setNotif } from "../layout";

export const addToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  setNotif({ show: true, icon: "lucide--clipboard-check", text: "Copied to clipboard" });
};
