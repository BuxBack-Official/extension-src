#!/usr/bin/env node
/**
 * BuxBack extension build.
 *
 * Edit code only in src/. This script writes one ready-to-load build per browser:
 *   dist/chrome/   + dist/chrome-extension.zip
 *   dist/firefox/  + dist/firefox-extension.zip
 *
 * The manifest is src/manifest.json merged with browsers/<name>.json.
 *
 * Usage:
 *   node build.mjs            build every browser
 *   node build.mjs chrome     build one browser
 *   node build.mjs --watch    rebuild when src/ or browsers/ change
 *   node build.mjs --no-zip   skip the zip files
 *   node build.mjs --version 1.2.3   stamp this version instead of the one in src/manifest.json
 *                                    (CI uses this for auto-versioning; also reads EXT_VERSION)
 *
 * Every build syntax-checks all JS files in src/ first and fails if any is broken.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, watch, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const BROWSERS_DIR = join(ROOT, "browsers");
const DIST = join(ROOT, "dist");

const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const zip = !args.includes("--no-zip") && !watchMode;
const allBrowsers = readdirSync(BROWSERS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length));
const versionFlag = args.indexOf("--version");
const versionOverride = (versionFlag !== -1 ? args[versionFlag + 1] : process.env.EXT_VERSION) || null;
const requested = args.filter((a, i) => !a.startsWith("--") && !(versionFlag !== -1 && i === versionFlag + 1));
const browsers = requested.length ? requested : allBrowsers;

// Chrome and Firefox both require 1-4 dot-separated integers, each 0-65535, no leading zeros.
if (versionOverride && !/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/.test(versionOverride)) {
  console.error(`Invalid version "${versionOverride}". Use e.g. 1.2.3`);
  process.exit(1);
}

for (const b of browsers) {
  if (!allBrowsers.includes(b)) {
    console.error(`Unknown browser "${b}". Known: ${allBrowsers.join(", ")}`);
    process.exit(1);
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Deep-merge plain objects; arrays and scalars in `override` replace `base`. */
function merge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

function build(browser) {
  const outDir = join(DIST, browser);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  cpSync(SRC, outDir, {
    recursive: true,
    filter: (path) => !path.endsWith(".DS_Store") && path !== join(SRC, "manifest.json"),
  });

  const manifest = merge(readJson(join(SRC, "manifest.json")), readJson(join(BROWSERS_DIR, `${browser}.json`)));
  if (versionOverride) manifest.version = versionOverride;
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  if (zip) {
    const zipPath = join(DIST, `${browser}-extension.zip`);
    rmSync(zipPath, { force: true });
    execFileSync("zip", ["-qr", zipPath, "."], { cwd: outDir });
  }

  console.log(`✓ ${browser} v${manifest.version} → dist/${browser}${zip ? ` (+ ${browser}-extension.zip)` : ""}`);
}

/** Fail fast on syntax errors in any shared script. */
function checkSyntax(dir = SRC) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) checkSyntax(path);
    else if (entry.name.endsWith(".js")) {
      try {
        execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
      } catch (err) {
        throw new Error(`Syntax error in ${path.slice(ROOT.length + 1)}\n${err.stderr}`);
      }
    }
  }
}

function buildAll() {
  try {
    checkSyntax();
    browsers.forEach(build);
  } catch (err) {
    console.error("✗ Build failed:", err.message);
    if (!watchMode) process.exit(1);
  }
}

buildAll();

if (watchMode) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(buildAll, 100);
  };
  for (const dir of [SRC, BROWSERS_DIR]) {
    if (existsSync(dir)) watch(dir, { recursive: true }, rebuild);
  }
  console.log("Watching src/ and browsers/ for changes...");
}
