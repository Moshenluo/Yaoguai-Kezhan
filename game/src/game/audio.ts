'use client'

// ============ 妖怪客栈 · Web Audio 合成音效 + BGM 系统 ============
// 零素材：全部用 AudioContext 振荡器/噪声实时合成，国风五声音阶为基调
// 使用：import { sfx, bgm, setSfxVolume, setBgmVolume } from '@/game/audio'
//   sfx.play('coin') —— 16 种音效（API 与历史版本完全一致）
//   bgm.play('day' | 'night' | 'boss') —— 合成 BGM（lookahead 调度 + 1.2s crossfade）
//   setSfxVolume(v) / setBgmVolume(v) —— 独立音量总线（0-1）
// 开关：settings.sound → sfx.setEnabled / settings.music → bgm.setEnabled（由 UI 层联动）
// 音量：settings.sfxVolume / bgmVolume → setSfxVolume / setBgmVolume（设置面板滑杆联动）
// sfx 与 bgm 共用同一 AudioContext 与手势解锁（首次 pointerdown/keydown）

type SfxName =
  | 'click'
  | 'coin'
  | 'upgrade'
  | 'levelup'
  | 'captureSuccess'
  | 'captureFail'
  | 'captureWindow'
  | 'victory'
  | 'failed'
  | 'skill'
  | 'kill'
  | 'recruit'
  | 'release'
  | 'innHit'
  | 'place'
  | 'claim'

/** 音量总控（0-1，sfx 与 bgm 共用的主输出） */
const MASTER_VOLUME = 0.5

// ============ 音量状态（sfx / bgm 独立总线音量，0-1；由 store.settings 联动） ============
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.8))
}
let sfxVolume = 0.8
let bgmVolume = 0.8

/** 设置音效总线音量（0-1）；总线未创建时先存值，创建时自动生效 */
export function setSfxVolume(v: number) {
  sfxVolume = clamp01(v)
  const s = sharedAudio
  if (s) s.sfxBus.gain.setTargetAtTime(sfxVolume, s.ctx.currentTime, 0.04)
}

/** 设置音乐总线音量（0-1，合成曲与 MP3 曲同步受控） */
export function setBgmVolume(v: number) {
  bgmVolume = clamp01(v)
  const s = sharedAudio
  if (s) s.bgmBus.gain.setTargetAtTime(bgmVolume, s.ctx.currentTime, 0.04)
}

/** 上次同名音效触发时间（节流用） */
const lastPlay = new Map<SfxName, number>()

/** 节流间隔（ms）——战斗高频音效防止爆音 */
const THROTTLE: Partial<Record<SfxName, number>> = {
  skill: 350,
  kill: 120,
  innHit: 200,
  coin: 400,
}

// ============ 共享 AudioContext（sfx 与 bgm 统一管理） ============

interface SharedAudio {
  ctx: AudioContext
  master: GainNode
  /** 音效独立总线（音量 = sfxVolume，串在 master 之下） */
  sfxBus: GainNode
  /** 音乐独立总线（音量 = bgmVolume，合成曲/回声/MP3 全部挂在这条链上） */
  bgmBus: GainNode
}

let sharedAudio: SharedAudio | null = null
let audioUnlocked = false
const unlockCallbacks: Array<() => void> = []

/** 懒创建全局唯一 AudioContext 与主输出（浏览器不支持时返回 null） */
function getSharedAudio(): SharedAudio | null {
  if (typeof window === 'undefined') return null
  if (!sharedAudio) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    const ctx = new AC()
    const master = ctx.createGain()
    master.gain.value = MASTER_VOLUME
    master.connect(ctx.destination)
    const sfxBus = ctx.createGain()
    sfxBus.gain.value = sfxVolume
    sfxBus.connect(master)
    const bgmBus = ctx.createGain()
    bgmBus.gain.value = bgmVolume
    bgmBus.connect(master)
    sharedAudio = { ctx, master, sfxBus, bgmBus }
  }
  return sharedAudio
}

/** 注册「音频已解锁」回调（已解锁则立即执行） */
function onAudioUnlocked(cb: () => void): void {
  if (audioUnlocked) {
    cb()
    return
  }
  unlockCallbacks.push(cb)
}

