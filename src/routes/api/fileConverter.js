const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const util = require("util");

const express = require("express");
const ffmpegStatic = require("ffmpeg-static");
const libre = require("libreoffice-convert");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const { Document, Packer, Paragraph, TextRun } = require("docx");

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
  if (inputExtension === "pdf" || WORD_INPUT_FORMATS.has(inputExtension)) return "document";
  return "unknown";
}

function validateConversion(category, inputExtension, outputExtension) {
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
      (WORD_INPUT_FORMATS.has(inputExtension) && outputExtension === "pdf") ||
      (inputExtension === "pdf" && outputExtension === "docx")
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

async function convertImage(inputBuffer, outputExtension) {
  const sharpFormat = outputExtension === "jpg" ? "jpeg" : outputExtension;
  let pipeline = sharp(inputBuffer, { animated: true }).rotate();

  if (["jpeg", "jpg"].includes(sharpFormat)) {
    pipeline = pipeline.flatten({ background: "#ffffff" });
  }

  return pipeline.toFormat(sharpFormat, { quality: 90 }).toBuffer();
}

function buildFfmpegArgs(inputPath, outputPath, outputExtension, category) {
  const args = ["-y", "-i", inputPath];

  if (category === "audio") {
    args.push("-vn");
  }

  if (category === "video" && ["mp4", "m4v", "mov"].includes(outputExtension)) {
    args.push("-movflags", "+faststart");
  }

  args.push(outputPath);
  return args;
}

function convertWithFfmpeg(inputPath, outputPath, outputExtension, category) {
  return new Promise((resolve, reject) => {
    const args = buildFfmpegArgs(inputPath, outputPath, outputExtension, category);
    const ffmpegProcess = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    ffmpegProcess.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    ffmpegProcess.on("error", reject);
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `FFmpeg a quitté avec le code ${code}.`));
    });
  });
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

async function convertDocument(inputBuffer, inputExtension, outputExtension) {
  if (WORD_INPUT_FORMATS.has(inputExtension) && outputExtension === "pdf") {
    return convertOffice(inputBuffer, ".pdf", undefined);
  }

  if (inputExtension === "pdf" && outputExtension === "docx") {
    const parsedPdf = await pdfParse(inputBuffer);
    const document = createDocxFromText(parsedPdf.text || "");
    return Packer.toBuffer(document);
  }

  throw new Error("Conversion de document non supportée.");
}

async function convertMedia(inputBuffer, inputExtension, outputExtension, category) {
  const inputPath = await writeTempFile(inputBuffer, inputExtension || "bin");
  const outputPath = path.join(
    os.tmpdir(),
    `sorastools-${Date.now()}-${crypto.randomUUID()}.${getDownloadExtension(outputExtension)}`,
  );

  try {
    await convertWithFfmpeg(inputPath, outputPath, outputExtension, category);
    return await fs.readFile(outputPath);
  } finally {
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

router.post("/api/file-converter/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Aucun fichier reçu." });
  }

  const inputExtension = normalizeExtension(getExtension(req.file.originalname));
  const outputExtension = normalizeExtension(req.body.outputFormat);
  const requestedCategory = String(req.body.category || "auto").toLowerCase();
  const category = requestedCategory === "auto"
    ? inferCategory(inputExtension, req.file.mimetype)
    : requestedCategory;

  if (!outputExtension) {
    return res.status(400).json({ success: false, message: "Choisis un format de sortie." });
  }

  if (!validateConversion(category, inputExtension, outputExtension)) {
    return res.status(400).json({
      success: false,
      message: "Conversion non supportée pour ce type de fichier.",
    });
  }

  try {
    let convertedBuffer;

    if (category === "image") {
      convertedBuffer = await convertImage(req.file.buffer, outputExtension);
    } else if (category === "video" || category === "audio") {
      convertedBuffer = await convertMedia(req.file.buffer, inputExtension, outputExtension, category);
    } else if (category === "document") {
      convertedBuffer = await convertDocument(req.file.buffer, inputExtension, outputExtension);
    }

    const downloadExtension = getDownloadExtension(outputExtension);
    const filename = `${sanitizeFilename(req.file.originalname)}.${downloadExtension}`;

    res.setHeader("Content-Type", MIME_TYPES[downloadExtension] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", convertedBuffer.length);
    return res.send(convertedBuffer);
  } catch (error) {
    console.error("Erreur file converter:", error);

    return res.status(500).json({
      success: false,
      message:
        category === "document"
          ? "Conversion impossible. Pour Word → PDF, LibreOffice doit être installé sur la machine serveur. PDF → Word extrait le texte du PDF dans un .docx."
          : "Conversion impossible. Vérifie que le fichier est valide et que FFmpeg supporte ce format.",
    });
  }
});

module.exports = router;
