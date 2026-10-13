// Capture V12 keyframes and temporal boundary samples for human visual review.
// Usage: node visual_review.cjs ; python3 make_contact.py
// Numeric comparisons are observations, not an automated aesthetic verdict.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {serve} = require('./render.cjs');
let pw; try {pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');}
catch {pw = require('/workspace/Yaoguai-Kezhan/node_modules/playwright');}
const root = __dirname, review = path.join(root, 'review'), score = require('./score.json');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const keyTimes = [0, 2.5, 4.05, 5.45, 7.1, 8.5, 9.8, 11.75, 13.55, 15.15, 16.8, 18.8, 20.65, 21.55, 23.6, 25.6];
// Seven scene boundaries and three internal V11-based transition landmarks.
// Update the internal landmarks if their timing changes in film.js.
const boundaries = [...score.scene_starts.slice(1), 21.21, 21.78, 26.68].sort((a, b) => a - b);

async function main() {
  fs.mkdirSync(review, {recursive: true});
  const sourceHashes = Object.fromEntries(['film.js', 'timeline.js', 'score.json', 'index.html'].map(file => [file, sha(file)]));
  const server = serve();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const errors = [];
  try {
    browser = await pw.chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true});
    const page = await browser.newPage({viewport: {width: score.width, height: score.height}, deviceScaleFactor: 1});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?export`);
    await page.evaluate(() => window.ready);
    await page.evaluate(() => document.fonts.ready);
    const jobs = keyTimes.map((time, i) => ({kind: 'keyframe', time, label: score.phrases[i].text}));
    for (const boundary of boundaries) {
      for (const sign of [-1, 1]) jobs.push({kind: 'boundary', boundary,
        time: Math.min(score.duration, Math.max(0, boundary + sign / score.fps)),
        label: `${boundary.toFixed(2)}s ${sign < 0 ? '前' : '后'} 1 帧`});
    }
    const captures = [];
    for (const [index, job] of jobs.entries()) {
      const state = await page.evaluate(time => window.renderAt(time), job.time);
      const file = `v12-${String(index + 1).padStart(2, '0')}-${job.time.toFixed(3)}.png`;
      const encoded = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
      fs.writeFileSync(path.join(review, file), Buffer.from(encoded, 'base64'));
      captures.push({...job, file, state});
    }
    const measurements = await page.evaluate(({boundaries, duration}) => {
      const canvas = document.querySelector('canvas'), context = canvas.getContext('2d');
      function compare(t1, t2) {
        window.renderAt(t1);
        const first = context.getImageData(0, 0, canvas.width, canvas.height).data;
        window.renderAt(t2);
        const second = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let changedPixels = 0, maxChannelDelta = 0, absoluteDelta = 0;
        for (let i = 0; i < first.length; i += 4) {
          let changed = false;
          for (let channel = 0; channel < 3; channel++) {
            const delta = Math.abs(first[i + channel] - second[i + channel]);
            changed ||= delta !== 0;
            maxChannelDelta = Math.max(maxChannelDelta, delta);
            absoluteDelta += delta;
          }
          changedPixels += Number(changed);
        }
        return {before_seconds: t1, after_seconds: t2, changedPixels, totalPixels: canvas.width * canvas.height,
          meanRGBDelta: absoluteDelta / (canvas.width * canvas.height * 3), maxChannelDelta};
      }
      const loop = compare(0, duration);
      return {loop: {...loop, exact: loop.changedPixels === 0},
        continuity: boundaries.map(time => ({boundary_seconds: time, ...compare(time - .000001, time + .000001)}))};
    }, {boundaries, duration: score.duration});
    const sourceUnchanged = Object.entries(sourceHashes).every(([file, hash]) => sha(file) === hash);
    const manifest = {
      version: 'V12', viewport: [score.width, score.height], fps: score.fps,
      film_sha256: sourceHashes['film.js'], source_hashes: sourceHashes, source_unchanged_during_capture: sourceUnchanged,
      captures, measurements, errors,
      review_status: 'Frames captured; human visual assessment is separate.',
      measurement_scope: 'Deterministic Canvas before lossy encoding; epsilon-boundary deltas do not measure perceived motion quality.',
      limitations: 'Samples are not full-video playback or audio-listening review. Visual loop measurements do not imply seamless audio.'
    };
    fs.writeFileSync(path.join(review, 'frames.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({frames: captures.length, sourceUnchanged, measurements, errors}, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
    if (!sourceUnchanged) throw new Error('Film/source changed during review capture; rerun when edits finish.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
