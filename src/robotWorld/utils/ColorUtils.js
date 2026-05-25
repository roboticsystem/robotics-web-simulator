/**
 * ColorUtils — 颜色处理工具
 */
export const ColorUtils = {
  /**
   * 解析 hex/rgb/rgba 颜色为 {r,g,b} 对象（0-255）
   */
  parseColor(color) {
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const full = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex
      const num = parseInt(full, 16)
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
      }
    }
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) return { r: +m[1], g: +m[2], b: +m[3] }
    return { r: 128, g: 128, b: 128 }
  },

  /**
   * 生成 rgba 字符串
   */
  rgba(color, alpha) {
    const { r, g, b } = ColorUtils.parseColor(color)
    return `rgba(${r},${g},${b},${alpha})`
  },

  /**
   * 返回 "r,g,b" 字符串（用于 rgba() 模板）
   */
  toRgbString(color) {
    const { r, g, b } = ColorUtils.parseColor(color)
    return `${r},${g},${b}`
  },
}
