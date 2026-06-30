const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const util = require("util");

const { Document, Packer, Paragraph, TextRun } = require("docx");
const express = require("express");
const ffmpegStatic = require("ffmpeg-static");
const libre = require("libreoffice-convert");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const XLSX = require("xlsx");

const convertOffice = util.promisify(libre.convert);
const router = express.Router();
const ffmpegPath = ffmpegStatic || "ffmpeg";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 350 * 1024 * 1024,
  },
});

const IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "avif", "tiff", "gif"]);
const VIDEO_FORMATS = new Set(["mp4", "webm", "mkv", "mov", "avi", "m4v", "ogv"]);
const AUDIO_FORMATS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus", "webm"]);
const WORD_INPUT_FORMATS = new Set(["doc", "docx", "odt", "rtf"]);
const EXCEL_INPUT_FORMATS = new Set(["xls", "xlsx", "ods", "csv"]);
const POWERPOINT_INPUT_FORMATS = new Set(["ppt", "pptx", "odp"]);
const PDF_TO_OFFICE_FORMATS = new Set(["docx", "xlsx", "pptx"]);
const OFFICE_TO_PDF_FORMATS = new Set([
  ...WORD_INPUT_FORMATS,
  ...EXCEL_INPUT_FORMATS,
  ...POWERPOINT_INPUT_FORMATS,
]);

const MIME_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  tiff: "image/tiff",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  ogv: "video/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  m4a: "audio/mp4",
  opus: "audio/opus",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function getExtension(filename = "") {
  return path.extname(filename).replace(".", "").toLowerCase();
}

function normalizeExtension(extension = "") {
  const cleanExtension = String(extension).replace(/^\./, "").trim().toLowerCase();
  return cleanExtension === "jpg" ? "jpeg" : cleanExtension;
}

function getDownloadExtension(extension = "") {
  return extension === "jpeg" ? "jpg" : extension;
}

function sanitizeFilename(filename = "file") {
  return String(filename)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "converted-file";
}

function inferCategory(inputExtension, mimetype = "") {
  if (mimetype.startsWith("image/") || IMAGE_FORMATS.has(inputExtension)) return "image";
  if (mimetype.startsWith("video/") || VIDEO_FORMATS.has(inputExtension)) return "video";
  if (mimetype.startsWith("audio/") || AUDIO_FORMATS.has(inputExtension)) return "audio";
  if (
    inputExtension === "pdf" ||
    OFFICE_TO_PDF_FORMATS.has(inputExtension) ||
    PDF_TO_OFFICE_FORMATS.has(inputExtension)
  ) {
    return "document";
  }
  return "unknown";
}

function validateConversion(category, inputExtension, outputExtension, mode) {
  if (mode === "compress") {
    return (
      IMAGE_FORMATS.has(inputExtension) ||
      VIDEO_FORMATS.has(inputExtension) ||
      AUDIO_FORMATS.has(inputExtension) ||
      inputExtension === "pdf"
    );
  }

  if (category === "image") {
    return IMAGE_FORMATS.has(inputExtension) && IMAGE_FORMATS.has(outputExtension);
  }

  if (category === "video") {
    return VIDEO_FORMATS.has(outputExtension);
  }

  if (category === "audio") {
    return AUDIO_FORMATS.has(outputExtension);
  }

  if (category === "document") {
    return (
      (OFFICE_TO_PDF_FORMATS.has(inputExtension) && outputExtension === "pdf") ||
      (inputExtension === "pdf" && PDF_TO_OFFICE_FORMATS.has(outputExtension))
    );
  }

  return false;
}

async function writeTempFile(buffer, extension) {
  const filePath = path.join(
    os.tmpdir(),
    `sorastools-${Date.now()}-${crypto.randomUUID()}.${extension}`,
  );

  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function safeUnlink(filePath) {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Impossible de supprimer le fichier temporaire ${filePath}:`, error.message);
    }
  }
}

function runProcess(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${label} a quitté avec le code ${code}.`));
    });
  });
}