// 首次用户手势统一解锁（sfx 与 bgm 共用一套监听，避免重复注册冲突）
if (typeof window !== 'undefined') {
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
    const s = getSharedAudio()
    if (s && s.ctx.state !== 'running') void s.ctx.resume().catch(() => undefined)
    if (audioUnlocked) return
    audioUnlocked = true
    const cbs = unlockCallbacks.splice(0, unlockCallbacks.length)
    for (const cb of cbs) cb()
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

// ============ 音效引擎（对外 API 与旧版完全一致） ============

class SfxEngine {
  private enabled = true

  constructor() {
    if (typeof window !== 'undefined') {
      // 从 localStorage 同步开关（与 store.settings.sound 一致）
      this.syncSetting()
    }
  }

  /** 读取存档中的音效开关与音量 */
  syncSetting() {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('yaoguai-inn-save-v1')
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state?: { settings?: { sound?: boolean; sfxVolume?: number } }
        }
        this.enabled = parsed.state?.settings?.sound !== false
        if (typeof parsed.state?.settings?.sfxVolume === 'number') {
          setSfxVolume(parsed.state.settings.sfxVolume)
        }
      }
    } catch {
      this.enabled = true
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on
  }

  // ---------- 基础合成原语 ----------

  /** 单音：type 波形，f0→f1 频率滑动，dur 时长，vol 相对音量 */
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const s = getSharedAudio()
    if (!s) return
    const t = s.ctx.currentTime + delay
    const osc = s.ctx.createOscillator()
    const gain = s.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol, t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(gain).connect(s.sfxBus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  /** 噪声脉冲（打击感） */
  private noise(dur: number, vol: number, delay = 0, highpass = 800) {
    const s = getSharedAudio()
    if (!s) return
    const t = s.ctx.currentTime + delay
    const len = Math.max(1, Math.floor(s.ctx.sampleRate * dur))
    const buffer = s.ctx.createBuffer(1, len, s.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len) // 线性衰减
    }
    const src = s.ctx.createBufferSource()
    src.buffer = buffer
    const filter = s.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = highpass
    const gain = s.ctx.createGain()
    gain.gain.value = vol
    src.connect(filter).connect(gain).connect(s.sfxBus)
    src.start(t)
  }

  // ---------- 对外音效 ----------

  play(name: SfxName) {
    if (!this.enabled) return
    // 节流
    const throttle = THROTTLE[name]
    if (throttle) {
      const now = performance.now()
      const last = lastPlay.get(name) ?? 0
      if (now - last < throttle) return
      lastPlay.set(name, now)
    }
    const s = getSharedAudio()
    if (!s) return
    if (s.ctx.state === 'suspended') void s.ctx.resume()

    switch (name) {
      case 'click':
        // 轻点：短促木鱼感（三角波下滑）
        this.tone('triangle', 660, 440, 0.08, 0.25)
        break
      case 'coin':
        // 金币叮当：双音上行（C6→E6，宫→角）——V1.2.1 三角波柔化降刺耳度
        this.tone('triangle', 1046, 1046, 0.07, 0.075)
        this.tone('triangle', 1318, 1318, 0.09, 0.065, 0.06)
        break
      case 'upgrade':
        // 设施升级：三连上行（宫商角）
        this.tone('triangle', 523, 523, 0.09, 0.2)
        this.tone('triangle', 587, 587, 0.09, 0.2, 0.08)
        this.tone('triangle', 659, 659, 0.14, 0.22, 0.16)
        break
      case 'levelup':
        // 客栈升级：华丽五声音阶琶音（C D E G A）
        ;[523, 587, 659, 784, 880].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.2, i * 0.07))
        this.tone('sine', 1046, 1046, 0.3, 0.16, 0.35)
        break
      case 'captureWindow':
        // 精英怪进入捕捉窗口：神秘双音提示（合弦）
        this.tone('sine', 880, 880, 0.16, 0.16)
        this.tone('sine', 1174, 1174, 0.22, 0.14, 0.05)
        break
      case 'captureSuccess':
        // 收服成功：胜利五声琶音+闪亮尾音
        ;[659, 784, 880, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.22, i * 0.08))
        this.tone('sine', 2093, 2093, 0.4, 0.1, 0.4)
        this.noise(0.3, 0.06, 0.05, 3000)
        break
      case 'captureFail':
        // 收服失败：下行小二度（遗憾感）
        this.tone('triangle', 494, 440, 0.16, 0.2)
        this.tone('triangle', 440, 392, 0.2, 0.18, 0.12)
        break
      case 'victory':
        // 守店成功：大三和弦辉煌琶音
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.24, i * 0.1))
        ;[523, 659, 784, 1046].forEach((f, i) => this.tone('sine', f, f, 0.4, 0.1, 0.42 + i * 0.1))
        break
      case 'failed':
        // 失败：低沉下行（宫→羽→征）
        this.tone('triangle', 392, 392, 0.2, 0.22)
        this.tone('triangle', 330, 330, 0.22, 0.2, 0.18)
        this.tone('triangle', 262, 262, 0.5, 0.2, 0.38)
        break
      case 'skill':
        // 技能施放：嗖（锯齿波快速上滑+气声）
        this.tone('sawtooth', 300, 900, 0.16, 0.1)
        this.noise(0.14, 0.08, 0, 1200)
        break
      case 'kill':
        // 击杀：噗+金币轻响
        this.noise(0.1, 0.12, 0, 600)
        this.tone('sine', 784, 1046, 0.08, 0.1, 0.02)
        break
      case 'recruit':
        // 招募：抽卡揭示感（刮+亮音）
        this.tone('sine', 440, 880, 0.2, 0.12)
        this.tone('triangle', 1046, 1318, 0.16, 0.16, 0.18)
        break
      case 'release':
        // 放归：轻轻的上扬告别
        this.tone('sine', 587, 880, 0.24, 0.14)
        break
      case 'innHit':
        // 客栈受击：闷响+木震
        this.tone('sine', 120, 60, 0.18, 0.3)
        this.noise(0.12, 0.1, 0, 300)
        break
      case 'place':
        // 布阵放置：笃（落子感）
        this.tone('sine', 330, 220, 0.1, 0.22)
        this.noise(0.05, 0.08, 0, 1500)
        break
      case 'claim':
        // 领奖：欢快双音
        this.tone('triangle', 784, 784, 0.1, 0.2)
        this.tone('triangle', 1046, 1046, 0.14, 0.2, 0.09)
        break
    }
  }
}

