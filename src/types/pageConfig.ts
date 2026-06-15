/**
 * 页面配置类型定义
 *
 * 定义页面配置驱动的数据结构和组件类型
 */

/**
 * 支持的块类型
 * - dialog: 对话文本展示（level2_dialog数据）
 * - quiz: 测验题展示（level2_quiz数据）
 * - wordlist: 字词注释
 * - multi-role-reading: 多角色朗读
 * - audio-image-text: 音频图片文本组合
 * - plain-text: 纯文本展示
 * - video: 视频展示
 */
export type BlockType =
  | 'dialogue' // 对话文本（Block模式，question_number为空）
  | 'dialog' // 对话文本（旧版，level2_dialog）
  | 'quiz' // 测验题（Block模式，question_number有值）
  | 'wordlist' // 字词注释
  | 'multi-role-reading' // 多角色朗读
  | 'audio-image-text' // 音频图片文本组合
  | 'plain-text' // 纯文本
  | 'video' // 视频

/**
 * 对话块数据
 */
export interface DialogBlockData {
  textId: string // 课文ID
  dialogIndex?: number // 可选：指定显示的对话索引，不指定则显示所有
}

/**
 * 测验块数据
 */
export interface QuizBlockData {
  textId: string // 课文ID
  quizLevel?: 'level1' | 'level2' | 'level3' // 测验难度级别
  questionNumber?: number // 可选：指定显示的题目编号
}

/**
 * 字词注释块数据
 */
export interface WordListBlockData {
  wenId: string // 课文ID
}

/**
 * 多角色朗读块数据
 */
export interface MultiRoleReadingBlockData {
  wenId: string // 课文ID
  autoPlay?: boolean // 是否自动播放
}

/**
 * 音频图片文本块数据
 */
export interface AudioImageTextBlockData {
  title?: string // 标题
  audioFile?: string // 音频文件
  imageFile?: string // 图片文件
  text?: string // 文本内容
}

/**
 * 纯文本块数据
 */
export interface PlainTextBlockData {
  content: string // 文本内容
}

/**
 * 视频块数据
 */
export interface VideoBlockData {
  src: string // 视频源
  poster?: string // 封面图
  autoPlay?: boolean // 自动播放
  loop?: boolean // 循环播放
}

/**
 * 通用块数据接口
 */
export interface BlockData {
  // 通用的可选属性
  [key: string]: any
}

/**
 * 页面块
 */
export interface PageBlock {
  type: BlockType
  data: BlockData
}

/**
 * 页面配置
 */
export interface PageConfig {
  pageId: string
  title?: string // 页面标题
  blocks: PageBlock[]
}
