'use client'

import { useEffect } from 'react'
import { bgm, setBgmVolume, setSfxVolume } from '@/game/audio'
import type { BgmTrackName } from '@/game/audio'
import { useGameStore } from '@/game/store'

// ============ BGM 播放器（无 UI，纯逻辑挂载点） ============
// 订阅 settings.music 开关与当前舞台曲目，联动 BgmEngine：
//   music 开 + track → bgm.play(track)（切曲自带 1.2s crossfade）
//   music 关 / track=null → bgm.stop()（淡出）
// 同时把 settings 中的音量总线（sfx/bgm 各自 0-1）同步进音频引擎
// （存档水合晚于模块初始化时兜底；用户拖滑杆时由 store.setVolume 实时生效）
// 组件卸载时 bgm.stop()

interface BgmPlayerProps {
  track: BgmTrackName | null
}

export function BgmPlayer({ track }: BgmPlayerProps) {
  const musicOn = useGameStore((s) => s.settings.music)
  const sfxVolume = useGameStore((s) => s.settings.sfxVolume)
  const bgmVolume = useGameStore((s) => s.settings.bgmVolume)

  // 音量总线同步（水合兜底；正常改动由 setVolume 直达引擎，此处幂等）
  useEffect(() => {
    setSfxVolume(sfxVolume)
  }, [sfxVolume])
  useEffect(() => {
    setBgmVolume(bgmVolume)
  }, [bgmVolume])

  useEffect(() => {
    bgm.setEnabled(musicOn)
    if (musicOn && track) {
      bgm.play(track)
    } else {
      bgm.stop()
    }
  }, [musicOn, track])

  // 卸载时淡出停止
  useEffect(() => {
    return () => {
      bgm.stop()
    }
  }, [])

  return null
}
