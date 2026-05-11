import { notFound } from "next/navigation";
import { getRepoOverview } from "@/lib/repos";
import { RepoOverview } from "@/components/RepoOverview";

export const dynamic = "force-dynamic";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const overview = await getRepoOverview(id);
  if (!overview) notFound();
  return <RepoOverview overview={overview} />;
}