// ============ BGM 引擎（真实 MP3 曲目优先 + 合成曲兜底） ============
// day / night / night2 三舞台接入真实 MP3 素材（末深落曲集）：
//   day   「妖怪茶水间」—— 主界面/白天经营
//   night 「夜袭客栈」  —— 区域一（客栈山道）夜战
//   night2「水墨藏锋」  —— 区域二（水墨幽谷）夜战
// boss（妖王夜）保留纯合成压迫感曲目；night3（区域三沸火赤川）为纯合成火热曲目；
// MP3 加载失败自动回退同名合成曲。

export type BgmTrackName = 'day' | 'night' | 'boss' | 'night2' | 'night3'

interface BgmNote {
  /** MIDI 音高；0 = 休止；perc 层：1 = 底鼓、2 = 轻拍 */
  n: number
  /** 时值（拍） */
  d: number
  /** 力度（默认 1；装饰音 0.6、重音 1.1-1.15） */
  v?: number
}

type BgmLayerKind = 'melody' | 'bass' | 'harmony' | 'drone' | 'perc'

interface BgmLayer {
  kind: BgmLayerKind
  /** 音色（perc 层忽略） */
  wave: OscillatorType
  /** 声部音量（各层叠加后整体约 0.05-0.1，安静垫底不干扰音效） */
  gain: number
  /** 低通截止频率（Hz，可选：暗化音色） */
  lowpass?: number
  /** 五度和音倍增（harmony 层生效：根音 + 纯五度） */
  fifth?: boolean
  /** 音符序列（同一曲目内各层总拍数一致，循环同步） */
  notes: BgmNote[]
}

interface BgmTrackDef {
  bpm: number
  layers: BgmLayer[]
}

// ---------- 音符速记 ----------
const N = (n: number, d: number, v?: number): BgmNote => ({ n, d, v })
const R = (d: number): BgmNote => ({ n: 0, d })

/** 整段重复（保证各声部循环长度对齐） */
function rep(notes: BgmNote[], times: number): BgmNote[] {
  const out: BgmNote[] = []
  for (let i = 0; i < times; i++) out.push(...notes)
  return out
}

/** MIDI → 频率 */
function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

const SEMITONE_RATIO = Math.pow(2, 1 / 12)

// ---------- 曲目一：白天 · 轻松经营（宫调式 C D E G A，BPM 80） ----------
// 16 小节起承转合：低音 C/Am/G/C 循环，主旋律轻快级进 + 三度跳进，五度和音稀疏点缀

const DAY_MELODY: BgmNote[] = [
  // 起（1-4）：宫调上行问句
  N(60, 1, 0.9), N(64, 1), N(67, 1), N(69, 1),
  N(67, 1.5), N(64, 0.5), N(67, 2),
  N(69, 1), N(67, 1), N(64, 1), N(62, 1),
  N(60, 3, 0.85), R(1),
  // 承（5-8）：抬到高八度呼应
  N(64, 1), N(67, 1), N(72, 1), N(74, 1),
  N(76, 1.5), N(74, 0.5), N(72, 2),
  N(69, 1), N(72, 1), N(74, 1), N(72, 1),
  N(69, 2), N(67, 2),
  // 转（9-12）：高音区流连（全曲高点）
  N(79, 1, 1.15), N(76, 1), N(74, 1), N(76, 1),
  N(79, 1.5, 1.15), N(76, 0.5), N(74, 1), N(72, 1),
  N(74, 1), N(79, 1, 1.1), N(76, 1), N(74, 1),
  N(72, 1), N(69, 1), N(67, 2),
  // 合（13-16）：回落收束，长音归宫
  N(64, 1), N(67, 1), N(69, 1), N(72, 1),
  N(74, 1.5), N(72, 0.5), N(69, 2),
  N(67, 1), N(64, 1), N(62, 1), N(64, 1),
  N(60, 4, 0.8),
]

const DAY_BASS: BgmNote[] = rep(
  [
    N(48, 2), N(55, 2), // C3 G3（宫-征）
    N(45, 2), N(52, 2), // A2 E3（羽-角）
    N(43, 2), N(50, 2), // G2 D3（征-商）
    N(48, 2), N(43, 1), N(48, 1), // 归宫
  ],
  4,
)

const DAY_HARMONY: BgmNote[] = [
  // 1-4 小节：A4(附 A-E) 落 Am、D5(附 D-A) 落 G
  R(6), N(69, 1, 0.9), R(1), N(74, 1, 0.9), R(7),
  // 5-8 小节：C5(附 C-G) 开 Am7 色、G4(附 G-D) 落 G
  R(4), N(72, 1, 0.9), R(3), N(67, 1, 0.9), R(7),
  // 9-12 小节：C5 落 C、D5 落 G
  N(72, 1, 0.85), R(7), N(74, 1, 0.85), R(7),
  // 13-16 小节：G4 落 G、C5 归宫
  R(4), N(67, 1, 0.9), R(7), N(72, 1, 0.85), R(3),
]

const DAY_TRACK: BgmTrackDef = {
  bpm: 80,
  layers: [
    { kind: 'melody', wave: 'triangle', gain: 0.082, notes: DAY_MELODY },
    { kind: 'bass', wave: 'sine', gain: 0.088, notes: DAY_BASS },
    { kind: 'harmony', wave: 'sine', gain: 0.033, fifth: true, notes: DAY_HARMONY },
  ],
}

// ---------- 曲目二：夜晚 · 紧张守店（羽调式 A C D E G，BPM 96） ----------
// 低音更沉（A2/G2/E2/D2），旋律徘徊下行叹息 + 上方倚音装饰，噪声轻拍打底

