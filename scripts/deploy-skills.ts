#!/usr/bin/env bun
/**
 * Deploy skill files from the repo's .claude/skills/ directory
 * to the user's global ~/.claude/skills/ directory.
 *
 * - Copies all .md skill files
 * - Copies mission-helper.ts
 * - Rewrites relative helper paths to absolute paths in .md files
 */

import { homedir } from "os";
import { join, resolve } from "path";
import { Glob } from "bun";

const home = homedir();
const repoRoot = resolve(import.meta.dir, "..");
const sourceDir = join(repoRoot, ".claude", "skills");
const targetDir = join(home, ".claude", "skills");

// Relative path used in source .md files
const RELATIVE_HELPER_PATH = ".claude/skills/mission-helper.ts";
// Absolute path for deployed .md files
const ABSOLUTE_HELPER_PATH = join(targetDir, "mission-helper.ts");

async function main() {
  // Ensure target directory exists
  await Bun.$`mkdir -p ${targetDir}`.quiet();

  const copied: string[] = [];

  // Copy mission-helper.ts
  const helperSource = join(sourceDir, "mission-helper.ts");
  const helperTarget = join(targetDir, "mission-helper.ts");
  const helperFile = Bun.file(helperSource);

  if (await helperFile.exists()) {
    await Bun.write(helperTarget, helperFile);
    copied.push("mission-helper.ts");
  } else {
    console.error(`Warning: ${helperSource} not found, skipping.`);
  }

  // Copy all .md files, rewriting helper paths
  const glob = new Glob("*.md");
  for await (const filename of glob.scan({ cwd: sourceDir })) {
    const sourcePath = join(sourceDir, filename);
    const targetPath = join(targetDir, filename);

    let content = await Bun.file(sourcePath).text();

    // Replace relative helper path with absolute path
    content = content.replaceAll(RELATIVE_HELPER_PATH, ABSOLUTE_HELPER_PATH);

    await Bun.write(targetPath, content);
    copied.push(filename);
  }

  // Print summary
  console.log(`\nDeployed ${copied.length} file(s) to ${targetDir}:\n`);
  for (const file of copied) {
    console.log(`  - ${file}`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
