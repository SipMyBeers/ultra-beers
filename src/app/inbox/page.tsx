import { buildInbox } from "@/lib/inbox";
import { InboxView } from "@/components/InboxView";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const inbox = await buildInbox();
  return <InboxView inbox={inbox} />;
}
