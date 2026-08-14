import { reactive } from 'vue'

/**
 * 全局 UI chrome 状态：移动端地点简介卡与底部主导航的联动。
 * Map 页写入，MobilePrimaryNav 读取；两者使用相同时长与缓动、相反方向滑动。
 */
export const uiChrome = reactive({
  /** 0 = 无简介卡（导航在原位）；1 = 简介卡就位（导航完全滑出屏幕） */
  sheetReveal: 0,
  /** true 时导航按与卡片相同的 0.28s 缓动滑动；拖动卡片时为 false，导航跟手移动 */
  sheetAnimating: false
})

export function resetUiChrome() {
  uiChrome.sheetReveal = 0
  uiChrome.sheetAnimating = false
}