const NIGHT_MELODY: BgmNote[] = [
  // 起（1-4）：羽调徘徊，长音后下行叹息
  N(69, 2), N(72, 1), N(74, 1),
  N(76, 1.5), N(74, 0.5), N(72, 1), N(69, 1),
  N(74, 0.12, 0.6), N(72, 0.88), N(69, 1), N(67, 1), N(69, 1),
  N(69, 2.5), R(1.5),
  // 承（5-8）：推向 E/G 高区
  N(72, 1), N(74, 1), N(76, 2),
  N(79, 1.5), N(76, 0.5), N(74, 1), N(76, 1),
  N(76, 0.12, 0.6), N(74, 0.88), N(72, 1), N(74, 1), N(72, 1),
  N(69, 2), N(67, 2),
  // 转（9-12）：A5 高区紧绷，短促呼吸
  N(81, 1.5, 1.1), N(79, 0.5), N(76, 1), N(79, 1),
  N(81, 1, 1.1), N(79, 1), N(76, 1), N(74, 1),
  N(72, 0.12, 0.6), N(74, 0.88), N(76, 1), N(79, 1), N(76, 1),
  N(74, 2), N(72, 1), N(74, 1),
  // 合（13-16）：逐步回落，长羽收束
  N(76, 0.12, 0.6), N(74, 0.88), N(72, 1), N(69, 1), N(67, 1),
  N(69, 1), N(72, 1), N(74, 1), N(72, 1),
  N(69, 1), N(67, 1), N(64, 1), N(67, 1),
  N(69, 3), R(1),
]

const NIGHT_BASS: BgmNote[] = rep(
  [
    N(45, 1), R(1), N(45, 1), R(1), // A2
    N(45, 1), R(1), N(43, 1), R(1), // A2 → G2
    N(40, 1), R(1), N(40, 1), R(1), // E2
    N(38, 1), R(1), N(40, 1), N(43, 1), // D2 → E2 → G2
  ],
  4,
)

const NIGHT_PERC: BgmNote[] = rep(
  [
    N(1, 0.5), R(1.5), N(2, 0.5), R(0.5), N(2, 0.5), R(0.5),
    N(1, 0.5), R(1), N(2, 0.5), N(1, 0.5, 0.7), N(2, 0.5), R(1),
  ],
  8,
)

const NIGHT_TRACK: BgmTrackDef = {
  bpm: 96,
  layers: [
    { kind: 'melody', wave: 'triangle', gain: 0.075, lowpass: 2400, notes: NIGHT_MELODY },
    { kind: 'bass', wave: 'sine', gain: 0.1, notes: NIGHT_BASS },
    { kind: 'perc', wave: 'sine', gain: 0.07, notes: NIGHT_PERC },
  ],
}

// ---------- 曲目三：妖王夜 · 压迫感（A 弗里几亚色彩，BPM 112） ----------
// 旋律以小二度倚音（Bb→A、E→F）营造不谐和威压；低音 A2 持续锤击 + Bb2 擦撞；
// 长音簇（A2+Bb2 小二度双音）缓缓起伏；打击更密

const BOSS_MELODY: BgmNote[] = [
  // 起（1-4）：小二度震音开场
  N(69, 1), N(69, 1), N(70, 1), N(69, 1),
  N(72, 1.5), N(70, 0.5), N(69, 2),
  N(69, 0.5), N(67, 0.5), N(69, 1), N(72, 1), N(70, 1),
  N(69, 2), R(2),
  // 承（5-8）：E-F 小二度摩擦 + 减五度下坠
  N(76, 1), N(77, 1), N(76, 2),
  N(74, 1), N(72, 1), N(70, 2),
  N(72, 0.5), N(74, 0.5), N(76, 1), N(77, 1), N(76, 1),
  N(74, 2), N(70, 2),
  // 转（9-12）：A5 高压顶点
  N(81, 1, 1.15), N(79, 1), N(77, 2),
  N(76, 1), N(77, 1), N(76, 1), N(72, 1),
  N(74, 0.5), N(76, 0.5), N(77, 1), N(76, 1), N(74, 1),
  N(72, 1), N(70, 1), N(69, 2),
  // 合（13-16）：步步紧逼后坍缩回 A
  N(69, 1), N(70, 1), N(69, 1), N(67, 1),
  N(69, 1, 1.1), N(72, 1, 1.1), N(74, 1, 1.1), N(76, 1, 1.1),
  N(77, 1), N(76, 1), N(74, 1), N(72, 1),
  N(70, 1), N(69, 3),
]

const BOSS_BASS: BgmNote[] = rep(
  [
    N(45, 0.5), R(0.5), N(45, 0.5), N(45, 0.5), R(0.5), N(45, 0.5), R(1),
    N(45, 0.5), R(0.5), N(45, 0.5), N(45, 0.5), N(46, 0.5), N(45, 0.5), N(43, 1),
  ],
  8,
)

const BOSS_DRONE: BgmNote[] = rep([N(45, 8), R(8)], 4)

const BOSS_PERC: BgmNote[] = rep(
  [
    N(1, 0.5), R(0.5), N(1, 0.5), R(0.5), N(2, 0.5), R(0.5), N(1, 0.5), R(0.5),
    N(1, 0.5), R(0.5), N(1, 0.5), R(0.5), N(1, 0.5), N(2, 0.5), N(1, 0.5), R(0.5),
  ],
  8,
)

