# Evidence provenance

- baseline/storage-inventory: initial read-only snapshots at 17:01 UTC; closing versions at 17:20 UTC. Application active, no distributed atomic snapshot.
- reconciliation-details: read-only audit correlations, with phase-2 delta separated from activity during inspection. IDs/PII omitted.
- state-comparison-1715/1717: intermediate comparisons; final-state.json compares preserved initial/closing snapshots offline and explicitly records live growth.
- official-cli-drill-attempt1/2: preserved raw outcomes. official-cli-drill.json/log duplicates attempt 2, not a third run. official-cli-final-verification.json + cli-focused-verification.log conclude the one unresolved harness expectation by read-only manifest comparison.
- recovery-unit.json/log: 32 existing related unit tests; no full 770 rerun.
- cleanup-state: own stopped containers/mounts retained; no resource deletion.
- *.source.txt: source snapshots of isolated operational scripts, not runnable product changes. Harness source contains subsequent corrections to name length and expected manifest count; raw attempt outcomes remain unchanged. phase3-finalstate source generated intermediate comparisons; final-state.json is an offline comparison, not a further live query.
- Private .env, keys, encrypted archives and commercial photographs are excluded from this delivery. No raw object keys/DNI/IMEI or commercial image bytes included. Local secret scan details: secret-hygiene.json.

Commands used (private environment loaded internally, no secrets in argv):

```text
node node_modules/tsx/dist/cli.mjs .local/phase3-inventory.ts
node node_modules/tsx/dist/cli.mjs .local/phase3-reconcile.ts
node .local/phase3-provision.mjs
node .local/phase3-runner.mjs recovery-unit node_modules/vitest/vitest.mjs run --project unit tests/unit/phase9.test.ts --reporter=json --outputFile=docs/phase3-operational-closure/evidence/recovery-unit.json
node .local/phase3-runner.mjs official-cli-drill node_modules/tsx/dist/cli.mjs .local/phase3-drill.ts
node .local/phase3-runner.mjs cli-focused-verification node_modules/tsx/dist/cli.mjs .local/phase3-drill-conclude.ts
node node_modules/tsx/dist/cli.mjs .local/phase3-finalstate.ts
node --check .local/phase3-provision.mjs
node --check .local/phase3-runner.mjs
```

The drill internally invokes official scripts/backup.ts create --confirm-quiesced and restore in fresh processes. See run logs for actual start times, command options and exit codes. Closing inventory sets PHASE3_SNAPSHOT_SUFFIX=-closing; the intermediate source defaults to the initial filename. Do not execute these scripts against an unverified environment or rerun provisioning over existing resources. Purpose-guarded docker stop was limited to the two newly created phase3 containers; no Compose restart or removal was used.

SHA256SUMS uses UTF-8 LF bytes (the Git representation) and covers all other files in this folder after redaction/whitespace normalization. No data-repair operation is part of this evidence.
