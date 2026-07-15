const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} = require('docx');

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
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !(lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('---'))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    let text = paraLines.join(' ');
    // 移除markdown格式
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
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
          size: 44, // 22pt
          font: { eastAsia: '黑体', ascii: 'Arial', hAnsi: 'Arial' },
        }),
      ],
    })
  );

  // 内容
  for (const elem of elements) {
    if (elem.type === 'heading') {
      const sizes = { 1: 32, 2: 28, 3: 24, 4: 24 }; // 16pt, 14pt, 12pt
      const size = sizes[elem.level] || 24;
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: elem.text,
              bold: true,
              size: size,
              font: { eastAsia: '黑体', ascii: 'Arial', hAnsi: 'Arial' },
            }),
          ],
        })
      );
    } else if (elem.type === 'paragraph') {
      children.push(
        new Paragraph({
          spacing: { after: 120, line: 360 },
          indent: { firstLine: 480 }, // 首行缩进2字符
          children: [
            new TextRun({
              text: elem.text,
              size: 24, // 12pt
              font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman' },
            }),
          ],
        })
      );
    } else if (elem.type === 'code') {
      const lines = elem.text.split('\n');
      for (const line of lines) {
        children.push(
          new Paragraph({
            spacing: { after: 0, line: 240 },
            indent: { left: 200 },
            children: [
              new TextRun({
                text: line || ' ',
                size: 20, // 10pt
                font: { eastAsia: 'Consolas', ascii: 'Consolas', hAnsi: 'Consolas' },
                color: '333333',
              }),
            ],
          })
        );
      }
      children.push(new Paragraph({ text: '' }));
    } else if (elem.type === 'table') {
      const { headers, rows } = elem;
      const tableRows = [];

      // 表头
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: headers.map(
            h =>
              new TableCell({
                width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        size: 22, // 11pt
                        font: { eastAsia: '黑体', ascii: 'Arial', hAnsi: 'Arial' },
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
      );

      // 数据行
      for (const row of rows) {
        tableRows.push(
          new TableRow({
            children: row.map(
              cell =>
                new TableCell({
                  width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          size: 21, // 10.5pt
                          font: { eastAsia: '宋体', ascii: 'Times New Roman', hAnsi: 'Times New Roman' },
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
        );
      }

      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
      );

      // 表格后空行
      children.push(new Paragraph({ text: '' }));
    }
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 2.54cm
          },
        },
        children,
      },
    ],
  });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('用法: node generate_design_doc.js <输入markdown文件> <输出docx文件> <文档标题>');
    process.exit(1);
  }

  const [inputFile, outputFile, title] = args;

  // 读取markdown
  const mdText = fs.readFileSync(inputFile, 'utf-8');
  const elements = parseMarkdown(mdText);

  // 创建文档
  const doc = createDoc(title, elements);

  // 保存
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputFile, buffer);

  const size = fs.statSync(outputFile).size;
  console.log(`已生成: ${outputFile} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