const BOSS_TRACK: BgmTrackDef = {
  bpm: 112,
  layers: [
    { kind: 'melody', wave: 'sawtooth', gain: 0.063, lowpass: 1100, notes: BOSS_MELODY },
    { kind: 'bass', wave: 'sine', gain: 0.115, notes: BOSS_BASS },
    { kind: 'drone', wave: 'sine', gain: 0.027, notes: BOSS_DRONE },
    { kind: 'perc', wave: 'sine', gain: 0.08, notes: BOSS_PERC },
  ],
}

/** 真实 MP3 曲目定义（优先于合成曲播放；volume 为相对 master 的声部音量） */
interface Mp3TrackDef {
  src: string
  volume: number
  label: string
}

const MP3_TRACKS: Partial<Record<BgmTrackName, Mp3TrackDef>> = {
  day: { src: '/audio/bgm-main.mp3', volume: 0.62, label: '妖怪茶水间' },
  night: { src: '/audio/bgm-battle-1.mp3', volume: 0.64, label: '夜袭客栈' },
  night2: { src: '/audio/bgm-battle-2.mp3', volume: 0.64, label: '水墨藏锋' },
}

// ---------- 曲目五：区域三 · 沸火赤川（E 弗里几亚主音火热战曲，BPM 108） ----------
// 主题「赤川沸火」：急促上行音阶如熔岩奔涌，大三度跳动如火焰腾起；
// 低音 E2 持续滚动锤击 + 密集perc 驱动，旋律方波过载低通塑造灼热金属质感

const NIGHT3_MELODY: BgmNote[] = [
  // 起（1-4）：E 弗里几亚急促上行，熔岩奔涌
  N(64, 0.5), N(65, 0.5), N(67, 1), N(71, 1),
  N(72, 1.5), N(71, 0.5), N(67, 1), N(65, 1),
  N(64, 0.5), N(65, 0.5), N(67, 0.5), N(71, 0.5), N(72, 1), N(71, 1),
  N(67, 2), R(2),
  // 承（5-8）：大三度跳动，火焰腾起
  N(76, 1, 1.1), N(72, 1), N(76, 1), N(79, 1),
  N(77, 1.5), N(76, 0.5), N(72, 1), N(71, 1),
  N(72, 0.5), N(74, 0.5), N(76, 0.5), N(77, 0.5), N(76, 1), N(72, 1),
  N(71, 2), N(67, 2),
  // 转（9-12）：高音区灼热顶点，短促呼吸
  N(83, 1, 1.15), N(81, 1), N(79, 1), N(77, 1),
  N(76, 1.5), N(77, 0.5), N(79, 1), N(76, 1),
  N(77, 0.5), N(76, 0.5), N(74, 0.5), N(76, 0.5), N(77, 1), N(74, 1),
  N(72, 2), N(71, 1), N(72, 1),
  // 合（13-16）：熔岩回落，长音收束归 E
  N(76, 0.5), N(74, 0.5), N(72, 1), N(71, 1), N(67, 1),
  N(65, 1), N(67, 1), N(71, 1), N(72, 1),
  N(71, 1), N(67, 1), N(65, 1), N(64, 1),
  N(64, 3), R(1),
]

const NIGHT3_BASS: BgmNote[] = rep(
  [
    N(40, 0.5), N(40, 0.5), R(0.5), N(40, 0.5), N(43, 0.5), N(40, 0.5), R(1),
    N(40, 0.5), N(40, 0.5), N(41, 0.5), N(40, 0.5), N(38, 0.5), N(36, 0.5), R(1),
  ],
  8,
)

const NIGHT3_PERC: BgmNote[] = rep(
  [
    N(1, 0.5), N(2, 0.5), N(1, 0.5), R(0.5), N(1, 0.5), N(2, 0.5), R(0.5),
    N(1, 0.5), N(2, 0.5), N(1, 0.5), N(2, 0.5), N(1, 0.5, 0.7), N(2, 0.5), N(1, 0.5), R(0.5),
  ],
  8,
)

const NIGHT3_TRACK: BgmTrackDef = {
  bpm: 108,
  layers: [
    { kind: 'melody', wave: 'square', gain: 0.055, lowpass: 1600, notes: NIGHT3_MELODY },
    { kind: 'bass', wave: 'sine', gain: 0.11, notes: NIGHT3_BASS },
    { kind: 'perc', wave: 'sine', gain: 0.082, notes: NIGHT3_PERC },
  ],
}

/** 合成曲总表（night2 缺位时回退 night 合成曲） */
const TRACKS: Record<BgmTrackName, BgmTrackDef> = {
  day: DAY_TRACK,
  night: NIGHT_TRACK,
  night2: NIGHT_TRACK,
  night3: NIGHT3_TRACK,
  boss: BOSS_TRACK,
}

// ---------- 引擎参数 ----------
/** 切曲 crossfade（秒） */
const CROSSFADE = 1.2
/** 调度前瞻窗口（秒）：大于后台 tab 定时器节流间隔，切后台不断音 */
const LOOKAHEAD = 1.1
/** 调度器间隔（ms） */
const SCHEDULE_MS = 25

interface BgmVoice {
  track: BgmTrackName
  def: BgmTrackDef
  /** 声部总线（crossfade 包络挂这里） */
  gain: GainNode
  /** 各层输入节点（带低通的滤波器或 gain 本身） */
  inputs: AudioNode[]
  /** 各层下一音符的排程时刻 */
  nextT: number[]
  /** 各层当前音符下标 */
  pos: number[]
  /** 诞生时刻（淡入起点） */
  bornAt: number
  dying: boolean
  /** 淡出完毕可回收时刻 */
  deadline: number
}

