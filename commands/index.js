// @ts-nocheck
/**
 * 命令管理器 - 加载和执行自定义命令
 */

const fs = require('fs')
const path = require('path')

class CommandManager {
  constructor() {
    this.commands = {}
    this.loadCommands()
  }

  /**
   * 加载所有命令
   */
  loadCommands() {
    const commandsDir = path.join(__dirname, 'commands')
    
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true })
      return
    }

    const commandFiles = fs.readdirSync(commandsDir).filter(file => file.endsWith('.js'))
    
    commandFiles.forEach(file => {
      try {
        const command = require(`./commands/${file}`)
        if (command.name && command.execute) {
          this.commands[command.name] = command
          console.log(`✅ 加载命令: ${command.name}`)
        }
      } catch (err) {
        console.error(`❌ 加载命令失败 ${file}:`, err.message)
      }
    })
  }

  /**
   * 执行命令
   */
  execute(input) {
    if (!input.startsWith('/')) {
      return { success: false, message: '命令必须以 / 开头' }
    }

    const parts = input.slice(1).split(' ')
    const commandName = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    if (!this.commands[commandName]) {
      return this.showHelp()
    }

    try {
      this.commands[commandName].execute(args)
      return { success: true, message: `执行命令: ${commandName}` }
    } catch (err) {
      return { success: false, message: `命令执行失败: ${err.message}` }
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log('\n📋 可用命令:')
    console.log('────────────────────────────────')
    
    Object.values(this.commands).forEach(command => {
      console.log(`\n🔧 ${command.name}`)
      console.log(`   描述: ${command.description}`)
      console.log(`   使用: ${command.usage}`)
      
      if (command.examples && command.examples.length > 0) {
        console.log('   示例:')
        command.examples.forEach(example => {
          console.log(`     - ${example}`)
        })
      }
    })

    console.log('\n────────────────────────────────')
    return { success: false, message: '显示帮助信息' }
  }
}

// 创建单例实例
const commandManager = new CommandManager()

// 导出命令执行函数
function runCommand(input) {
  return commandManager.execute(input)
}

module.exports = {
  CommandManager,
  runCommand,
  commands: commandManager.commands
}
