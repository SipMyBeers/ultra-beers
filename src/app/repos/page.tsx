import { listRepos } from "@/lib/repos";
import { ReposBrowser } from "@/components/ReposBrowser";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const repos = await listRepos();
  return <ReposBrowser initialRepos={repos} />;
}
