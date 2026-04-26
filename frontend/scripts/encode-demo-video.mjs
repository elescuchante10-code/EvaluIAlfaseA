import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

// Este script se ejecuta desde `frontend/` (npm run demo:encode).
const projectRoot = process.cwd();
const assetsDir = path.join(projectRoot, 'public', 'assets');

const inputWebm = path.join(assetsDir, 'evaluai-dashboard-demo.webm');
const outputMp4 = path.join(assetsDir, 'evaluai-dashboard-demo.mp4');
const outputPoster = path.join(assetsDir, 'evaluai-dashboard-demo-poster.jpg');

function ensureFile(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing file: ${p}`);
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(cmd)} exited with code ${code}`));
    });
  });
}

async function main() {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static did not resolve a binary for this platform.');
  }

  ensureFile(inputWebm);

  // MP4 para máxima compatibilidad (Safari/WebKit). Ajusta CRF si queda grande.
  await run(ffmpegPath, [
    '-y',
    '-i',
    inputWebm,
    '-vf',
    // El WebM viene con timebase/fps extraño (p.ej. 1000 fps). Normalizamos a 30fps para evitar duplicación masiva.
    "scale='min(1280,iw)':-2,fps=30",
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '30',
    '-pix_fmt',
    'yuv420p',
    // Cap suave de bitrate para mantener tamaño razonable en web.
    '-maxrate',
    '2500k',
    '-bufsize',
    '5000k',
    '-movflags',
    '+faststart',
    '-an',
    outputMp4,
  ]);

  // Poster (1s) para cargar rápido antes de play.
  await run(ffmpegPath, ['-y', '-i', inputWebm, '-ss', '00:00:01', '-frames:v', '1', '-update', '1', outputPoster]);

  ensureFile(outputMp4);
  ensureFile(outputPoster);

  const mp4Mb = (fs.statSync(outputMp4).size / (1024 * 1024)).toFixed(1);
  const posterKb = Math.round(fs.statSync(outputPoster).size / 1024);
  console.log(`OK: ${path.relative(projectRoot, outputMp4)} (${mp4Mb} MB)`);
  console.log(`OK: ${path.relative(projectRoot, outputPoster)} (${posterKb} KB)`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

