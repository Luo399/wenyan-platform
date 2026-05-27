/**
 * 播放控制 Composable
 *
 * 统一的播放状态管理，所有按钮共享同一个状态源
 *
 * 业务规则：
 * - 主按钮切换 → 子按钮跟随
 * - 任一子按钮播放 → 主按钮同步播放
 * - 所有子按钮暂停 → 主按钮暂停
 */
import { ref, type Ref } from 'vue'

export interface UsePlaybackControlOptions {
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (time: number) => void
}

export interface UsePlaybackControlReturn {
  // 状态
  isPlaying: Ref<boolean>

  // 方法
  togglePlay: () => void
  play: () => void
  pause: () => void
  seekTo: (time: number) => void
}

export function usePlaybackControl(
  audioRef: Ref<HTMLAudioElement | null>,
  options: UsePlaybackControlOptions = {},
): UsePlaybackControlReturn {
  // 唯一的播放状态真相来源
  const isPlaying = ref(false)

  /**
   * 切换播放/暂停状态
   */
  function togglePlay() {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * 开始播放
   */
  function play() {
    if (!audioRef.value) return

    audioRef.value.play().catch((err) => {
      console.error('播放失败:', err)
      isPlaying.value = false
    })
    isPlaying.value = true
    options.onPlay?.()
  }

  /**
   * 暂停播放
   */
  function pause() {
    if (!audioRef.value) return

    audioRef.value.pause()
    isPlaying.value = false
    options.onPause?.()
  }

  /**
   * 跳转到指定时间并播放
   * @param time - 目标时间（秒）
   */
  function seekTo(time: number) {
    if (!audioRef.value) return

    audioRef.value.currentTime = time
    options.onSeek?.(time)

    // 如果当前不是播放状态，则开始播放
    if (!isPlaying.value) {
      play()
    }
  }

  return {
    isPlaying,
    togglePlay,
    play,
    pause,
    seekTo,
  }
}
