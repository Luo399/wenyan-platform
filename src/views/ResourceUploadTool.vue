<!--
  ResourceUploadTool.vue - 音视频资源上传工具
  功能：选择篇目 → 选择资源类型 → 拖拽上传 → 自动命名 → 覆盖上传 OSS
  特性：
  - 37 篇古文下拉选择
  - Rule 视频固定 1 个槽位，文化卡片可增删
  - 文件拖拽上传
  - 自动命名预览（文化卡片保留交付原名；命名挂不上引用时在上传前拦下）
  - 上传进度反馈

  命名规则对齐说明（必须与前端消费路径一致）：
  - Rule 视频：{wenId}_rule_bg.{ext} → OSS: video/{fileName}
    → 前端消费: RuleVideoView.vue 拼接 video/{wenId}_rule_{videoKey}.mp4
  - 文化卡片：不改名，用交付时的原始文件名 {wenId}_card_{标识}.{ext}
    - 视频(mp4/webm/ogg)   → OSS: video/{fileName}                // 平铺，不分子目录
    - 图片/封面(png/jpg…) → OSS: images/culture_cards/{wenId}/{fileName}
    → 前端消费: CultureCards.vue 里 image_file 是视频就拼 video/{image_file}，
      是图片就拼 images/culture_cards/{text_id}/{image_file}
    ⚠ JSON 的 image_file 字段存的就是这个文件名，所以工具不能替它重命名。
      旧版会生成 {wenId}_culture_card_{index}.{ext} 并全部塞进 images/culture_cards/，
      和 OSS 上真实存在的对象、以及前端拼路径的两条分支都对不上，传上去就是孤儿素材。
  - 朗读音频：{wenId}_reading.{ext} → OSS: audio/{fileName}
    → 前端消费: MultiRoleReading.vue 从 JSON 的 audio_file 字段读取文件名
  - 字词音频：{wenId}_words.{ext} → OSS: audio/{fileName}
    → 前端消费: WordList.vue 从 JSON 数据中读取

  Figma 插件的命名规则见 figma-plugin/code.ts 的 scanExportAssetsFrame 注释
  后端白名单见 backend/src/controllers/assetController.js 的 ALLOWED_JSON_DIRS / ALLOWED_MEDIA_DIRS
