/**
 * Video Export Module for StoryboardGen
 *
 * This module handles the export of storyboard panels as video files
 * using FFmpeg. It supports multiple formats (MP4, WebM), frame duration
 * control, and transition effects.
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Default export options
 */
const DEFAULT_OPTIONS = {
  format: 'mp4',
  frameDuration: 3,
  transitionDuration: 0.5,
  fps: 30,
  quality: 'medium',
  width: 1920,
  height: 1080
};

/**
 * Get quality settings for FFmpeg
 */
function getQualitySettings(quality) {
  const settings = {
    low: {
      videoBitrate: '1000k',
      audioBitrate: '128k',
      crf: 28
    },
    medium: {
      videoBitrate: '2500k',
      audioBitrate: '192k',
      crf: 23
    },
    high: {
      videoBitrate: '5000k',
      audioBitrate: '320k',
      crf: 18
    }
  };
  return settings[quality] || settings.medium;
}

/**
 * Download an image from a URL to a temporary file
 */
async function downloadImage(imageUrl, tempDir) {
  const axios = require('axios');
  const { v4: uuidv4 } = require('uuid');

  try {
    // Handle data URLs
    if (imageUrl.startsWith('data:')) {
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }

      const ext = matches[1];
      const base64Data = matches[2];
      const filename = path.join(tempDir, `${uuidv4()}.${ext}`);

      fs.writeFileSync(filename, base64Data, 'base64');
      return filename;
    }

    // Handle HTTP/HTTPS URLs
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const ext = path.extname(imageUrl) || '.jpg';
    const filename = path.join(tempDir, `${uuidv4()}${ext}`);

    fs.writeFileSync(filename, response.data);
    return filename;
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Get the default save directory for exported videos
 */
function getDefaultSaveDir() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Movies'),
    path.join(home, 'Downloads'),
    path.join(home, 'Desktop'),
    home
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return home;
}

/**
 * Export storyboard panels as a video file
 */
async function exportVideo(panels, options = {}, onProgress) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const qualitySettings = getQualitySettings(mergedOptions.quality);

  // Create temporary directory for downloaded images
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storyboard-export-'));

  try {
    // Download all panels to temporary files
    if (onProgress) {
      onProgress({
        percent: 5,
        currentFrame: 0,
        totalFrames: panels.length,
        message: 'Downloading panels...'
      });
    }

    const imageFiles = [];
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      if (onProgress) {
        onProgress({
          percent: 5 + Math.floor((i / panels.length) * 10),
          currentFrame: i + 1,
          totalFrames: panels.length,
          message: `Downloading panel ${i + 1} of ${panels.length}...`
        });
      }

      const imagePath = await downloadImage(panel.url, tempDir);
      imageFiles.push(imagePath);
    }

    // Generate output filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const extension = mergedOptions.format === 'webm' ? '.webm' : '.mp4';
    const filename = mergedOptions.outputFilename || `storyboard-${timestamp}${extension}`;
    const outputPath = path.join(getDefaultSaveDir(), filename);

    if (onProgress) {
      onProgress({
        percent: 15,
        currentFrame: 0,
        totalFrames: panels.length,
        message: 'Preparing video composition...'
      });
    }

    // Create FFmpeg command
    let command = ffmpeg();

    // Add all images as inputs
    imageFiles.forEach(file => {
      command = command.addInput(file);
    });

    // Configure output based on format
    const outputOptions = [
      '-vsync', 'vfr',
      '-pix_fmt', 'yuv420p'
    ];

    if (mergedOptions.format === 'mp4') {
      outputOptions.push(
        '-movflags', '+faststart',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', String(qualitySettings.crf),
        '-b:v', qualitySettings.videoBitrate
      );
    } else if (mergedOptions.format === 'webm') {
      outputOptions.push(
        '-c:v', 'libvpx-vp9',
        '-b:v', qualitySettings.videoBitrate,
        '-crf', String(qualitySettings.crf)
      );
    }

    // Add duration to each input
    const inputOptions = [];
    imageFiles.forEach(() => {
      inputOptions.push('-loop', '1', '-t', String(mergedOptions.frameDuration));
    });

    return new Promise((resolve, reject) => {
      command
        .inputOptions(inputOptions)
        .outputOptions(outputOptions)
        .size(`${mergedOptions.width}x${mergedOptions.height}`)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
          if (onProgress) {
            onProgress({
              percent: 20,
              currentFrame: 0,
              totalFrames: panels.length,
              message: 'Starting video encoding...'
            });
          }
        })
        .on('progress', (progress) => {
          if (onProgress) {
            const percent = Math.min(20 + Math.floor(progress.percent * 0.7), 95);
            onProgress({
              percent,
              currentFrame: Math.floor((panels.length * progress.percent) / 100),
              totalFrames: panels.length,
              message: `Encoding video: ${Math.floor(progress.percent)}%`
            });
          }
        })
        .on('end', () => {
          if (onProgress) {
            onProgress({
              percent: 100,
              currentFrame: panels.length,
              totalFrames: panels.length,
              message: 'Video export complete!'
            });
          }

          // Cleanup temporary files
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }

          resolve({ outputPath, filename });
        })
        .on('error', (err) => {
          // Cleanup temporary files on error
          try {
            fs.rmSync(tempDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }

          reject(new Error(`Video export failed: ${err.message}`));
        })
        .save(outputPath);
    });

  } catch (error) {
    // Cleanup temporary files on error
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }

    throw error;
  }
}

/**
 * Check if FFmpeg is available on the system
 */
async function checkFFmpegAvailable() {
  return new Promise((resolve) => {
    ffmpeg.getAvailableFormats((err, formats) => {
      if (err) {
        resolve(false);
      } else {
        resolve(!!formats);
      }
    });
  });
}

/**
 * Get FFmpeg path (useful for debugging)
 */
async function getFFmpegPath() {
  return new Promise((resolve, reject) => {
    ffmpeg.getFFmpegPath((err, ffmpegPath) => {
      if (err) {
        reject(err);
      } else {
        resolve(ffmpegPath);
      }
    });
  });
}

module.exports = {
  exportVideo,
  checkFFmpegAvailable,
  getFFmpegPath
};