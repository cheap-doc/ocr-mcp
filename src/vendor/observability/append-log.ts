// Vendored from the private monorepo's @doc-cheap/observability (src/append-log.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// A size-bounded JSON-lines file that several processes may append to at once.
//
// WHY A FILE AND NOT STANDARD OUTPUT. The lines written here are read by a log
// reader in another container, which can only be handed a file on a shared
// volume: the container log driver keeps a few tens of megabytes and then drops
// the oldest, and reading it would mean mounting the container runtime's socket,
// which is root on the host.
//
// WHY SEVERAL WRITERS. The API runs as a parent and a number of forked workers,
// each serving its share of the listening socket, and every one of them has
// lines to write. Each opens the same path in append mode, so the kernel places
// every write at the current end of the file and one line never lands inside
// another. What append mode does not settle is rotation, which is the part this
// module exists for:
//
//   * A writer rotates only the file it is actually holding. Before renaming it
//     checks that the path still names the file its own descriptor points at; if
//     another writer got there first, it simply opens the new file.
//   * Generations are named by time and process, never by a shifting number, so
//     two writers rotating in the same instant cannot rename one generation onto
//     another. The worst a race produces is one very small generation.
//   * Every writer looks at the path at most once per check interval, so a
//     writer whose file was rotated by somebody else follows within a second.
//     Lines written in that second land in the rotated generation, not nowhere.
//
// A FAILURE IS NEVER THROWN into the caller. This is measurement: a request that
// fails because a statistic could not be written is a worse outcome than a gap
// in the statistics. It is counted and kept instead, so `state()` can say the
// file is not being written, and reported through `onError` — the first time,
// then one in every `reportEvery`, because a descriptor that has gone away fails
// on every single request.

import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export interface SharedAppendLogOptions {
  /** The file every writer appends to. */
  readonly path: string;
  /** Rotate once the file has reached this many bytes. Zero or less: never. */
  readonly maxBytes: number;
  /** How many rotated generations to keep beside the live file. */
  readonly keep: number;
  readonly onError?: (error: unknown) => void;
  /** Report the first failure, then one in every this many. */
  readonly reportEvery?: number;
  /** How often a writer looks at the path to follow another writer's rotation. */
  readonly checkIntervalMs?: number;
  /** The clock, injectable so a test can move it. */
  readonly now?: () => number;
  /** This process's id, part of every generation name it writes. */
  readonly pid?: number;
  /**
   * The two calls on an open descriptor, injectable so a test can make them
   * fail: a write that fails after a successful open is otherwise a full disk,
   * which no test can arrange.
   */
  readonly io?: {
    readonly write?: (fd: number, text: string) => number;
    readonly close?: (fd: number) => void;
  };
}

export interface SharedAppendLogState {
  readonly path: string;
  readonly open: boolean;
  readonly size: number;
  readonly failures: number;
  readonly lastError: unknown;
}

export interface SharedAppendLog {
  write(record: unknown): void;
  state(): SharedAppendLogState;
  close(): void;
}

const DEFAULT_CHECK_INTERVAL_MS = 1000;
const DEFAULT_REPORT_EVERY = 100;

// Wide enough for any millisecond timestamp this code will see, so the names
// sort in the order they were written as plain strings.
const STAMP_WIDTH = 15;

export function createSharedAppendLog(options: SharedAppendLogOptions): SharedAppendLog {
  const file = options.path;
  const directory = dirname(file);
  const prefix = `${basename(file)}.`;
  const maxBytes = options.maxBytes;
  const keep = Math.max(0, Math.floor(options.keep));
  const onError = options.onError ?? (() => {});
  const reportEvery = Math.max(1, options.reportEvery ?? DEFAULT_REPORT_EVERY);
  const checkIntervalMs = Math.max(0, options.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS);
  const now = options.now ?? Date.now;
  const pid = options.pid ?? process.pid;
  const writeText = options.io?.write ?? ((fd: number, text: string) => writeSync(fd, text));
  const closeFd = options.io?.close ?? closeSync;

  let fd: number | null = null;
  let inode = -1;
  let size = 0;
  let lastCheck = Number.NEGATIVE_INFINITY;
  let failures = 0;
  let lastError: unknown = null;

  function report(error: unknown): void {
    failures += 1;
    lastError = error;
    if (failures === 1 || failures % reportEvery === 0) onError(error);
  }

  function closeDescriptor(): void {
    if (fd === null) return;
    const held = fd;
    fd = null;
    try {
      closeFd(held);
    } catch (error) {
      report(error);
    }
  }

  function open(): void {
    closeDescriptor();
    lastCheck = now();
    try {
      mkdirSync(directory, { recursive: true });
      const opened = openSync(file, "a");
      const stats = fstatSync(opened);
      fd = opened;
      inode = stats.ino;
      size = stats.size;
    } catch (error) {
      report(error);
    }
  }

  // The inode the path names right now, or null when nothing is there.
  function inodeAtPath(): number | null {
    try {
      return statSync(file).ino;
    } catch {
      return null;
    }
  }

  // Follows a rotation another writer made, and picks up the size the file has
  // reached from everybody's writes rather than from this process's own.
  function refresh(): void {
    lastCheck = now();
    let stats: ReturnType<typeof statSync> | null = null;
    try {
      stats = statSync(file);
    } catch {
      stats = null;
    }
    if (stats === null || stats.ino !== inode) {
      open();
      return;
    }
    size = Number(stats.size);
  }

  // Keeps the newest `keep` generations of this file and removes the rest.
  function prune(): void {
    try {
      const generations = readdirSync(directory)
        .filter((name) => name.startsWith(prefix))
        .sort();
      const surplus = generations.length - keep;
      for (const name of generations.slice(0, Math.max(0, surplus))) {
        rmSync(join(directory, name), { force: true });
      }
    } catch (error) {
      report(error);
    }
  }

  function rotate(): void {
    // Only the file this writer holds is renamed. When the path already names a
    // different file, another writer rotated first and there is nothing to do
    // but follow it.
    if (inodeAtPath() === inode) {
      const stamp = String(now()).padStart(STAMP_WIDTH, "0");
      try {
        renameSync(file, `${file}.${stamp}-${pid}`);
      } catch (error) {
        report(error);
      }
    }
    open();
    prune();
  }

  open();

  return {
    write(record) {
      const due = now() - lastCheck >= checkIntervalMs;
      if (fd === null) {
        // A file that could not be opened is tried again, but not on every
        // request: once per interval is enough to recover and cheap to fail.
        if (!due) return;
        open();
        if (fd === null) return;
      } else if (due) {
        refresh();
        if (fd === null) return;
      }
      let line: string;
      try {
        line = `${JSON.stringify(record)}\n`;
      } catch (error) {
        report(error);
        return;
      }
      try {
        size += writeText(fd, line);
      } catch (error) {
        report(error);
        closeDescriptor();
        return;
      }
      if (maxBytes > 0 && size >= maxBytes) rotate();
    },
    state() {
      return { path: file, open: fd !== null, size, failures, lastError };
    },
    close() {
      closeDescriptor();
    },
  };
}
