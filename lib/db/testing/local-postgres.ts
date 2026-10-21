import { execFileSync } from "node:child_process";
import {
  chownSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

/**
 * Starts a throwaway Postgres cluster in a temp directory for tests.
 * Never points at a hosted database. Requires the Postgres server binaries
 * (Ubuntu: `apt-get install postgresql`). Set PG_BIN to override discovery.
 */
export interface LocalPostgres {
  url: string;
  stop: () => void;
}

function findBinDir(): string {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const root = "/usr/lib/postgresql";
  if (existsSync(root)) {
    const versions = readdirSync(root)
      .filter((v) => existsSync(path.join(root, v, "bin", "initdb")))
      .sort((a, b) => Number(b) - Number(a));
    if (versions.length) return path.join(root, versions[0], "bin");
  }
  try {
    return execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      "Postgres server binaries not found. Install postgresql or set PG_BIN.",
    );
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export async function startLocalPostgres(): Promise<LocalPostgres> {
  const bin = findBinDir();
  const dir = mkdtempSync(path.join(os.tmpdir(), "listapps-pg-"));
  const dataDir = path.join(dir, "data");
  const port = await freePort();

  // initdb refuses to run as root, so drop to the postgres user when needed.
  const isRoot = process.getuid?.() === 0;
  if (isRoot) {
    const uid = Number(
      execFileSync("id", ["-u", "postgres"], { encoding: "utf8" }),
    );
    const gid = Number(
      execFileSync("id", ["-g", "postgres"], { encoding: "utf8" }),
    );
    chownSync(dir, uid, gid);
  }
  const run = (cmd: string, args: string[]) => {
    const full = path.join(bin, cmd);
    if (isRoot) {
      execFileSync("runuser", ["-u", "postgres", "--", full, ...args], {
        stdio: "pipe",
      });
    } else {
      execFileSync(full, args, { stdio: "pipe" });
    }
  };

  run("initdb", [
    "-D",
    dataDir,
    "-U",
    "postgres",
    "-A",
    "trust",
    "--no-sync",
    "-E",
    "UTF8",
  ]);
  run("pg_ctl", [
    "-D",
    dataDir,
    "-l",
    path.join(dir, "log.txt"),
    "-o",
    `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
    "-w",
    "start",
  ]);

  let stopped = false;
  return {
    url: `postgres://postgres@127.0.0.1:${port}/postgres`,
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        run("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}
