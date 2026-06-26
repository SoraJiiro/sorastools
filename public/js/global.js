import {
  applyActionsLabels,
  setupTextareaTabHandlers,
  initFaKit,
} from "./utils.js";

initFaKit();
setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels();