-->
<template>
  <div class="resource-upload-tool">
    <h1 class="tool-title">音视频资源上传工具</h1>

    <!-- 教师工具导航 -->
    <div class="tool-nav">
      <a href="/resource-upload" class="tool-nav-link">音视频资源上传</a>
      <span class="tool-nav-sep">|</span>
      <a href="/answer-query" class="tool-nav-link">学生信息查询</a>
    </div>

    <!-- 未授权提示 -->
    <div v-if="!isAuthorized" class="unauthorized-notice">
      <p>此页面仅限教师和管理员使用。</p>
      <p>请先以教师或管理员身份登录。</p>
      <a href="/teacher-login" class="login-link">前往教师登录</a>
    </div>

    <template v-else>
      <!-- 步骤 1: 选择篇目 -->
      <section class="step-section">
        <label class="step-label">选择篇目</label>
        <select v-model="selectedPoemId" class="article-select" @change="onArticleChange">
          <option value="" disabled>-- 请选择篇目 --</option>
          <option v-for="poem in poemList" :key="poem.poemId" :value="poem.poemId">
            {{ poem.title }} ({{ poem.wenId }})
          </option>
        </select>
      </section>

      <!-- 步骤 2: 选择资源类型 -->
      <section class="step-section">
        <label class="step-label">资源类型</label>
        <div class="type-tabs">
          <button
            v-for="tab in typeTabs"
            :key="tab.key"
            class="type-tab"
            :class="{ active: selectedType === tab.key }"
            @click="selectedType = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
      </section>

      <!-- 步骤 3: 文件槽位列表 -->
      <section class="step-section" v-if="selectedPoemId">
        <label class="step-label">文件槽位</label>
        <p class="slot-hint">拖拽文件到对应槽位，或点击槽位选择文件</p>

        <!-- Rule 视频：固定 1 个槽位 -->
        <div v-if="selectedType === 'rule'" class="slot-list">
          <div class="slot-item">
            <div class="slot-header">
              <span class="slot-name">Rule 视频</span>
              <span class="slot-badge">仅 1 个</span>
            </div>
            <div class="slot-meta">
              挂载路径: <code>video/{{ getRuleVideoName(wenId) }}</code>
            </div>
            <div
              class="drop-zone"
              :class="{ 'has-file': ruleVideoFile, 'is-dragover': dragOverSlot === 'rule' }"
              role="button"
              tabindex="0"
              aria-label="选择 Rule 视频文件"
              @dragover.prevent="dragOverSlot = 'rule'"
              @dragleave.prevent="dragOverSlot = ''"
              @drop.prevent="onDrop($event, 'rule')"
              @click="triggerFileInput('rule')"
              @keydown="onDropZoneKeydown($event, 'rule')"
            >
              <template v-if="ruleVideoFile">
                <span class="file-name">{{ ruleVideoFile.name }}</span>
                <span class="file-size">({{ formatSize(ruleVideoFile.size) }})</span>
                <button class="btn-remove" @click.stop="ruleVideoFile = null" title="移除">
                  ✕
                </button>
              </template>
              <template v-else>
                <span class="drop-icon">📁</span>
                <span class="drop-text">拖拽文件到此处，或点击选择</span>
              </template>
            </div>
          </div>
        </div>

        <!-- 文化卡片：可增删 -->
        <div v-if="selectedType === 'culture'" class="slot-list">
          <div v-for="(slot, index) in cultureCardSlots" :key="slot.id" class="slot-item">
            <div class="slot-header">
              <span class="slot-name">文化卡片 {{ index + 1 }}</span>
              <div class="slot-actions">
                <button class="btn-add" @click="addCultureCardSlot" title="增加文化卡片">＋</button>
                <button
                  v-if="cultureCardSlots.length > 1"
                  class="btn-delete"
                  @click="removeCultureCardSlot(slot.id)"
                  title="删除此卡片"
                >
                  ✕
                </button>
              </div>
            </div>
            <div class="slot-meta">
              挂载路径: <code>{{ getCultureCardPath(cultureCardFiles[slot.id]) }}</code>
            </div>
            <p v-if="getCultureCardWarning(cultureCardFiles[slot.id])" class="slot-warning">
              ⚠ {{ getCultureCardWarning(cultureCardFiles[slot.id]) }}（上传会被拦下）
            </p>
            <div
              class="drop-zone"
              :class="{
                'has-file': cultureCardFiles[slot.id],
                'is-dragover': dragOverSlot === `culture-${slot.id}`,
              }"
              role="button"
              tabindex="0"
              :aria-label="`选择文化卡片 ${index + 1} 文件`"
              @dragover.prevent="dragOverSlot = `culture-${slot.id}`"
              @dragleave.prevent="dragOverSlot = ''"
              @drop.prevent="onDrop($event, `culture-${slot.id}`)"
              @click="triggerFileInput(`culture-${slot.id}`)"
              @keydown="onDropZoneKeydown($event, `culture-${slot.id}`)"
            >
              <template v-if="cultureCardFiles[slot.id]">
                <span class="file-name">{{ cultureCardFiles[slot.id]?.name }}</span>
                <span class="file-size"
                  >({{
                    cultureCardFiles[slot.id] ? formatSize(cultureCardFiles[slot.id]!.size) : ''
                  }})</span
                >
                <button
                  class="btn-remove"
                  @click.stop="cultureCardFiles[slot.id] = null"
                  title="移除"
                >
                  ✕
                </button>
              </template>
              <template v-else>
                <span class="drop-icon">📁</span>
                <span class="drop-text">拖拽文件到此处，或点击选择</span>
              </template>
            </div>
          </div>
        </div>

        <!-- 朗读音频：固定 1 个槽位 -->
        <div v-if="selectedType === 'reading'" class="slot-list">
          <div class="slot-item">
            <div class="slot-header">
              <span class="slot-name">多角色朗读音频</span>
              <span class="slot-badge">仅 1 个</span>
            </div>
            <div class="slot-meta">
              自动命名: <code>{{ getReadingName(wenId, getFileExt(readingFile)) }}</code>
            </div>
            <div
              class="drop-zone"
              :class="{ 'has-file': readingFile, 'is-dragover': dragOverSlot === 'reading' }"
              role="button"
              tabindex="0"
              aria-label="选择多角色朗读音频文件"
              @dragover.prevent="dragOverSlot = 'reading'"
              @dragleave.prevent="dragOverSlot = ''"
              @drop.prevent="onDrop($event, 'reading')"
              @click="triggerFileInput('reading')"
              @keydown="onDropZoneKeydown($event, 'reading')"
            >
              <template v-if="readingFile">
                <span class="file-name">{{ readingFile.name }}</span>
                <span class="file-size">({{ formatSize(readingFile.size) }})</span>
                <button class="btn-remove" @click.stop="readingFile = null" title="移除">✕</button>
              </template>
              <template v-else>
                <span class="drop-icon">📁</span>
                <span class="drop-text">拖拽文件到此处，或点击选择</span>
              </template>
            </div>
          </div>
        </div>

        <!-- 字词音频：固定 1 个槽位 -->
        <div v-if="selectedType === 'words'" class="slot-list">
          <div class="slot-item">
            <div class="slot-header">
              <span class="slot-name">字词注释音频</span>
              <span class="slot-badge">仅 1 个</span>
            </div>
            <div class="slot-meta">
              自动命名: <code>{{ getWordsName(wenId, getFileExt(wordsFile)) }}</code>
            </div>
            <div
              class="drop-zone"
              :class="{ 'has-file': wordsFile, 'is-dragover': dragOverSlot === 'words' }"
              role="button"
              tabindex="0"
              aria-label="选择字词注释音频文件"
              @dragover.prevent="dragOverSlot = 'words'"
              @dragleave.prevent="dragOverSlot = ''"
              @drop.prevent="onDrop($event, 'words')"
              @click="triggerFileInput('words')"
              @keydown="onDropZoneKeydown($event, 'words')"
            >
              <template v-if="wordsFile">
                <span class="file-name">{{ wordsFile.name }}</span>
                <span class="file-size">({{ formatSize(wordsFile.size) }})</span>
                <button class="btn-remove" @click.stop="wordsFile = null" title="移除">✕</button>
              </template>
              <template v-else>
                <span class="drop-icon">📁</span>
                <span class="drop-text">拖拽文件到此处，或点击选择</span>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- 隐藏的 file input -->
      <input
        ref="hiddenInput"
        type="file"
        accept="audio/*,video/*,image/png,image/jpeg,image/gif,image/webp"
        style="display: none"
        @change="onFileInputChange"
      />

      <!-- 上传按钮 -->
      <section class="step-section" v-if="hasFilesToUpload">
        <button class="btn-upload" :disabled="uploading" @click="uploadAll">
          {{ uploading ? '上传中...' : `上传所有文件 (${uploadCount} 个)` }}
        </button>
      </section>

      <!-- 上传日志 -->
      <section class="step-section" v-if="uploadLogs.length > 0">
        <label class="step-label">上传日志</label>
        <div class="upload-log">
          <div v-for="(log, index) in uploadLogs" :key="index" class="log-item" :class="log.status">
            <span class="log-icon">{{
              log.status === 'success' ? '✓' : log.status === 'error' ? '✕' : '⟳'
            }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getAllPoemSlots, getWenId } from '@/utils/wenUtils'