/** MP3 声部：一个 <audio> 元素绑定一个 MediaElementSource（元素与 source 一一对应、终身不可重绑，故缓存复用） */
interface Mp3Voice {
  el: HTMLAudioElement
  gain: GainNode
  /** 是否正在出声（false = 已淡出暂停，元素待复用） */
  active: boolean
  /** 淡出完成后暂停元素的定时器 */
  stopTimer: number | null
  /** 加载失败已回退合成曲（避免回退风暴） */
  failed: boolean
}

/** 复用白噪声缓冲（perc 轻拍） */
let cachedNoise: AudioBuffer | null = null
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoise) return cachedNoise
  const len = Math.floor(ctx.sampleRate * 0.5)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  cachedNoise = buf
  return buf
}

class BgmEngine {
  private enabled = true
  /** 期望播放的曲目（未解锁手势时挂起，解锁后自动开始） */
  private desired: BgmTrackName | null = null
  private voices = new Set<BgmVoice>()
  /** MP3 声部缓存（按曲目名；元素+source 终身复用，不重建） */
  private mp3Voices = new Map<BgmTrackName, Mp3Voice>()
  private timer: ReturnType<typeof setInterval> | null = null
  // BGM 总线 + 简易回声（附点八分延迟，添国风空灵感）
  private bus: GainNode | null = null
  private delay: DelayNode | null = null
  private fb: GainNode | null = null
  private wet: GainNode | null = null

  constructor() {
    if (typeof window === 'undefined') return
    this.syncSetting()
    // 手势解锁后按当前期望曲目自动开始（与 sfx 共用同一次解锁事件）
    onAudioUnlocked(() => this.handleUnlock())
  }

