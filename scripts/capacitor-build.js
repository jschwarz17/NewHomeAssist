/**
 * Build for Capacitor (static export). Next.js "output: export" does not support
 * API routes, so we temporarily move src/app/api aside, build, then restore.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const apiHide = path.join(root, ".api-capacitor-hide");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

if (!fs.existsSync(apiDir)) {
  console.log("No src/app/api found, running build as-is.");
  execSync("cross-env BUILD_FOR_CAPACITOR=1 next build", { stdio: "inherit", cwd: root });
  process.exit(0);
}

try {
  copyDir(apiDir, apiHide);
  rmDir(apiDir);
  console.log("Moved src/app/api aside for static export.");
  execSync("cross-env BUILD_FOR_CAPACITOR=1 next build", { stdio: "inherit", cwd: root });
} finally {
  if (fs.existsSync(apiHide)) {
    rmDir(apiDir);
    copyDir(apiHide, apiDir);
    rmDir(apiHide);
    console.log("Restored src/app/api.");
  }
}
