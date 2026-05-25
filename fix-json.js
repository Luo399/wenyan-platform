const fs = require('fs');

const filePath = 'e:/cpp_discipline/wenyan-platform/public/data/word_list/WEN_01.json';

let data = fs.readFileSync(filePath, 'utf8');

// 找到所有未转义的双引号（在属性值内部）
// 模式：匹配 "xxx" 但排除 \"xxx\" 和字符串开头的 "
const pattern = /(?<!\\)"([^"]+)"/g;

let fixedCount = 0;
data = data.replace(pattern, (match, p1, offset) => {
  // 检查是否在属性值内部（前面是冒号和空格）
  const prevChar = data[offset - 1];
  const prevPrevChar = data[offset - 2];
  
  // 如果前面是 ": " 或 ", "，说明是属性值的开始，不需要转义
  if ((prevChar === ':' && prevPrevChar === '"') || 
      (prevChar === ' ' && data[offset - 2] === ':')) {
    return match;
  }
  
  // 如果后面是 ", " 或 "},"，说明是属性值的结束，不需要转义
  const nextChar = data[offset + match.length];
  const nextNextChar = data[offset + match.length + 1];
  if ((nextChar === ',' && nextNextChar === ' ') || nextChar === '}') {
    return match;
  }
  
  // 其他情况需要转义
  fixedCount++;
  return '\\"' + p1 + '\\"';
});

fs.writeFileSync(filePath, data);
console.log(`已修复 ${fixedCount} 处未转义的双引号`);
