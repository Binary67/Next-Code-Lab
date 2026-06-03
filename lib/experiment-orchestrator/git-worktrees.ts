import { execFile as execFileCallback } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);

export type TrialWorktrees = {
  id: string;
  branchName: string;
  agentPath: string;
  evalPath: string;
};

export async function runGit(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout.trim();
}

export async function getGitState(repoPath: string) {
  const repoRoot = await runGit(repoPath, ["rev-parse", "--show-toplevel"]);
  const baseBranch = await runGit(repoRoot, [
    "rev-parse",
    "--abbrev-ref",
    "HEAD",
  ]);
  const baseCommit = await runGit(repoRoot, ["rev-parse", "HEAD"]);

  return { repoRoot, baseBranch, baseCommit };
}

function worktreeRoot(experimentId: string) {
  return join(process.cwd(), ".local", "worktrees", experimentId);
}

export async function createBaselineWorktree(
  repoRoot: string,
  experimentId: string,
  baseCommit: string,
) {
  const root = worktreeRoot(experimentId);
  const path = join(root, "baseline");

  await mkdir(root, { recursive: true });
  await runGit(repoRoot, ["worktree", "add", "--detach", path, baseCommit]);
  return path;
}

export async function createTrialWorktrees(
  repoRoot: string,
  experimentId: string,
  trialNumber: number,
  baseCommit: string,
): Promise<TrialWorktrees> {
  const id = `T-${String(trialNumber).padStart(2, "0")}`;
  const slug = `trial-${String(trialNumber).padStart(3, "0")}`;
  const branchName = `optimizer/${experimentId}/${slug}`;
  const root = worktreeRoot(experimentId);
  const agentPath = join(root, `${slug}-agent`);
  const evalPath = join(root, `${slug}-eval`);

  await mkdir(root, { recursive: true });
  await runGit(repoRoot, [
    "worktree",
    "add",
    "-B",
    branchName,
    agentPath,
    baseCommit,
  ]);
  await runGit(repoRoot, ["worktree", "add", "--detach", evalPath, baseCommit]);

  return { id, branchName, agentPath, evalPath };
}

export async function snapshotTrialChanges(
  worktreePath: string,
  trialId: string,
  evalNumber: number,
) {
  await runGit(worktreePath, ["add", "-A"]);
  await runGit(worktreePath, [
    "-c",
    "user.name=Optimizer Lab",
    "-c",
    "user.email=optimizer-lab@example.invalid",
    "commit",
    "--allow-empty",
    "-m",
    `Optimizer trial ${trialId} eval ${evalNumber}`,
  ]);

  return runGit(worktreePath, ["rev-parse", "HEAD"]);
}

export async function resetEvalWorktree(
  worktreePath: string,
  commitSha: string,
) {
  await runGit(worktreePath, ["reset", "--hard", commitSha]);
  await runGit(worktreePath, ["clean", "-fdx"]);
}

export async function createBestBranch(
  repoRoot: string,
  branchName: string,
  commitSha: string,
) {
  await runGit(repoRoot, ["branch", "-f", branchName, commitSha]);
}
