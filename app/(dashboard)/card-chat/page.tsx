import { redirect } from "next/navigation";

export const metadata = { title: "Card Chat — MODVAULT" };

// The standalone /card-chat page has been folded into /home — your card lives
// there now with inline speech bubbles and a chat drawer. Anyone who still
// lands here gets sent home.
export default function CardChatPage() {
  redirect("/home");
}