async function convertImage(inputBuffer, outputExtension, quality = 90) {
  const sharpFormat = outputExtension === "jpg" ? "jpeg" : outputExtension;
  let pipeline = sharp(inputBuffer, { animated: true }).rotate();

  if (["jpeg", "jpg"].includes(sharpFormat)) {
    pipeline = pipeline.flatten({ background: "#ffffff" });
  }

  return pipeline.toFormat(sharpFormat, { quality }).toBuffer();
}

function buildFfmpegArgs(inputPath, outputPath, outputExtension, category, mode = "convert") {
  const args = ["-y", "-i", inputPath];

  if (category === "audio") {
    args.push("-vn");
  }

  if (mode === "compress") {
    if (category === "video") {
      args.push("-vcodec", "libx264", "-crf", "28", "-preset", "medium", "-acodec", "aac", "-b:a", "128k");
    }

    if (category === "audio") {
      if (outputExtension === "mp3") args.push("-b:a", "128k");
      if (["m4a", "aac"].includes(outputExtension)) args.push("-b:a", "128k");
      if (outputExtension === "ogg") args.push("-b:a", "112k");
      if (outputExtension === "opus") args.push("-b:a", "96k");
    }
  }

  if (category === "video" && ["mp4", "m4v", "mov"].includes(outputExtension)) {
    args.push("-movflags", "+faststart");
  }

  args.push(outputPath);
  return args;
}

function convertWithFfmpeg(inputPath, outputPath, outputExtension, category, mode = "convert") {
  const args = buildFfmpegArgs(inputPath, outputPath, outputExtension, category, mode);
  return runProcess(ffmpegPath, args, "FFmpeg");
}

function createDocxFromText(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  const children = lines.length
    ? lines.map((line) => new Paragraph({ children: [new TextRun(line)] }))
    : [new Paragraph({ children: [new TextRun("Document PDF converti sans texte détectable.")] })];

  return new Document({ sections: [{ children }] });
}

function createXlsxFromText(text) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => [line.trim()])
    .filter((row) => row[0]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows.length ? [["Contenu extrait du PDF"], ...rows] : [["Aucun texte détectable dans le PDF."]]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "PDF");
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

async function createPptxFromText(text) {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SoraTools";
  pptx.subject = "PDF converti en PowerPoint";
  pptx.title = "PDF converti";
  pptx.company = "SoraTools";
  pptx.lang = "fr-FR";

  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.match(/[\s\S]{1,700}/g) || []);

  const slideTexts = chunks.length ? chunks : ["Aucun texte détectable dans le PDF."];

  slideTexts.forEach((slideText, index) => {
    const slide = pptx.addSlide();
    slide.addText(`Page ${index + 1}`, {
      x: 0.5,
      y: 0.25,
      w: 12.3,
      h: 0.35,
      fontSize: 16,
      bold: true,
    });
    slide.addText(slideText, {
      x: 0.65,
      y: 0.85,
      w: 12,
      h: 6.2,
      fontSize: 18,
      breakLine: false,
      fit: "shrink",
      valign: "top",
    });
  });

  return pptx.write({ outputType: "nodebuffer" });
}

async function convertPdfToOffice(inputBuffer, outputExtension) {
  const parsedPdf = await pdfParse(inputBuffer);
  const text = parsedPdf.text || "";

  if (outputExtension === "docx") {
    return Packer.toBuffer(createDocxFromText(text));
  }

  if (outputExtension === "xlsx") {
    return createXlsxFromText(text);
  }

  if (outputExtension === "pptx") {
    return createPptxFromText(text);
  }

  throw new Error("Conversion PDF non supportée.");
}

async function convertDocument(inputBuffer, inputExtension, outputExtension) {
  if (OFFICE_TO_PDF_FORMATS.has(inputExtension) && outputExtension === "pdf") {
    return convertOffice(inputBuffer, ".pdf", undefined);
  }

  if (inputExtension === "pdf" && PDF_TO_OFFICE_FORMATS.has(outputExtension)) {
    return convertPdfToOffice(inputBuffer, outputExtension);
  }

  throw new Error("Conversion de document non supportée.");
}

