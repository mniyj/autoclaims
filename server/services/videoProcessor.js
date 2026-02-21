/**
 * 视频处理服务
 * 使用 FFmpeg 提取关键帧，配合 Gemini Vision 进行分析
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

// 获取 API Key
const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

// 检查 FFmpeg 是否可用
async function checkFFmpegAvailable() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
    ffmpeg.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 获取视频元数据
 * @param {string} videoPath - 视频文件路径
 * @returns {Promise<object>}
 */
export async function getVideoMetadata(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: errorOutput || 'FFprobe failed',
        });
        return;
      }

      try {
        const data = JSON.parse(output);
        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        const audioStream = data.streams?.find(s => s.codec_type === 'audio');

        resolve({
          success: true,
          duration: parseFloat(data.format?.duration || 0),
          size: parseInt(data.format?.size || 0),
          format: data.format?.format_name,
          width: videoStream?.width,
          height: videoStream?.height,
          hasAudio: !!audioStream,
          frameRate: videoStream?.r_frame_rate,
          codec: videoStream?.codec_name,
        });
      } catch (e) {
        resolve({
          success: false,
          error: 'Failed to parse FFprobe output',
        });
      }
    });

    ffprobe.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
      });
    });
  });
}

/**
 * 从视频中提取关键帧
 * @param {string} videoPath - 视频文件路径
 * @param {object} options - 提取选项
 * @returns {Promise<{keyFrames: Array, success: boolean}>}
 */
