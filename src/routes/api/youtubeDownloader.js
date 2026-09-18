const { spawn } = require("child_process");
const crypto = require("crypto");
const express = require("express");
const ffmpegStatic = require("ffmpeg-static");
const fs = require("fs");
const os = require("os");
const path = require("path");
const youtubeDl = require("youtube-dl-exec");

const router = express.Router();
const ffmpegPath = ffmpegStatic || "ffmpeg";

function convertAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      outputPath,
    ]);

    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}.`));
    });
  });
}

function sanitizeFilename(value = "youtube-download") {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "youtube-download"
  );
}

function isSupportedYoutubeUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      ["youtube.com", "m.youtube.com", "youtu.be"].includes(hostname) &&
      !url.searchParams.has("list") &&
      (hostname === "youtu.be" ||
        url.pathname === "/watch" ||
        url.pathname.startsWith("/shorts/"))
    );
  } catch (error) {
    return false;
  }
}

router.post("/api/youtube/download", async (req, res) => {
  const url = String(req.body.url || "").trim();
  const type = req.body.type === "audio" ? "audio" : "video";

  if (!isSupportedYoutubeUrl(url)) {
    return res.status(400).json({
      success: false,
      message: "Entre une URL valide de vidéo ou de Short YouTube.",
    });
  }

  try {
    const metadata = await youtubeDl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      skipDownload: true,
    });
    const title = sanitizeFilename(metadata.title);
    const extension = type === "audio" ? "mp3" : "mp4";
    const outputPath = path.join(
      os.tmpdir(),
      `sorastools-youtube-${crypto.randomUUID()}.${extension}`,
    );
    const sourcePath =
      type === "audio"
        ? path.join(
            os.tmpdir(),
            `sorastools-youtube-${crypto.randomUUID()}.webm`,
          )
        : outputPath;

    try {
      const flags =
        type === "audio"
          ? {
              format: "bestaudio/best",
              output: sourcePath,
            }
          : {
              format: "bestvideo*+bestaudio/best",
              mergeOutputFormat: "mp4",
              output: outputPath,
            };

      await youtubeDl(url, {
        ...flags,
        ...(ffmpegStatic ? { ffmpegLocation: path.dirname(ffmpegStatic) } : {}),
        noWarnings: true,
        noCheckCertificates: true,
      });

      if (type === "audio") await convertAudio(sourcePath, outputPath);

      const media = fs.createReadStream(outputPath);
      const cleanup = () => fs.rm(outputPath, { force: true }, () => {});
      media.once("error", (error) => {
        cleanup();
        if (!res.headersSent)
          res
            .status(502)
            .json({ success: false, message: "Vidéo indisponible." });
        else res.destroy(error);
      });
      media.once("close", cleanup);
      const stats = await fs.promises.stat(outputPath);
      res.setHeader(
        "Content-Type",
        type === "audio" ? "audio/mpeg" : "video/mp4",
      );
      res.setHeader("Content-Length", stats.size);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${title}.${extension}"`,
      );
      media.pipe(res);
    } catch (error) {
      await fs.promises.rm(outputPath, { force: true });
      await fs.promises.rm(sourcePath, { force: true });
      throw error;
    }
  } catch (error) {
    console.error("Erreur préparation téléchargement YouTube:", error);
    return res.status(502).json({
      success: false,
      message: "Téléchargement impossible pour cette vidéo YouTube.",
    });
  }
});

module.exports = router;
