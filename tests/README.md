# Monitor checks

`npm test` runs contract and measurement tests (Node 22.18+ for native TypeScript
stripping; tested with Node 25). `npm run build` validates strict TypeScript and
the production bundle; `npm run lint` checks the source.

Browser regression:

1. `npx playwright install chromium`
2. `npm run dev -- --host 127.0.0.1 --port 4173`
3. In a second terminal, `npm run test:browser`

Override `TEST_BASE_URL`, `TEST_ARTIFACT_DIR` and/or `PLAYWRIGHT_BROWSERS_PATH` when
needed. Screenshots default to `/private/tmp/iqar-ui-check/screenshots`.
All `/api/**` requests are intercepted. The suite never contacts a live engine,
including the mocked Halt action. It covers desktop/mobile selection, one chart,
checkboxes, execution timeline, audit navigation, keyboard tabs, reader controls,
real/paper isolation, null/partial responses, and absent new endpoints.
Fixtures live only in tests and are never imported by production source.