export async function extractKeyFrames(videoPath, options = {}) {
  const {
    maxFrames = 10,        // 最大帧数
    minInterval = 2,       // 最小间隔（秒）
    outputDir = null,      // 输出目录（默认临时目录）
    startTime = 0,         // 开始时间
    endTime = null,        // 结束时间
  } = options;

  // 检查 FFmpeg
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    return {
      success: false,
      keyFrames: [],
      error: 'FFmpeg not available. Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)',
    };
  }

  // 创建临时输出目录
  const tempDir = outputDir || path.join(os.tmpdir(), `video-frames-${Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 先获取视频元数据以确定时长
  const metadata = await getVideoMetadata(videoPath);
  if (!metadata.success) {
    return {
      success: false,
      keyFrames: [],
      error: metadata.error,
    };
  }

  const duration = metadata.duration;
  const effectiveEndTime = endTime || duration;
  const effectiveDuration = effectiveEndTime - startTime;

  // 计算提取时间点
  const interval = Math.max(minInterval, effectiveDuration / maxFrames);
  const timestamps = [];
  for (let t = startTime + interval / 2; t < effectiveEndTime; t += interval) {
    if (timestamps.length >= maxFrames) break;
    timestamps.push(t);
  }

  // 提取帧
  const keyFrames = [];
  const framePromises = timestamps.map((timestamp, index) => {
    return new Promise((resolve) => {
      const outputPath = path.join(tempDir, `frame-${index.toString().padStart(3, '0')}.jpg`);
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-ss', timestamp.toString(),
        '-i', videoPath,
        '-frames:v', '1',
        '-q:v', '2',
        outputPath
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          const imageData = fs.readFileSync(outputPath);
          resolve({
            timestamp,
            imagePath: outputPath,
            imageBase64: imageData.toString('base64'),
          });
        } else {
          resolve(null);
        }
      });

      ffmpeg.on('error', () => {
        resolve(null);
      });
    });
  });

  const results = await Promise.all(framePromises);

  // 过滤有效帧
  for (const result of results) {
    if (result) {
      keyFrames.push({
        timestamp: result.timestamp,
        imageData: result.imageBase64,
        imagePath: result.imagePath,
      });
    }
  }

  return {
    success: true,
    keyFrames,
    tempDir,
    metadata,
  };
}

/**
 * 从视频中提取音频并转写
 * @param {string} videoPath - 视频文件路径
 * @param {object} options - 提取选项
 * @returns {Promise<{audioPath: string, transcript: string}>}
 */
export async function extractAndTranscribeAudio(videoPath, options = {}) {
  const tempDir = path.join(os.tmpdir(), `video-audio-${Date.now()}`);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const audioPath = path.join(tempDir, 'audio.mp3');

  // 提取音频
  const extractResult = await new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-q:a', '2',
      audioPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      resolve({
        success: code === 0,
        audioPath: code === 0 ? audioPath : null,
        error: code !== 0 ? errorOutput : null,
      });
    });

    ffmpeg.on('error', (error) => {
      resolve({
        success: false,
        audioPath: null,
        error: error.message,
      });
    });
  });

  if (!extractResult.success) {
    return {
      success: false,
      audioPath: null,
      transcript: '',
      error: extractResult.error,
    };
  }

  // 使用 Gemini 进行语音转写（如果音频文件不太大）
  const stats = fs.statSync(audioPath);
  const maxSize = 10 * 1024 * 1024; // 10MB 限制

  if (stats.size > maxSize) {
    return {
      success: true,
      audioPath,
      transcript: '',
      note: 'Audio file too large for direct transcription',
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      success: true,
      audioPath,
      transcript: '',
      note: 'No API key for transcription',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const audioData = fs.readFileSync(audioPath);

    // 使用 Gemini 处理音频
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: audioData.toString('base64'),
            }
          },
          { text: '请将这段音频内容转写为文字。如果是中文请使用中文输出。' }
        ]
      },
      config: {
        temperature: 0,
      }
    });

    return {
      success: true,
      audioPath,
      transcript: response.text || '',
    };
  } catch (error) {
    return {
      success: true,
      audioPath,
      transcript: '',
      error: error.message,
    };
  }
}

/**
 * 使用 Gemini Vision 分析关键帧
 * @param {Array} keyFrames - 关键帧列表
 * @param {string} context - 分析上下文
 * @returns {Promise<Array>}
 */
export async function analyzeKeyFrames(keyFrames, context = '事故现场分析') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return keyFrames.map(kf => ({
      ...kf,
      description: 'API key not available',
      analysis: null,
    }));
  }

  const ai = new GoogleGenAI({ apiKey });
  const results = [];

  for (const frame of keyFrames) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: frame.imageData,
              }
            },
            { text: `请分析这张图片，上下文是"${context}"。
请描述：
1. 场景内容（人物、物体、环境）
2. 可见的细节或线索
3. 是否有异常情况
请用简洁的中文回答。` }
          ]
        },
        config: {
          temperature: 0.1,
        }
      });

      results.push({
        ...frame,
        description: response.text || '',
        analysis: {
          success: true,
          summary: response.text,
        },
      });
    } catch (error) {
      results.push({
        ...frame,
        description: '',
        analysis: {
          success: false,
          error: error.message,
        },
      });
    }
  }

  return results;
}

/**
 * 完整的视频处理流程
 * @param {object} params - 处理参数
 * @returns {Promise<object>}
 */
export async function processVideo(params) {
  const { buffer, videoPath, ossKey, options = {} } = params;
  const startTime = Date.now();

  // 确定视频路径
  let actualVideoPath = videoPath;

  // 如果提供的是 buffer，先写入临时文件
  if (buffer && !videoPath) {
    const tempDir = path.join(os.tmpdir(), `video-process-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    actualVideoPath = path.join(tempDir, 'input.mp4');
    fs.writeFileSync(actualVideoPath, buffer);
  }

  if (!actualVideoPath || !fs.existsSync(actualVideoPath)) {
    return {
      success: false,
      metadata: null,
      keyFrames: [],
      audioTranscript: '',
      error: 'Video path not found',
    };
  }

  try {
    // 1. 获取元数据
    const metadataResult = await getVideoMetadata(actualVideoPath);
    if (!metadataResult.success) {
      return {
        success: false,
        metadata: null,
        keyFrames: [],
        audioTranscript: '',
        error: metadataResult.error,
      };
    }

    // 2. 提取关键帧
    const framesResult = await extractKeyFrames(actualVideoPath, {
      maxFrames: options.maxFrames || 10,
      minInterval: 2,
    });

    let keyFrames = framesResult.keyFrames || [];

    // 3. 分析关键帧
    if (keyFrames.length > 0 && !options.skipFrameAnalysis) {
      keyFrames = await analyzeKeyFrames(keyFrames, options.context || '事故现场分析');
    }

    // 4. 提取并转写音频
    let audioTranscript = '';
    if (options.extractAudio && metadataResult.hasAudio) {
      const audioResult = await extractAndTranscribeAudio(actualVideoPath);
      audioTranscript = audioResult.transcript || '';
    }

    // 清理临时文件
    if (buffer && actualVideoPath) {
      try {
        fs.unlinkSync(actualVideoPath);
      } catch (e) {
        // ignore
      }
    }

    return {
      success: true,
      metadata: {
        duration: metadataResult.duration,
        width: metadataResult.width,
        height: metadataResult.height,
        format: metadataResult.format,
        size: metadataResult.size,
        keyFrames: keyFrames.map(kf => ({
          timestamp: kf.timestamp,
          description: kf.description,
        })),
      },
      keyFrames,
      audioTranscript,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      metadata: null,
      keyFrames: [],
      audioTranscript: '',
      error: error.message,
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  checkFFmpegAvailable,
  getVideoMetadata,
  extractKeyFrames,
  extractAndTranscribeAudio,
  analyzeKeyFrames,
  processVideo,
};
