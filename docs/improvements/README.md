# Improvements

One file per big change, with the numbers that justify it. The point is to be able to answer "was it better, and by how much?" for every version, with data we can re-run.

| Date | Change | Headline number |
|---|---|---|
| 2026-09-22 | [Kit as a CLI (`@peaje/cli`)](./2026-09-22-kit-cli.md) | Install cost for the coding agent: $0.269 to $0.118 per session (-56%) |

## How to add one

1. Measure before and after on the same fixture, same model, at least three runs each. Keep the raw output.
2. Write `YYYY-MM-DD-<slug>.md` with: what changed, how it was measured, the table, what went wrong, what was not measured.
3. Put the per-run numbers next to it as `YYYY-MM-DD-<slug>.runs.csv` so the averages can be recomputed.
4. Add a row here.
