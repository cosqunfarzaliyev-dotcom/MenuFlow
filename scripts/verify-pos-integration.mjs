/**
 * Verifies the POS ("Poster") integration's repo-level invariants — the
 * things that only ever break silently otherwise, per CLAUDE.md's own
 * warning about supabase/config.toml not being read by the MCP
 * `deploy_edge_function` tool (see that file's header). Pure text/regex
 * assertions over the repo files, no DB connection and no network calls —
 * same "closest thing to a test" shape as the other scripts/verify-*.mjs
 * files (see verify-capabilities.mjs's own header for the pattern this
 * follows).
 *
 * Run: node scripts/verify-pos-integration.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

let failed = false;
const fail = (msg) => {
  console.error('FAIL:', msg);
  failed = true;
};
const pass = (msg) => console.log('PASS:', msg);

// ---------------------------------------------------------------------------
// 1. Every supabase.rpc('...') name lib/services/supabaseService.js calls
//    must be defined by SOME migration. Catches a renamed/dropped RPC that
//    the client still calls (a silent runtime 404 otherwise, only ever
//    caught by clicking through the UI).
// ---------------------------------------------------------------------------
{
  const serviceSrc = read('lib/services/supabaseService.js');
  const rpcNames = [...new Set(
    [...serviceSrc.matchAll(/supabase\.rpc\(\s*'([a-zA-Z_]+)'/g)].map((m) => m[1]),
  )];

  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const migrationsSrc = migrationFiles.map((f) => readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n');

  if (rpcNames.length === 0) {
    fail('found zero supabase.rpc(...) calls in supabaseService.js — the extraction regex probably broke');
  }

  for (const name of rpcNames) {
    // Matches both `function public.name(` and `function name(` — some
    // migrations qualify the schema, some don't.
    const defined = new RegExp(`function\\s+(public\\.)?${name}\\s*\\(`, 'i').test(migrationsSrc);
    if (!defined) {
      fail(`supabaseService.js calls supabase.rpc('${name}') but no migration defines a function named '${name}'`);
    }
  }
  if (!failed) pass(`all ${rpcNames.length} RPC names called from supabaseService.js are defined in supabase/migrations/`);
}

// ---------------------------------------------------------------------------
// 2. The project ref must never appear NEWLY hardcoded outside a coalesce()
//    fallback. 0027_pos_order_push_observability.sql reads the Edge
//    Function base URL from app_secrets.functions_base_url specifically so
//    a project fork/restore doesn't silently keep POSTing at the old
//    project's functions — the coalesce() is the ONLY place the literal is
//    allowed to survive, as an emergency fallback for a not-yet-provisioned
//    row (see that migration's own comment on why the fallback matters).
//
//    Already-applied migrations are an immutable historical record (this
//    codebase never edits a migration after apply_migration has run it —
//    0026 still hardcoding the literal is exactly the bug 0027 fixed, and
//    rewriting 0026 after the fact would misrepresent what was actually
//    deployed). So only the newest migration file is checked here — that's
//    the one still being written/reviewed. Edge Functions are always fully
//    scanned: unlike migrations they have no "historical" version, only
//    today's deployed source, and confirmed to never need the literal
//    (they read SUPABASE_URL from the Deno runtime env instead).
// ---------------------------------------------------------------------------
{
  const PROJECT_REF = 'evdlcbfsvvtrrmxxbzpr';
  let checkedFiles = 0;
  let violations = 0;

  // Only function BODIES are checked (dollar-quoted `$fn$...$fn$` / `$$...$$`
  // blocks) — the actual code that runs on every trigger fire. A one-time
  // `update app_secrets set functions_base_url = '<literal>'` seed statement
  // is expected to hardcode the initial value once at migration-apply time;
  // that's the seed, not a code path that could go stale on a fork/restore.
  const extractFunctionBodies = (src) =>
    [...src.matchAll(/\$fn\$([\s\S]*?)\$fn\$|\$\$([\s\S]*?)\$\$/g)].map((m) => m[1] ?? m[2] ?? '');

  const checkFile = (relPath) => {
    checkedFiles += 1;
    const src = readFileSync(path.join(ROOT, relPath), 'utf8');
    const bodies = relPath.endsWith('.sql') ? extractFunctionBodies(src) : [src];
    for (const body of bodies) {
      for (const line of body.split('\n')) {
        if (!line.includes(PROJECT_REF)) continue;
        if (!line.toLowerCase().includes('coalesce(')) {
          violations += 1;
          fail(`${relPath} hardcodes project ref '${PROJECT_REF}' outside a coalesce() fallback: ${line.trim()}`);
        }
      }
    }
  };

  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (migrationFiles.length === 0) {
    fail('found zero files under supabase/migrations — path resolution is broken');
  } else {
    checkFile(path.join('supabase', 'migrations', migrationFiles[migrationFiles.length - 1]));
  }

  const walkFunctions = (dir) => {
    const abs = path.join(ROOT, dir);
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const relPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkFunctions(relPath);
      } else if (entry.name.endsWith('.ts')) {
        checkFile(relPath);
      }
    }
  };
  walkFunctions('supabase/functions');

  if (violations === 0) {
    pass(`project ref '${PROJECT_REF}' only appears inside coalesce() fallbacks across the newest migration + ${checkedFiles - 1} Edge Function files`);
  }
}

// ---------------------------------------------------------------------------
// 3. The order_push_status values IntegrationsTab.jsx's UI branches on must
//    exactly match the live DB check constraint's allowed set. A UI that
//    handles a status the DB can never produce is dead code; a DB status the
//    UI doesn't handle falls through to "Heç vaxt" and hides real state —
//    which is exactly the bug 0027 was written to fix.
// ---------------------------------------------------------------------------
{
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const migrationsSrc = migrationFiles.map((f) => readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n');

  // Later migrations' `add constraint ... check (order_push_status in (...))`
  // supersede earlier ones (0027 widens 0026's 3-value set to 4) — take the
  // LAST match in file order, not the first.
  const constraintMatches = [...migrationsSrc.matchAll(
    /order_push_status\s+in\s*\(([^)]+)\)/gi,
  )];
  if (constraintMatches.length === 0) {
    fail('no migration defines an order_push_status check constraint — did the column/constraint get renamed?');
  } else {
    const lastMatch = constraintMatches[constraintMatches.length - 1][1];
    const dbStatuses = new Set(
      [...lastMatch.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
    );

    const tabSrc = read('components/IntegrationsTab.jsx');
    // Every `status === '<value>'` comparison inside orderPushStatusTag,
    // plus the implicit 'never' fallback the function returns for anything
    // else (mirrors get_pos_integration_status()'s own 'never' default for
    // a restaurant with no pos_integrations row yet).
    const uiStatuses = new Set(
      [...tabSrc.matchAll(/status === '([a-z_]+)'/g)].map((m) => m[1]),
    );
    uiStatuses.add('never');

    const missingInUi = [...dbStatuses].filter((s) => !uiStatuses.has(s));
    const missingInDb = [...uiStatuses].filter((s) => !dbStatuses.has(s));
    if (missingInUi.length > 0) {
      fail(`IntegrationsTab.jsx does not branch on DB status value(s): ${missingInUi.join(', ')}`);
    }
    if (missingInDb.length > 0) {
      fail(`IntegrationsTab.jsx branches on status value(s) the DB constraint doesn't allow: ${missingInDb.join(', ')}`);
    }
    if (missingInUi.length === 0 && missingInDb.length === 0) {
      pass(`order_push_status set {${[...dbStatuses].sort().join(', ')}} matches exactly between the DB constraint and IntegrationsTab.jsx`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. supabase/config.toml's verify_jwt per function must match what that
//    function's own header comment asserts. config.toml is NOT read by the
//    MCP deploy_edge_function tool (see its own header) — it's a reviewable
//    declaration, and this check is what actually makes it load-bearing:
//    a redeploy with the wrong flag now fails this script instead of
//    silently shipping.
// ---------------------------------------------------------------------------
{
  const configSrc = read('supabase/config.toml');
  const configEntries = [...configSrc.matchAll(
    /\[functions\.([a-z0-9-]+)\]\s*\n\s*verify_jwt\s*=\s*(true|false)/g,
  )].map((m) => [m[1], m[2] === 'true']);

  if (configEntries.length === 0) {
    fail('found zero [functions.*] entries in supabase/config.toml — the parser regex probably broke');
  }

  for (const [slug, configValue] of configEntries) {
    const indexPath = `supabase/functions/${slug}/index.ts`;
    let src;
    try {
      src = read(indexPath);
    } catch {
      fail(`config.toml declares [functions.${slug}] but ${indexPath} does not exist`);
      continue;
    }
    // Look for the header's own verify_jwt claim, e.g. "verify_jwt: true"
    // or "verify_jwt is set to FALSE" — the phrasing varies per function, so
    // this takes the nearest true/false word within a short window after
    // the mention rather than requiring a fixed punctuation shape.
    const claimMatch = src.match(/verify_jwt[\s\S]{0,80}?\b(true|false)\b/i);
    if (!claimMatch) {
      fail(`${indexPath} never states its verify_jwt expectation in a comment — config.toml can't be checked against it`);
      continue;
    }
    const claimedValue = claimMatch[1].toLowerCase() === 'true';
    if (claimedValue !== configValue) {
      fail(`config.toml sets verify_jwt=${configValue} for '${slug}' but its header comment claims verify_jwt=${claimedValue}`);
    }
  }
  if (!failed) pass(`verify_jwt in config.toml matches the header comment for all ${configEntries.length} declared functions`);
}

if (failed) {
  process.exit(1);
}

console.log('PASS: POS integration repo invariants hold for all 4 checks');
