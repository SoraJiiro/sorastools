const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");
const ffmpeg = require("ffmpeg-static");
const router = require("../src/routes/api/fileConverter");

test("video cuts start without waiting for the next keyframe", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "video-cutter-test-"),
  );
  const app = express();
  app.use(router);
  const server = app.listen(0);

  function runFfmpeg(args) {
    const result = spawnSync(ffmpeg, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stderr;
  }

  try {
    for (const [extension, videoCodec, audioCodec] of [
      ["mp4", "libx264", "aac"],
      ["webm", "libvpx-vp9", "libopus"],
    ]) {
      const source = path.join(directory, `source.${extension}`);
      const output = path.join(directory, `cut.${extension}`);
      runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=320x180:rate=25",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-t",
        "8",
        "-c:v",
        videoCodec,
        "-g",
        "150",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        audioCodec,
        source,
      ]);

      const form = new FormData();
      form.append(
        "file",
        new Blob([fs.readFileSync(source)]),
        `source.${extension}`,
      );
      form.append("start", "1");
      form.append("end", "4");
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/video-cutter/cut`,
        {
          method: "POST",
          body: form,
        },
      );
      assert.equal(response.status, 200);
      fs.writeFileSync(output, Buffer.from(await response.arrayBuffer()));

      const log = runFfmpeg([
        "-hide_banner",
        "-i",
        output,
        "-map",
        "0:v:0",
        "-vf",
        "showinfo",
        "-an",
        "-f",
        "null",
        "-",
      ]);
      const frames = [
        ...log.matchAll(/\bn:\s*\d+\s+pts:\s*-?\d+\s+pts_time:\s*([\d.-]+)/g),
      ];
      assert.ok(frames.length >= 70, `${extension}: too few video frames`);
      assert.ok(Number(frames[0][1]) < 0.2, `${extension}: video starts late`);
      assert.match(
        log,
        /\bn:\s*0\s+pts:.*?iskey:1/,
        `${extension}: first video frame is not a keyframe`,
      );
      runFfmpeg([
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        output,
        "-map",
        "0:a:0",
        "-f",
        "null",
        "-",
      ]);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
