import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getWenId } from '@/utils/wenUtils'
import { getAssetUrl } from '@/utils/asset'

describe('wenUtils', () => {
  describe('getWenId', () => {
    it('should return WEN_xx format for numeric id', () => {
      expect(getWenId('01')).toBe('WEN_01')
      expect(getWenId('12')).toBe('WEN_12')
      expect(getWenId('1')).toBe('WEN_01')
    })

    it('should return original id if already in WEN_xx format', () => {
      expect(getWenId('WEN_01')).toBe('WEN_01')
      expect(getWenId('WEN_12')).toBe('WEN_12')
    })

    it('should handle invalid input', () => {
      expect(getWenId('')).toBe('WEN_01')
      expect(getWenId('abc')).toBe('WEN_01')
    })
  })

  describe('getAssetUrl', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should return correct audio path', () => {
      expect(getAssetUrl('audio/WEN_01_multi_role.mp3')).toBe('/audio/WEN_01_multi_role.mp3')
    })

    it('should return correct video path', () => {
      expect(getAssetUrl('video/WEN_01_rule_1.mp4')).toBe('/video/WEN_01_rule_1.mp4')
    })

    it('should return correct image path', () => {
      expect(getAssetUrl('img/WEN_01_illus_1.png')).toBe('/img/WEN_01_illus_1.png')
    })

    it('should handle leading slashes', () => {
      expect(getAssetUrl('/audio/test.mp3')).toBe('/audio/test.mp3')
    })
  })
})
