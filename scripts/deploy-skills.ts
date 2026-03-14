#!/usr/bin/env bun
/**
 * Deploy the mission skill from the repo's .claude/skills/mission/ directory
 * to the user's global ~/.claude/skills/mission/ directory.
 *
 * Usage: bun run deploy:skills
 */

import { homedir } from "os";
import { join, resolve } from "path";

const home = homedir();
const repoRoot = resolve(import.meta.dir, "..");
const sourceDir = join(repoRoot, ".claude", "skills", "mission");
const targetDir = join(home, ".claude", "skills", "mission");
const oldTargetDir = join(home, ".claude", "skills");

// Old skill files to clean up (flat files from previous format)
const OLD_FILES = [
  "mission.md",
  "mission-helper.ts",
  "mission-list.md",
  "mission-create.md",
  "mission-claim.md",
  "mission-status.md",
  "mission-complete.md",
  "mission-release.md",
  "mission-review.md",
];

async function main() {
  // Ensure target directory exists
  await Bun.$`mkdir -p ${targetDir}`.quiet();

  // Copy SKILL.md
  const source = join(sourceDir, "SKILL.md");
  const target = join(targetDir, "SKILL.md");
  const file = Bun.file(source);

  if (!(await file.exists())) {
    console.error(`Error: ${source} not found`);
    process.exit(1);
  }

  await Bun.write(target, file);
  console.log(`\nDeployed mission skill to ${targetDir}\n`);

  // Clean up old flat skill files if they exist
  const removed: string[] = [];
  for (const oldFile of OLD_FILES) {
    const oldPath = join(oldTargetDir, oldFile);
    const oldBunFile = Bun.file(oldPath);
    if (await oldBunFile.exists()) {
      await Bun.$`rm ${oldPath}`.quiet();
      removed.push(oldFile);
    }
  }

  if (removed.length > 0) {
    console.log(`Cleaned up ${removed.length} old skill file(s):`);
    for (const file of removed) {
      console.log(`  - ${file}`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
