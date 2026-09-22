// Which failures the caller is meant to read and act on, and which mean this
// server did something it did not intend.
//
// The distinction is not "did it fail" but "does anyone need to look". A
// refused file path, a URL pointing at a private address, an API answering
// `insufficient_credits` — those are the software working as designed: the tool
// call comes back with a message the caller can act on, and that is the whole of
// it. Only a throw nobody planned for — a shape the API was never supposed to
// return, a mistake in this code — says something here is wrong.
//
// The deliberate throws are the ones marked, rather than the unexpected ones
// being listed, and that asymmetry is the point: a failure mode added later is
// unexpected until somebody has thought about it and said otherwise. A list of
// known-bad conditions would instead default to silence for everything nobody
// has considered yet, which is exactly the set worth hearing about.

export class ExpectedFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectedFailure";
  }
}

/** True for a failure this server produced on purpose, with a message to show. */
export function isExpectedFailure(error: unknown): boolean {
  return error instanceof ExpectedFailure;
}
