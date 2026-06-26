import { applyActionsLabels, setupTextareaTabHandlers } from "./utils.js";

setupTextareaTabHandlers("textarea:not([readonly])");
applyActionsLabels("button, a, input, label, select, textarea");