import { upload } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'

// ============ 类型定义 ============
interface UploadLog {
  status: 'pending' | 'success' | 'error'
  message: string
}

interface CultureSlot {
  id: number
}

// ============ 数据 ============
const authStore = useAuthStore()
const userRole = computed(() => authStore.user?.role)
// 路由 meta.role 已放开 super_admin（其权限含 admin），页面内授权判断必须与其对齐，
// 否则会出现"能进页面但整页显示未授权"的割裂状态。
const isAuthorized = computed(
  () =>
    userRole.value === 'teacher' ||
    userRole.value === 'admin' ||
    userRole.value === 'super_admin',
)

// 上传工具要能选到全部号位（含编号未确认的 20/21/23/28–37）：
// 美术是按号交付的，这里只做「把文件挂到这个号上」，不判断该号对应哪篇课文。
const poemList = getAllPoemSlots()
const selectedPoemId = ref('')
const selectedType = ref<ResourceType>('rule')
const dragOverSlot = ref('')
const hiddenInput = ref<HTMLInputElement | null>(null)
const pendingSlotKey = ref('') // 当前等待文件选择的槽位 key

// Rule 视频
const ruleVideoFile = ref<File | null>(null)

// 文化卡片
const cultureCardSlots = ref<CultureSlot[]>([{ id: 1 }])
const cultureCardFiles = ref<Record<number, File | null>>({})
let nextSlotId = 2

