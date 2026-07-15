const fs = require('fs');

const filePath = 'e:/cpp_discipline/wenyan-platform/public/data/word_list/WEN_01.json';

let content = fs.readFileSync(filePath, 'utf8');

// 修复所有未转义的双引号
// 模式：匹配在 basic_meaning 中出现的未转义双引号
const lines = content.split('\n');
let fixedLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  
  if (line.includes('basic_meaning')) {
    // 找到属性值的开始和结束
    const startIdx = line.indexOf(': "') + 3;
    const endIdx = line.lastIndexOf('",');
    
    if (startIdx > 0 && endIdx > startIdx) {
      const value = line.substring(startIdx, endIdx);
      
      // 转义所有未转义的双引号
      let escapedValue = '';
      for (let j = 0; j < value.length; j++) {
        const char = value[j];
        if (char === '"') {
          // 检查前一个字符是否是反斜杠
          if (j === 0 || value[j - 1] !== '\\') {
            escapedValue += '\\"';
          } else {
            escapedValue += char;
          }
        } else {
          escapedValue += char;
        }
      }
      
      // 替换原来的值
      line = line.substring(0, startIdx) + escapedValue + line.substring(endIdx);
    }
  }
  
  fixedLines.push(line);
}

const fixedContent = fixedLines.join('\n');
fs.writeFileSync(filePath, fixedContent);
console.log('✅ JSON 文件已修复');
