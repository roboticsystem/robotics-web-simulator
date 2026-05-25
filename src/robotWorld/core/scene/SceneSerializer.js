/**
 * SceneSerializer — 场景 JSON 序列化/反序列化
 */
export class SceneSerializer {
  /**
   * 将场景快照序列化为 JSON 字符串
   * @param {object} snapshot - SceneManager.getSnapshot() 返回值
   * @returns {string}
   */
  static serialize(snapshot) {
    const data = {
      meta: {
        version: '1.0.0',
        savedAt: new Date().toISOString(),
        appName: 'RobotWorldSim',
      },
      ...snapshot,
    }
    return JSON.stringify(data, null, 2)
  }

  /**
   * 从 JSON 字符串解析为场景快照
   * @param {string} json
   * @returns {object}
   */
  static deserialize(json) {
    try {
      const data = JSON.parse(json)
      // 去掉 meta，返回场景数据
      const { meta, ...snapshot } = data
      return snapshot
    } catch (e) {
      throw new Error(`[SceneSerializer] 解析失败: ${e.message}`)
    }
  }

  /**
   * 触发浏览器下载 JSON 文件
   * @param {object} snapshot
   * @param {string} filename
   */
  static download(snapshot, filename = 'scene.json') {
    const json = SceneSerializer.serialize(snapshot)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * 从文件加载 JSON
   * @returns {Promise<object>} snapshot
   */
  static loadFromFile() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = (e) => {
        const file = e.target.files[0]
        if (!file) return reject(new Error('未选择文件'))
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            resolve(SceneSerializer.deserialize(ev.target.result))
          } catch (err) {
            reject(err)
          }
        }
        reader.onerror = () => reject(new Error('文件读取失败'))
        reader.readAsText(file)
      }
      input.click()
    })
  }
}