// 朗读音频
const readingFile = ref<File | null>(null)

// 字词音频
const wordsFile = ref<File | null>(null)

// 上传状态
const uploading = ref(false)
const uploadLogs = ref<UploadLog[]>([])

// ============ 计算属性 ============
const wenId = computed(() => {
  if (!selectedPoemId.value) return ''
  return getWenId(selectedPoemId.value)
})

type ResourceType = 'rule' | 'culture' | 'reading' | 'words'

const typeTabs: { key: ResourceType; label: string }[] = [
  { key: 'rule', label: 'Rule 视频' },
  { key: 'culture', label: '文化卡片' },
  { key: 'reading', label: '朗读音频' },
  { key: 'words', label: '字词音频' },
]

const hasFilesToUpload = computed(() => {
  if (selectedType.value === 'rule') return !!ruleVideoFile.value
  if (selectedType.value === 'culture')
    return Object.values(cultureCardFiles.value).some((f) => !!f)
  if (selectedType.value === 'reading') return !!readingFile.value
  if (selectedType.value === 'words') return !!wordsFile.value
  return false
})

const uploadCount = computed(() => {
  if (selectedType.value === 'rule') return ruleVideoFile.value ? 1 : 0
  if (selectedType.value === 'culture')
    return Object.values(cultureCardFiles.value).filter((f) => !!f).length
  if (selectedType.value === 'reading') return readingFile.value ? 1 : 0
  if (selectedType.value === 'words') return wordsFile.value ? 1 : 0
  return 0
})

// ============ 命名规则 ============
// 卡片视频平铺在 OSS 的 video/ 下，只有图片和封面进 images/culture_cards/{wenId}/。
// 两边口径来自 CultureCards.vue 的拼路径分支，改这里前先确认那边没变。
const CARD_VIDEO_EXTS = ['mp4', 'webm', 'ogg']
const CARD_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const CARD_ALLOWED_EXTS = [...CARD_VIDEO_EXTS, ...CARD_IMAGE_EXTS]

function getFileExt(file: File | null | undefined): string {
  if (!file) return 'mp4' // 默认扩展名
  return extOf(file.name) || 'mp4'
}

function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return ''
  return fileName.substring(dot + 1).toLowerCase()
}

function isCardVideo(fileName: string): boolean {
  return CARD_VIDEO_EXTS.includes(extOf(fileName))
}

function getRuleVideoName(wenId: string): string {
  return `${wenId}_rule_bg.${getFileExt(ruleVideoFile.value) || 'mp4'}`
}

// 文化卡片不改名：JSON 的 image_file 存的就是交付文件名，改名等于把引用作废。
function getCultureCardName(wenId: string, file: File | null | undefined): string {
  return file?.name || `${wenId}_card_标识.mp4`
}

function getReadingName(wenId: string, ext: string): string {
  return `${wenId}_reading.${ext || 'mp3'}`
}

function getWordsName(wenId: string, ext: string): string {
  return `${wenId}_words.${ext || 'mp3'}`
}

