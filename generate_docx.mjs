import fs from 'fs';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';

// 解析markdown
function parseMarkdown(mdText) {
  const lines = mdText.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 标题
    if (line.startsWith('#')) {
      const level = line.length - line.replace(/^#+/, '').length;
      const text = line.replace(/^#+\s*/, '').trim();
      elements.push({ type: 'heading', level, text });
      i++;
      continue;
    }

    // 代码块
    if (line.startsWith('```')) {
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push({ type: 'code', text: codeLines.join('\n') });
      continue;
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = line.split('|').map(h => h.trim()).filter(h => h);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cells = lines[i].split('|').map(c => c.trim()).filter(c => c);
        rows.push(cells);
        i++;
      }
      elements.push({ type: 'table', headers, rows });
      continue;
    }

    // 空行
    if (!line.trim()) {
      i++;
      continue;
    }

    // 普通段落
    const paraLines = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !(lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('---'))) {
      paraLines.push(lines[i]);
      i++;
    }
    let text = paraLines.join(' ');
    // 移除markdown格式
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/`(.+?)`/g, '$1');
    elements.push({ type: 'paragraph', text });
  }

  return elements;
}

// 创建文档
function createDoc(title, elements) {
  const children = [];

  // 标题
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 44,
          font: { name: '黑体', eastAsia: '黑体' }
        })
      ]
    })
  );

  // 内容
  for (const elem of elements) {
    if (elem.type === 'heading') {
      const sizes = { 1: 32, 2: 28, 3: 24, 4: 24, 5: 22, 6: 22 };
      const size = sizes[elem.level] || 22;
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: elem.text,
              bold: true,
              size: size,
              font: { name: '黑体', eastAsia: '黑体' }
            })
          ]
        })
      );
    } else if (elem.type === 'paragraph') {
      children.push(
        new Paragraph({
          spacing: { line: 360, after: 120 },
          indent: { firstLine: 480 },
          children: [
            new TextRun({
              text: elem.text,
              size: 24,
              font: { name: '宋体', eastAsia: '宋体' }
            })
          ]
        })
      );
    } else if (elem.type === 'code') {
      const lines = elem.text.split('\n');
      for (const line of lines) {
        children.push(
          new Paragraph({
            spacing: { line: 240 },
            indent: { left: 240 },
            children: [
              new TextRun({
                text: line || ' ',
                size: 20,
                font: { name: 'Consolas', eastAsia: 'Consolas' }
              })
            ]
          })
        );
      }
    } else if (elem.type === 'table') {
      const tableRows = [];

      // 表头
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: elem.headers.map(h =>
            new TableCell({
              width: { size: 2000, type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: h,
                      bold: true,
                      size: 22,
                      font: { name: '黑体', eastAsia: '黑体' }
                    })
                  ]
                })
              ]
            })
          )
        })
      );

      // 数据行
      for (const row of elem.rows) {
        tableRows.push(
          new TableRow({
            children: row.map(cell =>
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        size: 21,
                        font: { name: '宋体', eastAsia: '宋体' }
                      })
                    ]
                  })
                ]
              })
            )
          })
        );
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      );

      // 表格后空行
      children.push(new Paragraph({ children: [new TextRun('')] }));
    }
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      children
    }]
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('用法: node generate_docx.mjs <输入md文件> <输出docx文件> <文档标题>');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1];
  const title = args[2];

  if (!fs.existsSync(inputFile)) {
    console.error('错误：输入文件不存在:', inputFile);
    process.exit(1);
  }

  console.log('读取文件:', inputFile);
  const mdText = fs.readFileSync(inputFile, 'utf-8');

  console.log('解析Markdown...');
  const elements = parseMarkdown(mdText);
  console.log('解析到', elements.length, '个元素');

  console.log('生成文档...');
  const doc = createDoc(title, elements);

  console.log('打包保存...');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputFile, buffer);

  const stats = fs.statSync(outputFile);
  console.log('已生成:', outputFile, '(' + Math.round(stats.size / 1024) + ' KB)');
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
