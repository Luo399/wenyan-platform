#!/usr/bin/env node
/**
 * 探测多角色朗读音频并计算时长 → audio-index.json
 *
 * 为什么需要它
 * ------------
 * Figma 文字资源里没有朗读音频的时间轴，页面层 multi_role_reading JSON 又必须给
 * time_range。音频文件名约定是 `WEN_nn_multi_role.mp3`（OSS 在 /audio/ 下），
 * 所以至少可以把「整篇朗读」段落的时间范围算准——直接解析 MP3 帧头，
 * 不依赖 ffmpeg，也不猜码率。
 *
 * 用法：
 *   node scripts/probe-multi-role-audio.cjs [--ids 05,07,08] [--base https://www.classicalab.cn/audio/] [--out audio-index.json]
 *
 * 输出（供 scripts/gen-step1-page-data.cjs --audio-index 使用）：
 *   { "WEN_05": { "audio_file": "WEN_05_multi_role.mp3", "durationSeconds": 181.56, "bytes": 7270475 } }
 *
 * 注意：这个索引只是**时长缓存**，不是发布物；页面层 JSON 生成后不必把它提交进仓库。
 */

const fs = require('fs')
const path = require('path')

const DEFAULT_IDS = [
  '01', '02', '03', '04', '05', '07', '08', '09', '10', '11', '12', '13', '14',
  '15', '16', '17', '18', '19', '22', '23',
]

function parseArgs(argv) {
  const args = {
    ids: DEFAULT_IDS,
    base: 'https://www.classicalab.cn/audio/',
    out: path.join(process.cwd(), 'audio-index.json'),
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--ids') args.ids = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (flag === '--base') args.base = argv[++i] || args.base
    else if (flag === '--out') args.out = path.resolve(argv[++i] || args.out)
    else throw new Error(`未知参数：${flag}`)
  }
  return args
}

/** 解析 MPEG 音频帧，累计采样数 / 采样率得到精确时长 */
function mp3Duration(buffer) {
  let offset = 0
  if (buffer.toString('latin1', 0, 3) === 'ID3') {
    const size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f)
    offset = 10 + size + (buffer[5] & 0x10 ? 10 : 0) // footer
  }

  const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
  const sampleRates = [44100, 48000, 32000, 0]

  let samples = 0
  let sampleRate = 0
  for (let i = offset; i < buffer.length - 4; ) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) {
      i++
      continue
    }
    const version = (buffer[i + 1] >> 3) & 0x03
    const layer = (buffer[i + 1] >> 1) & 0x03
    if (layer !== 0x01 || version === 0x01) {
      i++
      continue
    }
    const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f
    const sampleRateIndex = (buffer[i + 2] >> 2) & 0x03
    const padding = (buffer[i + 2] >> 1) & 0x01
    if (bitrateIndex === 0 || bitrateIndex === 0x0f || sampleRateIndex === 3) {
      i++
      continue
    }

    const rate = version === 3 ? sampleRates[sampleRateIndex] : version === 2 ? sampleRates[sampleRateIndex] / 2 : sampleRates[sampleRateIndex] / 4
    const samplesPerFrame = version === 3 ? 1152 : 576
    const frameLength = Math.floor(((version === 3 ? 144 : 72) * bitrates[bitrateIndex] * 1000) / rate) + padding

    samples += samplesPerFrame
    sampleRate = rate
    i += frameLength
  }
  return sampleRate ? samples / sampleRate : 0
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const index = {}

  for (const id of args.ids) {
    const url = `${args.base}WEN_${id}_multi_role.mp3`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.log(`WEN_${id}  HTTP ${response.status}（跳过）`)
        continue
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      const durationSeconds = Math.round(mp3Duration(buffer) * 100) / 100
      index[`WEN_${id}`] = {
        audio_file: `WEN_${id}_multi_role.mp3`,
        durationSeconds,
        bytes: buffer.length,
      }
      console.log(`WEN_${id}  ${durationSeconds}s  ${buffer.length} bytes`)
    } catch (error) {
      console.log(`WEN_${id}  请求失败：${error.message}`)
    }
  }

  fs.writeFileSync(args.out, JSON.stringify(index, null, 2) + '\n')
  console.log(`\n已写入 ${args.out}（${Object.keys(index).length} 条）`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