function getOssPath(type: string, wenId: string, fileName: string): string {
  switch (type) {
    case 'rule':
      return `video/${fileName}`
    case 'culture':
      return isCardVideo(fileName)
        ? `video/${fileName}`
        : `images/culture_cards/${wenId}/${fileName}`
    case 'reading':
      return `audio/${fileName}`
    case 'words':
      return `audio/${fileName}`
    default:
      return `video/${fileName}`
  }
}

// ============ 上传前自检 ============
// 后端只校验目录白名单，不查名字是否被 JSON 引用、也不查重名覆盖，
// 所以名字挂不上引用时必须在这里拦下——传错的直接后果是 OSS 里多一个没人引用的文件。
function validateAssetName(type: ResourceType, wenId: string, fileName: string): string {
  if (!wenId) return '未选择篇目'
  if (!fileName) return '文件名为空'
  if (/\s/.test(fileName)) return '文件名含空格'
  if (!/^[\x21-\x7E]+$/.test(fileName)) return '文件名含中文或非 ASCII 字符'

  const ext = extOf(fileName)
  if (!ext) return '文件没有扩展名'
  if (fileName.indexOf('.') !== fileName.lastIndexOf('.')) {
    return '文件名有多个点，疑似双扩展名；OSS 对象名必须和 JSON 引用的名字完全一致'
  }

  // 号位必须落在当前选中的课文上，否则传到 OSS 上也是别的篇目引用不到的孤儿
  const stem = fileName.substring(0, fileName.lastIndexOf('.'))
  if (!stem.startsWith(`${wenId}_`)) return `文件名前缀不是 ${wenId}，与所选篇目不符`

  if (type === 'culture') {
    if (!stem.startsWith(`${wenId}_card_`)) return '文化卡片文件名要形如 {wenId}_card_标识.扩展名'
    if (!CARD_VIDEO_EXTS.includes(ext) && !CARD_IMAGE_EXTS.includes(ext)) {
      return `文化卡片扩展名 .${ext} 前端不认，可用：${CARD_ALLOWED_EXTS.join('/')}`
    }
  } else if (type === 'rule') {
    if (!CARD_VIDEO_EXTS.includes(ext)) return `Rule 视频扩展名 .${ext} 前端不认`
    if (stem !== `${wenId}_rule_bg`) {
      return `Rule 视频要叫 ${wenId}_rule_bg.{ext}，前端按这个名字拼路径`
    }
  }

  return ''
}

function getCultureCardPath(file: File | null | undefined): string {
  return getOssPath('culture', wenId.value, getCultureCardName(wenId.value, file))
}

function getCultureCardWarning(file: File | null | undefined): string {
  if (!file) return ''
  return validateAssetName('culture', wenId.value, file.name)
}

// ============ 文化卡片增删 ============
function addCultureCardSlot() {
  const newSlot: CultureSlot = { id: nextSlotId++ }
  cultureCardSlots.value.push(newSlot)
}

function removeCultureCardSlot(id: number) {
  const idx = cultureCardSlots.value.findIndex((s) => s.id === id)
  if (idx !== -1) {
    cultureCardSlots.value.splice(idx, 1)
    delete cultureCardFiles.value[id]
  }
}

// ============ 文件拖拽/选择 ============
function triggerFileInput(slotKey: string) {
  pendingSlotKey.value = slotKey
  hiddenInput.value?.click()
}

/**
 * 拖拽区的键盘等价操作：Enter / Space 等同于点击选择文件。
 * 只在事件源就是拖拽区本身时响应，避免区内的"移除"按钮按键时又弹出文件选择框。
 */
function onDropZoneKeydown(event: KeyboardEvent, slotKey: string) {
  if (event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  triggerFileInput(slotKey)
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !pendingSlotKey.value) return

  assignFileToSlot(pendingSlotKey.value, file)
  pendingSlotKey.value = ''
  input.value = '' // 重置，允许重复选择同一文件
}

function onDrop(event: DragEvent, slotKey: string) {
  dragOverSlot.value = ''
  const file = event.dataTransfer?.files?.[0]
  if (!file) return

  assignFileToSlot(slotKey, file)
}

