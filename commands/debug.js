// @ts-nocheck
/**
 * 调试命令工具 - 在指定组件或函数中添加控制台输出
 * 使用方式: /debug <组件名> [函数名]
 * 示例: /debug WordList loadData
 */

const fs = require('fs')
const path = require('path')

// 支持的组件列表
const SUPPORTED_COMPONENTS = [
  'WordList',
  'MultiRoleReading',
  'VideoPlayer',
  'ErrorDisplay',
  'BackContinue'
]

// 支持的函数列表（按组件分类）
const COMPONENT_FUNCTIONS = {
  WordList: ['loadData', 'contentHtml', 'setup', 'onMounted'],
  MultiRoleReading: ['loadData', 'setupAudio', 'togglePlay', 'seekTo'],
  VideoPlayer: ['setupVideo', 'play', 'pause', 'handleError'],
  ErrorDisplay: ['setup', 'render'],
  BackContinue: ['handleBack', 'handleContinue']
}

/**
 * 在指定位置添加调试日志
 */
function addDebugLog(filePath, functionName, logContent) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // 查找函数定义位置并在函数开头添加日志
    const functionRegex = new RegExp(`(async\\s+)?function\\s+${functionName}\\s*\\(`, 'g')
    const match = functionRegex.exec(content)
    
    if (match) {
      const insertPos = match.index + match[0].length
      const beforeContent = content.substring(0, insertPos)
      const afterContent = content.substring(insertPos)
      
      // 查找函数体开始位置（{）
      const braceMatch = /^\s*\{/.exec(afterContent)
      if (braceMatch) {
        const bracePos = braceMatch.index + braceMatch[0].length
        const newContent = beforeContent + afterContent.substring(0, bracePos) + '\n' + logContent + '\n' + afterContent.substring(bracePos)
        
        fs.writeFileSync(filePath, newContent, 'utf8')
        return { success: true, message: `已在 ${functionName} 函数开头添加调试日志` }
      }
    }
    
    return { success: false, message: `未找到 ${functionName} 函数定义` }
  } catch (err) {
    return { success: false, message: `文件操作失败: ${err.message}` }
  }
}

/**
 * 执行调试命令
 */
function executeDebugCommand(args) {
  const [componentName, functionName] = args.split(' ')
  
  // 验证组件名
  if (!componentName || !SUPPORTED_COMPONENTS.includes(componentName)) {
    console.error(`❌ 不支持的组件: ${componentName}`)
    console.log(`✅ 支持的组件: ${SUPPORTED_COMPONENTS.join(', ')}`)
    return
  }
  
  // 验证函数名
  const validFunctions = COMPONENT_FUNCTIONS[componentName] || []
  if (functionName && !validFunctions.includes(functionName)) {
    console.error(`❌ ${componentName} 组件不支持该函数: ${functionName}`)
    console.log(`✅ ${componentName} 支持的函数: ${validFunctions.join(', ')}`)
    return
  }
  
  // 获取组件路径
  const componentPath = path.join(__dirname, 'src', 'components', `${componentName}.vue`)
  
  if (!fs.existsSync(componentPath)) {
    console.error(`❌ 组件文件不存在: ${componentPath}`)
    return
  }
  
  console.log(`\n🔧 正在为 ${componentName} 组件添加调试日志...`)
  
  if (functionName) {
    // 为特定函数添加日志
    const logContent = `    console.log('\\n[DEBUG] ${componentName}.${functionName} 开始执行');`
    const result = addDebugLog(componentPath, functionName, logContent)
    
    if (result.success) {
      console.log(`✅ ${result.message}`)
      console.log(`📝 已添加日志: console.log('[DEBUG] ${componentName}.${functionName} 开始执行')`)
    } else {
      console.error(`❌ ${result.message}`)
    }
  } else {
    // 为组件的 setup 函数添加日志
    const logContent = `    console.log('\\n[DEBUG] ${componentName} 组件初始化');\n    console.log('[DEBUG] props:', JSON.stringify(props, null, 2));`
    const result = addDebugLog(componentPath, 'setup', logContent)
    
    if (result.success) {
      console.log(`✅ ${result.message}`)
    } else {
      console.error(`❌ ${result.message}`)
    }
  }
  
  console.log('\n🔄 开发服务器将自动热更新，刷新页面查看日志')
}

// 导出命令
module.exports = {
  name: 'debug',
  description: '在指定组件或函数中添加控制台输出以查找bug',
  usage: '/debug <组件名> [函数名]',
  examples: [
    '/debug WordList',
    '/debug WordList loadData',
    '/debug MultiRoleReading setupAudio'
  ],
  supportedComponents: SUPPORTED_COMPONENTS,
  execute: executeDebugCommand
}
