// What the public sandbox key allows, in the one sentence every surface of this
// package states it in: the tool descriptions, the check_balance answer, the
// README and the three manifests (distribution.test.ts holds them to it).
//
// The numbers are the API's defaults, which this package cannot import: the
// lifetime allowance counts only documents actually recognised, per client
// address; the hourly ceiling counts every request the sandbox key makes from
// that address, whatever it is answered — a balance lookup included, which is
// why check_balance does not make one under this key. Registering grants the
// account 100 free credits every UTC calendar month.
export const SANDBOX_ALLOWANCE =
  "Without a key, the public sandbox key is used. It gives 10 free recognised documents per " +
  "address in all, and at most 10 requests per address an hour, whatever their answer. " +
  "Registering gives 100 free documents every month.";