function assignFileToSlot(slotKey: string, file: File) {
  if (slotKey === 'rule') {
    ruleVideoFile.value = file
  } else if (slotKey.startsWith('culture-')) {
    const idStr = slotKey.split('-')[1]
    if (idStr) {
      const id = parseInt(idStr, 10)
      cultureCardFiles.value = { ...cultureCardFiles.value, [id]: file }
    }
  } else if (slotKey === 'reading') {
    readingFile.value = file
  } else if (slotKey === 'words') {
    wordsFile.value = file
  }
}

// ============ 上传 ============
async function uploadAll() {
  if (uploading.value) return
  uploading.value = true
  uploadLogs.value = []

  try {
    const files = collectFiles()
    let blocked = 0
    for (const { file, ossPath, wenId: wId } of files) {
      const fileName = ossPath.split('/').pop() || file.name
      const error = validateAssetName(selectedType.value, wId, fileName)
      if (error) {
        blocked++
        uploadLogs.value.push({
          status: 'error',
          message: `⛔ ${fileName} 已拦下，未上传：${error}`,
        })
        continue
      }
      // 串行队列：单项失败/超时只影响这一项，后面的文件继续传
      try {
        await uploadSingle(file, ossPath, wId)
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        uploadLogs.value.push({
          status: 'error',
          message: `✕ ${fileName} 上传异常: ${errorMsg}`,
        })
      }
    }
    if (blocked > 0) {
      uploadLogs.value.push({
        status: 'error',
        message: `${blocked} 个文件没上传：OSS 对象名要和 JSON 里的引用一模一样，改好文件名再拖进来`,
      })
    }
  } finally {
    // 无论队列中途出什么错，按钮都不能一直停在"上传中"
    uploading.value = false
  }
}

function collectFiles(): Array<{ file: File; ossPath: string; wenId: string }> {
  const result: Array<{ file: File; ossPath: string; wenId: string }> = []
  const wId = wenId.value

  if (selectedType.value === 'rule' && ruleVideoFile.value) {
    result.push({
      file: ruleVideoFile.value,
      ossPath: getOssPath('rule', wId, getRuleVideoName(wId)),
      wenId: wId,
    })
  }

  if (selectedType.value === 'culture') {
    cultureCardSlots.value.forEach((slot) => {
      const file = cultureCardFiles.value[slot.id]
      if (!file) return
      const fileName = getCultureCardName(wId, file)
      result.push({
        file,
        ossPath: getOssPath('culture', wId, fileName),
        wenId: wId,
      })
    })
  }

  if (selectedType.value === 'reading' && readingFile.value) {
    result.push({
      file: readingFile.value,
      ossPath: getOssPath('reading', wId, getReadingName(wId, getFileExt(readingFile.value))),
      wenId: wId,
    })
  }

  if (selectedType.value === 'words' && wordsFile.value) {
    result.push({
      file: wordsFile.value,
      ossPath: getOssPath('words', wId, getWordsName(wId, getFileExt(wordsFile.value))),
      wenId: wId,
    })
  }

  return result
}

