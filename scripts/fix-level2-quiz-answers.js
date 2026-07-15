/**
 * 修复 level2 quiz block 缺少 correct_answer 和 explanation 的问题
 * 从对话文本中提取答案和解析，自动添加到 quiz block 中
 */

const fs = require('fs');
const path = require('path');

// 配置
const dataDir = path.join(__dirname, '..', 'public', 'data', 'pages_level2_dialog_quiz');
const files = ['WEN_01.json', 'WEN_02.json', 'WEN_03.json', 'WEN_04.json'];

/**
 * 从文本中提取答案和解析
 * @param {string} text - 对话文本
 * @returns {{answer: string|null, explanation: string|null}}
 */
function extractAnswerAndExplanation(text) {
  if (!text) return { answer: null, explanation: null };

  // 匹配"答案是X"的模式
  const answerPattern = /答案是([A-D])[。，,]/;
  const match = text.match(answerPattern);

  if (match) {
    const answer = match[1];
    // 提取答案后面的所有内容作为解析
    const answerIndex = match.index + match[0].length;
    let explanation = text.substring(answerIndex).trim();
    // 去掉结尾的句号
    explanation = explanation.replace(/[。.]+$/, '');

    return { answer, explanation };
  }

  return { answer: null, explanation: null };
}

/**
 * 处理单个文件
 * @param {string} filePath - 文件路径
 */
function processFile(filePath) {
  console.log(`\n处理文件: ${path.basename(filePath)}`);

  // 读取文件
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const pageData = JSON.parse(rawData);

  const blocks = pageData.blocks;
  let quizCount = 0;
  let fixedCount = 0;

  // 遍历所有 block，收集答案信息
  // 策略：找到包含"答案是"的文本，将答案分配给前面最近的 quiz
  let lastQuizIndex = -1;
  const quizAnswers = {}; // quizIndex -> { answer, explanation }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'quiz') {
      lastQuizIndex = i;
      quizCount++;
    }

    // 检查当前 block 是否包含答案
    let textToCheck = '';
    if (block.type === 'dialogue' && block.data?.pre_dialog) {
      textToCheck = block.data.pre_dialog;
    } else if (block.type === 'quiz' && block.data?.pre_dialog) {
      // quiz 的 pre_dialog 也可能包含上一题的答案（如 WEN_04）
      textToCheck = block.data.pre_dialog;
    }

    if (textToCheck && textToCheck.includes('答案是')) {
      const { answer, explanation } = extractAnswerAndExplanation(textToCheck);

      if (answer && lastQuizIndex >= 0) {
        // 将答案分配给前面最近的 quiz
        // 但需要检查：如果当前 block 是 quiz，那么答案应该是上一个 quiz 的
        const targetQuizIndex = block.type === 'quiz' ? lastQuizIndex - 1 : lastQuizIndex;

        if (targetQuizIndex >= 0 && !quizAnswers[targetQuizIndex]) {
          quizAnswers[targetQuizIndex] = { answer, explanation };
          console.log(`  找到答案: 第 ${targetQuizIndex + 1} 题 -> ${answer}`);
        }
      }
    }
  }

  // 将答案应用到 quiz block
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'quiz' && quizAnswers[i]) {
      const { answer, explanation } = quizAnswers[i];

      // 添加 correct_answer 字段
      block.data.correct_answer = answer;

      // 添加 explanation 字段（如果还没有）
      if (!block.data.explanation && explanation) {
        block.data.explanation = explanation;
      }

      fixedCount++;
      console.log(`  修复第 ${i + 1} 题: correct_answer=${answer}`);
    }
  }

  // 写回文件
  fs.writeFileSync(filePath, JSON.stringify(pageData, null, 2) + '\n', 'utf-8');

  console.log(`  完成: 共 ${quizCount} 道题，修复 ${fixedCount} 道`);

  return { quizCount, fixedCount };
}

// 主函数
function main() {
  console.log('开始修复 level2 quiz block 的答案字段...');
  console.log(`数据目录: ${dataDir}`);

  let totalQuiz = 0;
  let totalFixed = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);

    if (!fs.existsSync(filePath)) {
      console.warn(`\n警告: 文件不存在 - ${file}`);
      continue;
    }

    try {
      const { quizCount, fixedCount } = processFile(filePath);
      totalQuiz += quizCount;
      totalFixed += fixedCount;
    } catch (error) {
      console.error(`\n处理文件 ${file} 时出错:`, error.message);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`处理完成！`);
  console.log(`总题目数: ${totalQuiz}`);
  console.log(`修复题目数: ${totalFixed}`);
  console.log(`========================================`);
}

main();
