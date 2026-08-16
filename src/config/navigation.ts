/**
 * 导航页面配置
 *
 * 配置说明：
 * - 按顺序定义页面，每个页面包含路由名称和参数
 * - 修改页面顺序只需调整数组顺序，无需改动组件代码
 * - id 参数用于在页面间传递
 *
 * =============================================================================
 * 为什么不同页面使用不同的 ID 格式？
 * =============================================================================
 *
 * 本项目中的页面与后端数据模型存在多对一的映射关系：
 *
 * 1. poemId (篇目ID) - 后端数据主键
 *    - 标识一篇具体的课文/文章
 *    - rules、detail 页面使用
 *    - 格式：数字 1, 2, 3...
 *    - 来源：后端 article 表的主键
 *
 * 2. wenId (课文ID) - 前端音频业务标识
 *    - 标识一段需要学习的音频内容
 *    - audio 页面使用
 *    - 格式：WEN_01, WEN_02...（业务约定格式）
 *    - 来源：与后端 wen_record 表关联
 *
 * 为什么分开？
 * - 后端数据结构可能变化（表结构、ID生成规则）
 * - 前端业务逻辑需要统一格式化（如 WEN_01 便于展示）
 * - 解耦后端数据库与前端路由设计
 * - 同一篇课文可能有多个版本的学习内容（音频、视频、习题）
 *
 * 当前所有页面共用 poemId（数字格式），无需跨页 ID 转换；
 * 若未来新增使用其他 ID 格式的页面（如 wenId），再引入转换层即可。
 *
 * 新增页面只需：
 * 1. 在 pageSequence 添加新配置
 * 2. 组件无需修改跳转逻辑
 */

// 页面路由名称定义
export type RouteName =
  | 'home'
  | 'rules'
  | 'stepone'
  | 'steptwo'
  | 'stepthree'
  | 'rule1'
  | 'rule2'
  | 'rule3'
  | 'detail'

// 页面配置接口
export interface PageConfig {
  name: RouteName // 路由名称
  getPath: (id?: string) => string // 根据 id 生成路径的函数
}

/**
 * 页面配置列表（按导航顺序排列）
 * 修改顺序只需调整此数组
 */
export const pageSequence: PageConfig[] = [
  {
    name: 'home',
    getPath: () => '/',
  },
  {
    name: 'rules',
    getPath: (id) => `/rules/${id || '1'}`,
  },
  {
    name: 'stepone',
    getPath: (id) => `/stepone/${id || '1'}`,
  },
  {
    name: 'steptwo',
    getPath: (id) => `/steptwo/${id || '1'}`,
  },
  {
    name: 'stepthree',
    getPath: (id) => `/stepthree/${id || '1'}`,
  },
  {
    name: 'rule1',
    getPath: (id) => `/rule1/${id || '1'}`,
  },
  {
    name: 'rule2',
    getPath: (id) => `/rule2/${id || '1'}`,
  },
  {
    name: 'rule3',
    getPath: (id) => `/rule3/${id || '1'}`,
  },
  {
    name: 'detail',
    getPath: (id) => `/detail/${id || '1'}`,
  },
]

/**
 * 根据路由名称获取页面索引
 */
export function getPageIndex(routeName: RouteName): number {
  return pageSequence.findIndex((p) => p.name === routeName)
}

/**
 * 根据当前页面名称获取下一页配置
 */
export function getNextPage(currentName: RouteName): PageConfig | null {
  const currentIndex = getPageIndex(currentName)
  if (currentIndex === -1 || currentIndex >= pageSequence.length - 1) {
    return null
  }
  return pageSequence[currentIndex + 1] ?? null
}

/**
 * 根据当前页面名称获取上一页配置
 */
export function getPrevPage(currentName: RouteName): PageConfig | null {
  const currentIndex = getPageIndex(currentName)
  if (currentIndex <= 0) {
    return null
  }
  return pageSequence[currentIndex - 1] ?? null
}

// 历史的 idTransformMap / transformId 已删除：
// 所有页面共用 poemId（数字格式），9 个转换函数全是 `(id) => id || null` no-op，
// 调用链 transformId -> useNavigation.getTargetId 实际只做"透传 currentId"。
// 如未来出现使用其他 ID 格式的页面（如 wenId），再按需引入转换层。