async function uploadSingle(file: File, ossPath: string, wenId: string) {
  const fileName = ossPath.split('/').pop() || file.name
  // 先占位，结束后原地改写状态：一个文件只占一行日志，失败/超时也能看出是哪一项
  const logIndex = uploadLogs.value.length
  uploadLogs.value.push({ status: 'pending', message: `正在上传: ${fileName}` })

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('ossPath', ossPath)
    formData.append('wenId', wenId)

    // 走 utils/api.upload()，自动注入 Authorization 头（60s 超时）
    const result = await upload('/api/upload/resource', formData)

    if (result.success) {
      uploadLogs.value[logIndex] = { status: 'success', message: `✓ ${fileName} 上传成功` }
    } else {
      uploadLogs.value[logIndex] = {
        status: 'error',
        message: `✕ ${fileName} 上传失败: ${result.message || '未知错误'}`,
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : '未知错误'
    uploadLogs.value[logIndex] = {
      status: 'error',
      message: `✕ ${fileName} 上传异常: ${errorMsg}`,
    }
  }
}

// ============ 工具函数 ============
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onArticleChange() {
  // 切换篇目时清空已选文件
  ruleVideoFile.value = null
  cultureCardFiles.value = {}
  readingFile.value = null
  wordsFile.value = null
  uploadLogs.value = []
}
</script>

<style scoped>
.resource-upload-tool {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.tool-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
}

/* 教师工具导航 */
.tool-nav {
  text-align: center;
  margin-bottom: 20px;
  padding: 8px 0;
  border-bottom: 1px solid #e0e0e0;
}

.tool-nav-link {
  color: #4a90d9;
  text-decoration: none;
  font-size: 14px;
  padding: 4px 8px;
  transition: color 0.2s;
}

.tool-nav-link:hover {
  color: #357abd;
  text-decoration: underline;
}

.tool-nav-sep {
  color: #ccc;
  margin: 0 8px;
  font-size: 14px;
}

/* 未授权提示 */
.unauthorized-notice {
  text-align: center;
  padding: 60px 20px;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  color: #8c6e00;
  font-size: 16px;
  line-height: 2;
}

.unauthorized-notice .login-link {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 24px;
  background: #4a90d9;
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
  font-size: 14px;
}

.unauthorized-notice .login-link:hover {
  background: #357abd;
}

/* 步骤区域 */
.step-section {
  margin-bottom: 20px;
}

.step-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.slot-hint {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
}

/* 篇目选择器 */
.article-select {
  width: 100%;
  padding: 10px 12px;
  font-size: 15px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: #fff;
  color: #333;
  cursor: pointer;
  appearance: auto;
}

.article-select:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
}

/* 类型标签 */
.type-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.type-tab {
  padding: 8px 16px;
  font-size: 14px;
  border: 1px solid #d0d0d0;
  border-radius: 20px;
  background: #f5f5f5;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
}

.type-tab:hover {
  background: #e8e8e8;
}

.type-tab.active {
  background: #4a90d9;
  color: #fff;
  border-color: #4a90d9;
}

/* 文件槽位列表 */
.slot-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.slot-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.slot-badge {
  font-size: 11px;
  color: #888;
  background: #eee;
  padding: 2px 8px;
  border-radius: 10px;
}

.slot-actions {
  display: flex;
  gap: 4px;
}

.btn-add,
.btn-delete {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-add {
  background: #52c41a;
  color: #fff;
}

.btn-add:hover {
  background: #45a818;
}

.btn-delete {
  background: #ff4d4f;
  color: #fff;
}

.btn-delete:hover {
  background: #e04345;
}

.slot-meta {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.slot-meta code {
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #4a90d9;
}

.slot-warning {
  margin: -4px 0 8px;
  font-size: 12px;
  color: #c0392b;
}

/* 拖拽区域 */
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.drop-zone:hover {
  border-color: #4a90d9;
  background: #f0f7ff;
}

/* 键盘聚焦时给出可见焦点环（拖拽区已支持 tabindex 操作） */
.drop-zone:focus-visible {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
}

.drop-zone.is-dragover {
  border-color: #4a90d9;
  background: #e6f0ff;
}

.drop-zone.has-file {
  border-style: solid;
  border-color: #52c41a;
  background: #f6ffed;
}

.drop-icon {
  font-size: 24px;
}

.drop-text {
  font-size: 13px;
  color: #999;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: #888;
}

.btn-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: #ff4d4f;
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  background: #e04345;
}

/* 上传按钮 */
.btn-upload {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  background: #4a90d9;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover:not(:disabled) {
  background: #357abd;
}

.btn-upload:disabled {
  background: #b0c4de;
  cursor: not-allowed;
}

/* 上传日志 */
.upload-log {
  background: #1a1a1a;
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
}

.log-item {
  padding: 4px 0;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.log-item.pending {
  color: #aaa;
}

.log-item.success {
  color: #52c41a;
}

.log-item.error {
  color: #ff4d4f;
}

.log-icon {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.log-message {
  word-break: break-all;
}
</style>
