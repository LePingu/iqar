---
description: Sync the frontend (src/) with updated specs in front/ (FRONTEND_AGENT_CONTEXT.md and openapi.yaml)
---

The specs in `front/` have been updated. Bring the frontend implementation in `src/` in line with them.

## Procedure

1. **Read the spec delta** — run `git diff -- front/` (and `git diff HEAD~1 -- front/` if the
   working tree is clean) to see exactly what changed in `front/FRONTEND_AGENT_CONTEXT.md` and
   `front/openapi.yaml`. If the diff is empty, read both files in full and compare against the
   current `src/` implementation instead.

2. **Read the full specs** — `front/FRONTEND_AGENT_CONTEXT.md` (views, components, formatting
   rules, deployment) and `front/openapi.yaml` (endpoints and schemas), so changes are applied
   in context rather than in isolation.

3. **Map spec changes to code**:
   - New/changed schemas in openapi.yaml → `src/types/api.ts`
   - New/changed endpoints → `src/services/api.ts`
   - New/changed views/components (Routes A–F) → `src/views/` and `src/components/`
   - Config changes for the launch form → `src/views/ControlTower.tsx`
   - Routing changes → `src/router.tsx`

4. **Follow the spec's non-negotiables** when touching affected code:
   - Golden/dark theme, glassmorphism, no Tailwind unless already used in the file being edited.
   - Prices/quantities use significant-digit formatting (`fmtPrice` in `src/utils/trading.ts`);
     money totals stay at 2 decimals.
   - Never hardcode `$` on engine payloads — render `currency` from the payload.
   - Real-session caveats: only `adopted` lots get the adopted label (`reconstructed` is
     genuine lifetime P&L); distinguish `exchange` vs `engine` fills; flag unconverted prices;
     show native `settle_price` beside the converted one; assert `mode === "real"` on
     `/live/real` as a hard error state; do not draw the equity curve before `observed_from`;
     do not infer arming state that no endpoint serves.
   - SSE (`/api/backtests/jobs/:jobId/stream`) is NOT implemented — keep using polling.

5. **Do not remove or reinterpret behaviour** the spec did not change. Only apply the delta.

6. **Verify**: run `npx tsc -b`, `npm run lint`, and `npm run build`. Fix any failures.

7. Do not commit — leave the changes staged in the working tree for the user to review.

$ARGUMENTS
