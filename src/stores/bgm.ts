import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useBgmStore = defineStore('bgm', () => {
  // 当前活动的 wenId
  const activeWenId = ref<string>('')
  
  // 当前播放状态
  const isPlaying = ref(false)
  
  // 音量（0-100）
  const volume = ref(20)
  
  // 是否静音
  const isMuted = ref(false)
  
  // BGM文件与wenId的映射关系
  const bgmMapping: Record<string, string> = {
    'WEN_01': 'WEN_01_bgm_guzheng.mp3',
    'WEN_02': 'WEN_02_bgm_guzheng.mp3',
    'WEN_03': 'WEN_03_bgm_guzheng.mp3',
    'WEN_04': 'WEN_04_bgm_guzheng.mp3',
  }
  
  // 根据wenId获取对应的BGM文件名
  const currentBgmFile = computed(() => {
    if (!activeWenId.value) return ''
    return bgmMapping[activeWenId.value] || ''
  })
  
  // 获取所有可用的wenId列表
  const availableWenIds = computed(() => Object.keys(bgmMapping))
  
  // 设置当前活动的wenId
  function setActiveWenId(wenId: string) {
    activeWenId.value = wenId
  }
  
  // 播放背景音乐
  function play() {
    isPlaying.value = true
  }
  
  // 暂停背景音乐
  function pause() {
    isPlaying.value = false
  }
  
  // 切换播放状态
  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }
  
  // 设置音量
  function setVolume(newVolume: number) {
    volume.value = Math.max(0, Math.min(100, newVolume))
    if (isMuted.value && volume.value > 0) {
      isMuted.value = false
    }
  }
  
  // 切换静音
  function toggleMute() {
    isMuted.value = !isMuted.value
  }
  
  // 重置播放状态（用于页面切换时）
  function reset() {
    isPlaying.value = false
  }
  
  return {
    activeWenId,
    isPlaying,
    volume,
    isMuted,
    currentBgmFile,
    availableWenIds,
    bgmMapping,
    setActiveWenId,
    play,
    pause,
    togglePlay,
    setVolume,
    toggleMute,
    reset,
  }
})
