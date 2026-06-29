const path = require("path");

const ROOT_DIR = path.join(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const NODE_MODULES_DIR = path.join(ROOT_DIR, "node_modules");
const TOOLS_FILE = path.join(SRC_DIR, "data", "toolStorage.json");

module.exports = {
  ROOT_DIR,
  SRC_DIR,
  PUBLIC_DIR,
  NODE_MODULES_DIR,
  TOOLS_FILE,
};