  /** 读取存档中的音乐开关与音量（与 store.settings.music / bgmVolume 一致） */
  syncSetting() {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('yaoguai-inn-save-v1')
      if (raw) {
        const parsed = JSON.parse(raw) as {
          state?: { settings?: { music?: boolean; bgmVolume?: number } }
        }
        this.enabled = parsed.state?.settings?.music !== false
        if (typeof parsed.state?.settings?.bgmVolume === 'number') {
          setBgmVolume(parsed.state.settings.bgmVolume)
        }
      }
    } catch {
      this.enabled = true
    }
  }

  /** 总开关：关闭立即淡出；打开后若有期望曲目则自动恢复 */
  setEnabled(on: boolean) {
    this.enabled = on
    if (on) {
      if (this.desired && this.canPlay()) this.startIfIdle(this.desired)
    } else {
      this.fadeAll(0.5)
    }
  }

  /** 播放/切换曲目（1.2s crossfade）；未解锁手势时挂起；MP3 曲目优先，失败回退合成曲 */
  play(track: BgmTrackName) {
    this.desired = track
    if (!this.enabled || !this.canPlay()) return
    for (const v of this.voices) {
      if (!v.dying && v.track === track) return // 已在播（合成声部）
    }
    const mv = this.mp3Voices.get(track)
    if (mv && mv.active) return // 已在播（MP3 声部）
    if (MP3_TRACKS[track] && !mv?.failed) {
      this.startMp3Voice(track)
    } else {
      this.startVoice(track)
    }
  }

  /** 停止并淡出 */
  stop() {
    this.desired = null
    this.fadeAll(1.0)
  }

  /** 当前期望曲目（播放中或待播，状态同步/热更新继承用） */
  currentTrack(): BgmTrackName | null {
    return this.desired
  }

  /** 总开关状态 */
  isEnabled(): boolean {
    return this.enabled
  }

  /** 立即释放调度器与声部（模块热更新替换时由新一代引擎调用） */
  dispose() {
    this.desired = null
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const v of this.voices) v.gain.disconnect()
    this.voices.clear()
    // MP3 声部：停定时器 → 暂停 → 断开增益 → 丢弃元素与 source（MediaElementSource 不可跨 ctx 复用）
    for (const mv of this.mp3Voices.values()) {
      if (mv.stopTimer !== null) window.clearTimeout(mv.stopTimer)
      mv.stopTimer = null
      mv.active = false
      try {
        mv.el.pause()
        mv.el.removeAttribute('src')
        mv.el.load()
      } catch {
        /* 忽略释放异常 */
      }
      try {
        mv.gain.disconnect()
      } catch {
        /* ctx 可能已关闭 */
      }
    }
    this.mp3Voices.clear()
  }

  // ---------- 内部实现 ----------

  private canPlay(): boolean {
    const s = getSharedAudio()
    if (!s) return false
    return audioUnlocked || s.ctx.state === 'running'
  }

  private handleUnlock() {
    if (this.enabled && this.desired) this.startIfIdle(this.desired)
  }

  private startIfIdle(track: BgmTrackName) {
    for (const v of this.voices) {
      if (!v.dying) return
    }
    for (const mv of this.mp3Voices.values()) {
      if (mv.active) return
    }
    if (MP3_TRACKS[track] && !this.mp3Voices.get(track)?.failed) {
      this.startMp3Voice(track)
    } else {
      this.startVoice(track)
    }
  }

  private fadeAll(fade: number) {
    const s = getSharedAudio()
    if (!s) return
    const now = s.ctx.currentTime
    for (const v of this.voices) this.fadeOut(v, now, fade)
    for (const mv of this.mp3Voices.values()) {
      if (mv.active) this.fadeOutMp3(mv, now, fade)
    }
  }

  /** MP3 声部淡出：增益归零后暂停元素（元素与 source 保留复用） */
  private fadeOutMp3(mv: Mp3Voice, now: number, fade: number) {
    mv.active = false
    const g = mv.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(0, g.value), now)
    g.linearRampToValueAtTime(0, now + fade)
    if (mv.stopTimer !== null) window.clearTimeout(mv.stopTimer)
    mv.stopTimer = window.setTimeout(() => {
      mv.stopTimer = null
      try {
        mv.el.pause()
      } catch {
        /* 已释放的元素 */
      }
    }, (fade + 0.2) * 1000)
  }

  private fadeOut(v: BgmVoice, now: number, fade: number) {
    if (v.dying) return
    v.dying = true
    // 淡入中的声部按线性包络推算当前值，再锚定后淡出
    const cur = Math.max(0, Math.min(1, (now - v.bornAt) / CROSSFADE))
    const g = v.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(cur, now)
    g.linearRampToValueAtTime(0, now + fade)
    v.deadline = now + fade + 0.06
  }

  private ensureBus(s: SharedAudio) {
    if (this.bus) return
    const { ctx, bgmBus } = s
    this.bus = ctx.createGain()
    this.bus.gain.value = 1
    this.bus.connect(bgmBus)
    // 回声链：bus → delay ⇄ feedback；delay → wet → bgmBus
    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = 0.36
    this.fb = ctx.createGain()
    this.fb.gain.value = 0.22
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.15
    this.bus.connect(this.delay)
    this.delay.connect(this.fb)
    this.fb.connect(this.delay)
    this.delay.connect(this.wet)
    this.wet.connect(bgmBus)
  }

  private startVoice(track: BgmTrackName) {
    const s = getSharedAudio()
    if (!s) return
    this.ensureBus(s)
    const { ctx } = s
    const def = TRACKS[track]
    const now = ctx.currentTime
    const spb = 60 / def.bpm
    // 旧声部 crossfade 淡出
    for (const v of this.voices) this.fadeOut(v, now, CROSSFADE)
    // 回声延迟随曲速摆动（附点八分）
    this.delay?.delayTime.setTargetAtTime(spb * 0.75, now, 0.2)
    // 新声部：0 → 1 淡入
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE)
    gain.connect(this.bus!)
    // 各层输入节点（需要暗化音色的层挂低通）
    const inputs: AudioNode[] = def.layers.map((layer) => {
      if (layer.lowpass) {
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = layer.lowpass
        f.Q.value = 0.6
        f.connect(gain)
        return f
      }
      return gain
    })
    const voice: BgmVoice = {
      track,
      def,
      gain,
      inputs,
      nextT: def.layers.map(() => now + 0.12),
      pos: def.layers.map(() => 0),
      bornAt: now,
      dying: false,
      deadline: Infinity,
    }
    this.voices.add(voice)
    this.ensureTimer()
    this.tick()
  }

  private ensureTimer() {
    if (this.timer === null) this.timer = setInterval(this.tick, SCHEDULE_MS)
  }

  /** 启动 MP3 声部：MediaElementSource → gain → master，crossfade 由 gain 包络完成；失败回退合成曲 */
  private startMp3Voice(track: BgmTrackName) {
    const s = getSharedAudio()
    if (!s) return
    const def = MP3_TRACKS[track]
    if (!def) {
      this.startVoice(track)
      return
    }
    const { ctx } = s
    const now = ctx.currentTime
    // 其余声部全部淡出（合成 + 其他 MP3）
    for (const v of this.voices) this.fadeOut(v, now, CROSSFADE)
    for (const mv of this.mp3Voices.values()) {
      if (mv.active) this.fadeOutMp3(mv, now, CROSSFADE)
    }

    let voice = this.mp3Voices.get(track)
    if (!voice) {
      // 首次创建：audio 元素 + MediaElementSource + 增益链（直连 bgmBus 音量总线，不带回声避免浑浊）
      const el = new Audio()
      el.src = def.src
      el.loop = true
      el.preload = 'auto'
      const gain = ctx.createGain()
      gain.gain.value = 0
      let src: MediaElementAudioSourceNode
      try {
        src = ctx.createMediaElementSource(el)
      } catch {
        // 极端环境（元素已被绑定）：回退合成曲
        this.startVoice(track)
        return
      }
      src.connect(gain)
      gain.connect(s.bgmBus)
      voice = { el, gain, active: false, stopTimer: null, failed: false }
      this.mp3Voices.set(track, voice)
      // 加载失败：标记 failed 并回退合成曲（仅一次）
      el.addEventListener(
        'error',
        () => {
          const v = this.mp3Voices.get(track)
          if (!v || v.failed) return
          v.failed = true
          v.active = false
          if (this.desired === track && this.enabled && this.canPlay()) {
            this.startVoice(track)
          }
        },
        { once: false }
      )
    }

    // 复用声部：重置包络 → 从头播放 → 淡入
    if (voice.stopTimer !== null) {
      window.clearTimeout(voice.stopTimer)
      voice.stopTimer = null
    }
    const g = voice.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(0, now)
    g.linearRampToValueAtTime(def.volume, now + CROSSFADE)
    try {
      voice.el.currentTime = 0
    } catch {
      /* 元素尚未就绪 */
    }
    voice.el
      .play()
      .then(() => {
        voice.active = true
      })
      .catch(() => {
        // 自动播放被拦截（理论上有手势解锁不会发生）：静默挂起，等下次手势/切曲重试
        voice.active = false
      })
    voice.active = true
  }

  /** lookahead 调度器：每 25ms 把前瞻窗口内的音符排到 audioCtx.currentTime 时间轴 */
  private tick = () => {
    const s = getSharedAudio()
    if (!s) return
    const now = s.ctx.currentTime
    const horizon = now + LOOKAHEAD
    for (const v of this.voices) {
      if (v.dying) {
        if (now >= v.deadline) {
          v.gain.disconnect()
          this.voices.delete(v)
        }
        continue
      }
      const spb = 60 / v.def.bpm
      for (let i = 0; i < v.def.layers.length; i++) {
        const layer = v.def.layers[i]
        const notes = layer.notes
        let guard = 0
        while (v.nextT[i] < horizon && guard < 128) {
          guard++
          const note = notes[v.pos[i]]
          this.scheduleNote(s.ctx, v.inputs[i], layer, note, v.nextT[i], spb)
          v.nextT[i] += note.d * spb
          v.pos[i] = (v.pos[i] + 1) % notes.length
        }
      }
    }
    if (this.voices.size === 0 && this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private envelopeFor(kind: BgmLayerKind, dur: number): { atk: number; rel: number } {
    switch (kind) {
      case 'drone':
        return { atk: Math.min(0.8, dur * 0.25), rel: Math.min(1.0, dur * 0.3) }
      case 'harmony':
        return { atk: 0.06, rel: Math.min(0.5, dur * 0.6) }
      case 'bass':
        return { atk: 0.02, rel: Math.min(0.2, dur * 0.4) }
      default:
        return { atk: 0.025, rel: Math.min(0.3, dur * 0.5) }
    }
  }

  private scheduleNote(
    ctx: AudioContext,
    dest: AudioNode,
    layer: BgmLayer,
    note: BgmNote,
    t: number,
    spb: number,
  ) {
    if (note.n === 0) return
    const vel = note.v ?? 1
    if (layer.kind === 'perc') {
      if (note.n === 1) this.percKick(ctx, dest, t, layer.gain * vel)
      else if (note.n === 2) this.percTick(ctx, dest, t, layer.gain * vel)
      return
    }
    const freq = midiToFreq(note.n)
    const dur = note.d * spb
    const vol = layer.gain * vel
    const env = this.envelopeFor(layer.kind, dur)
    if (layer.kind === 'drone') {
      // 低音簇：根音 + 小二度擦撞（妖王夜的压迫感来源）
      this.bgmTone(ctx, dest, layer.wave, freq, dur, vol, t, env)
      this.bgmTone(ctx, dest, layer.wave, freq * SEMITONE_RATIO, dur, vol * 0.55, t, env)
      return
    }
    this.bgmTone(ctx, dest, layer.wave, freq, dur, vol, t, env)
    if (layer.kind === 'harmony' && layer.fifth) {
      // 五度和音点缀（根音 + 纯五度）
      this.bgmTone(ctx, dest, layer.wave, freq * 1.5, dur, vol * 0.6, t, env)
    }
  }

  private bgmTone(
    ctx: AudioContext,
    dest: AudioNode,
    wave: OscillatorType,
    freq: number,
    dur: number,
    vol: number,
    t: number,
    env: { atk: number; rel: number },
  ) {
    if (vol <= 0) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, t)
    const atk = Math.min(env.atk, dur * 0.4)
    const rel = Math.min(env.rel, Math.max(0.02, dur * 0.55))
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + atk)
    if (dur - rel > atk) g.gain.setValueAtTime(vol, t + dur - rel)
    g.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  /** 底鼓：正弦下滑闷响 */
  private percKick(ctx: AudioContext, dest: AudioNode, t: number, vol: number) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.14)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24)
    osc.connect(g)
    g.connect(dest)
    osc.start(t)
    osc.stop(t + 0.26)
  }

  /** 轻拍：高通白噪声短促嘶响（随机相位避免机械感） */
  private percTick(ctx: AudioContext, dest: AudioNode, t: number, vol: number) {
    const src = ctx.createBufferSource()
    src.buffer = getNoiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 4200
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    src.connect(filter)
    filter.connect(g)
    g.connect(dest)
    src.start(t, Math.random() * 0.4)
    src.stop(t + 0.06)
  }
}

