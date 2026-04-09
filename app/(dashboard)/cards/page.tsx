import { redirect } from "next/navigation";

export const metadata = { title: "Cards — MODVAULT" };

// The Ghosts tab has been folded into the Mint page. Anyone who still lands
// on /cards (bookmark, old link) is sent to /mint where their living card,
// ghost archive, and mint flow all live in one place.
export default function CardsPage() {
  redirect("/mint");
}