async function convertMedia(inputBuffer, inputExtension, outputExtension, category, mode = "convert") {
  const inputPath = await writeTempFile(inputBuffer, inputExtension || "bin");
  const outputPath = path.join(
    os.tmpdir(),
    `sorastools-${Date.now()}-${crypto.randomUUID()}.${getDownloadExtension(outputExtension)}`,
  );

  try {
    await convertWithFfmpeg(inputPath, outputPath, outputExtension, category, mode);
    return await fs.readFile(outputPath);
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

async function compressPdf(inputBuffer) {
  const inputPath = await writeTempFile(inputBuffer, "pdf");
  const outputPath = path.join(os.tmpdir(), `sorastools-${Date.now()}-${crypto.randomUUID()}.pdf`);

  try {
    await runProcess(
      "gs",
      [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      "Ghostscript",
    );

    return await fs.readFile(outputPath);
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

async function compressFile(inputBuffer, inputExtension, category) {
  if (category === "image") {
    return convertImage(inputBuffer, inputExtension, 72);
  }

  if (category === "video" || category === "audio") {
    return convertMedia(inputBuffer, inputExtension, inputExtension, category, "compress");
  }

  if (inputExtension === "pdf") {
    return compressPdf(inputBuffer);
  }

  throw new Error("Compression non supportée pour ce type de fichier.");
}

function getResponseFilename(originalName, outputExtension, mode) {
  const suffix = mode === "compress" ? "-compressed" : "";
  return `${sanitizeFilename(originalName)}${suffix}.${getDownloadExtension(outputExtension)}`;
}

router.post("/api/file-converter/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Aucun fichier reçu." });
  }

  const inputExtension = normalizeExtension(getExtension(req.file.originalname));
  const requestedMode = String(req.body.mode || "convert").toLowerCase();
  const mode = requestedMode === "compress" ? "compress" : "convert";
  const outputExtension = mode === "compress"
    ? inputExtension
    : normalizeExtension(req.body.outputFormat);
  const requestedCategory = String(req.body.category || "auto").toLowerCase();
  const category = requestedCategory === "auto"
    ? inferCategory(inputExtension, req.file.mimetype)
    : requestedCategory;

  if (mode === "convert" && !outputExtension) {
    return res.status(400).json({ success: false, message: "Choisis un format de sortie." });
  }

  if (!validateConversion(category, inputExtension, outputExtension, mode)) {
    return res.status(400).json({
      success: false,
      message: mode === "compress"
        ? "Compression non supportée pour ce type de fichier."
        : "Conversion non supportée pour ce type de fichier.",
    });
  }

  try {
    let resultBuffer;

    if (mode === "compress") {
      resultBuffer = await compressFile(req.file.buffer, inputExtension, category);
    } else if (category === "image") {
      resultBuffer = await convertImage(req.file.buffer, outputExtension);
    } else if (category === "video" || category === "audio") {
      resultBuffer = await convertMedia(req.file.buffer, inputExtension, outputExtension, category);
    } else if (category === "document") {
      resultBuffer = await convertDocument(req.file.buffer, inputExtension, outputExtension);
    }

    const downloadExtension = getDownloadExtension(outputExtension);
    const filename = getResponseFilename(req.file.originalname, outputExtension, mode);

    res.setHeader("Content-Type", MIME_TYPES[downloadExtension] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", resultBuffer.length);
    return res.send(resultBuffer);
  } catch (error) {
    console.error("Erreur file converter:", error);

    return res.status(500).json({
      success: false,
      message:
        mode === "compress"
          ? "Compression impossible. Pour les PDF, Ghostscript doit être installé sur la machine serveur."
          : category === "document"
            ? "Conversion impossible. Pour Office → PDF, LibreOffice doit être installé sur la machine serveur. PDF → Office extrait le texte du PDF dans un fichier éditable."
            : "Conversion impossible. Vérifie que le fichier est valide et que FFmpeg supporte ce format.",
    });
  }
});

module.exports = router;