/** 全局单例 */
export const sfx = new SfxEngine()
export const bgm = new BgmEngine()

// HMR/重复评估保护：本模块被热更新重新执行时，先停掉上一代引擎并关闭旧
// AudioContext（避免开发环境双 BGM），并继承上一代的期望曲目与开关，
// 下次手势/舞台切换时自动恢复。生产环境只执行一次，无副作用。
// 注意不将旧 sharedAudio 置空：旧模块的解锁监听若再触发，拿到的是已关闭的
// 旧 ctx（resume 会 reject，已被 catch 吞掉），不会再新建多余的 AudioContext。
if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __yaoguaiAudioCleanup?: () => void
    __yaoguaiAudioInherit?: { track: BgmTrackName | null; enabled: boolean }
  }
  w.__yaoguaiAudioCleanup?.()
  const inherit = w.__yaoguaiAudioInherit
  if (inherit) {
    bgm.setEnabled(inherit.enabled)
    if (inherit.track) bgm.play(inherit.track)
  }
  w.__yaoguaiAudioCleanup = () => {
    w.__yaoguaiAudioInherit = { track: bgm.currentTrack(), enabled: bgm.isEnabled() }
    bgm.dispose()
    if (sharedAudio) void sharedAudio.ctx.close().catch(() => undefined)
  }
}
