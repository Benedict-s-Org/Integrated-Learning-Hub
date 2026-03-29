import { 
    Document, 
    Packer, 
    Paragraph, 
    TextRun, 
    AlignmentType, 
    HeadingLevel,
    PageBreak,
    BorderStyle,
    Table,
    TableRow,
    TableCell,
    WidthType,
    VerticalAlign,
    Footer,
} from 'docx';
import { saveAs } from 'file-saver';
import { ExamDocument, Template } from '../types';

const getFont = (fontFamily: string) => {
    switch (fontFamily) {
        case 'pmingliu': return 'PMingLiU';
        case 'serif': return 'Times New Roman';
        case 'sans-serif': return 'Arial';
        case 'monospace': return 'Courier New';
        default: return 'Times New Roman';
    }
};

const getMCQSymbol = (index: number, style: string, isAnswer: boolean) => {
    switch (style) {
        case 'CIRCLE':
            try {
                if (isAnswer) return String.fromCodePoint(0x1F150 + index);
                return String.fromCharCode(0x24B6 + index);
            } catch (e) {
                return `${String.fromCharCode(65 + index)}.`;
            }
        case 'PAREN':
            return `(${String.fromCharCode(65 + index)})`;
        case 'NONE':
            return '';
        case 'ALPHA':
        default:
            return `${String.fromCharCode(65 + index)}.`;
    }
};

export class DocxService {
    static async generate(exam: ExamDocument, template: Template) {
        const { theme } = template;
        const font = getFont(theme.fontFamily);
        
        const children: any[] = [];

        // Add blocks
        exam.blocks.forEach((block, index) => {
            switch (block.type) {
                case 'COVER':
                    children.push(
                        new Paragraph({
                            text: block.content.title || 'EXAMINATION PAPER',
                            heading: HeadingLevel.HEADING_1,
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 400, after: 200 }
                        }),
                        new Paragraph({
                            text: block.content.subtitle || '',
                            heading: HeadingLevel.HEADING_2,
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 800 }
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Name: ______________________", italics: true, font }),
                                new TextRun({ text: "\t\tClass: ______________________", italics: true, font }),
                            ],
                            spacing: { after: 200 }
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Date: ______________________", italics: true, font }),
                                new TextRun({ text: "\t\tDuration: ___________________", italics: true, font }),
                            ],
                            spacing: { after: 800 }
                        })
                    );
                    break;

                case 'SECTION_HEADER':
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ 
                                    text: block.content.title?.toUpperCase() || 'SECTION',
                                    bold: true,
                                    font
                                })
                            ],
                            spacing: { before: 400, after: 200 }
                        })
                    );
                    if (block.content.description) {
                        children.push(
                            new Paragraph({
                                spacing: { after: 200 },
                                children: [new TextRun({ text: block.content.description, font, bold: true })]
                            })
                        );
                    }
                    break;

                case 'STIMULUS_BOX':
                    const stimulusCells = [];
                    if (block.content.title) {
                        stimulusCells.push(
                            new Paragraph({
                                children: [new TextRun({ text: block.content.title, bold: true, font })],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 200 }
                            })
                        );
                    }
                    if (block.content.text) {
                        stimulusCells.push(
                            new Paragraph({
                                children: [new TextRun({ text: block.content.text, font })],
                                alignment: AlignmentType.CENTER,
                            })
                        );
                    }
                    
                    children.push(
                        new Table({
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            children: stimulusCells.length > 0 ? stimulusCells : [new Paragraph("")],
                                            margins: { top: 200, bottom: 200, left: 200, right: 200 },
                                            borders: {
                                                top: { style: BorderStyle.SINGLE, size: 2 },
                                                bottom: { style: BorderStyle.SINGLE, size: 2 },
                                                left: { style: BorderStyle.SINGLE, size: 2 },
                                                right: { style: BorderStyle.SINGLE, size: 2 },
                                            },
                                            width: { size: 100, type: WidthType.PERCENTAGE }
                                        })
                                    ]
                                })
                            ],
                            width: { size: 100, type: WidthType.PERCENTAGE }
                        })
                    );
                    children.push(new Paragraph({ spacing: { after: 200 } })); // Spacing after box
                    break;

                case 'QUESTION':
                    const { 
                        stem, 
                        options, 
                        marks, 
                        bold, 
                        mcqStyle = 'ALPHA', 
                        mcqColumns = 1, 
                        hangingIndent = true,
                        answerIndex = null,
                        markPosition = 'INLINE'
                    } = block.content;

                    // Question Paragraph
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${index + 1}. `, bold: true, font }),
                                new TextRun({ text: stem || '', bold: !!bold, font }),
                                ...(marks && markPosition === 'INLINE' ? [
                                    new TextRun({ text: ` [${marks}]`, bold: true, underline: {}, font })
                                ] : [])
                            ],
                            spacing: { before: 200, after: 100 },
                            indent: hangingIndent ? { hanging: 425 } : undefined
                        })
                    );

                    // Marks on the right if requested
                    if (marks && markPosition === 'RIGHT') {
                        children.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: `\t[${marks}]`, bold: true, font })
                                ],
                                alignment: AlignmentType.RIGHT,
                                spacing: { after: 100 }
                            })
                        );
                    }

                    // Options using layout tables for perfect alignment in Word
                    if (options && options.length > 0) {
                        const rows: TableRow[] = [];
                        const actualColumns = mcqColumns || 1;
                        
                        for (let i = 0; i < options.length; i += actualColumns) {
                            const cells = [];
                            for (let j = 0; j < actualColumns; j++) {
                                const optIndex = i + j;
                                const opt = options[optIndex];
                                
                                // We use a nested table or simple grid per cell.
                                // For basic alignment, setting width helps.
                                cells.push(new TableCell({
                                    children: opt !== undefined ? [
                                        new Paragraph({
                                            children: [
                                                new TextRun({ text: `${getMCQSymbol(optIndex, mcqStyle, answerIndex === optIndex)} `, bold: true, font }),
                                                new TextRun({ text: opt, font })
                                            ],
                                            indent: { left: 425, hanging: 425 } // Align symbol and opt text
                                        })
                                    ] : [],
                                    borders: {
                                        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                        bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                        left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                    },
                                    verticalAlign: VerticalAlign.CENTER
                                }));
                            }
                            rows.push(new TableRow({ children: cells }));
                        }
                        
                        children.push(new Table({
                            rows,
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            borders: {
                                top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                                insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                            }
                        }));
                    }
                    break;

                case 'INSTRUCTIONS':
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Instructions to Candidates:", bold: true, font })
                            ],
                            spacing: { before: 200 }
                        })
                    );
                    block.content.items?.forEach((item: string) => {
                        children.push(
                            new Paragraph({
                                bullet: { level: 0 },
                                children: [new TextRun({ text: item, font })],
                                spacing: { after: 50 }
                            })
                        );
                    });
                    break;

                case 'PAGE_BREAK':
                    children.push(new Paragraph({ children: [new PageBreak()] }));
                    break;
            }
        });

        const doc = new Document({
            styles: {
                default: {
                    document: {
                        run: {
                            size: theme.fontSize * 2,
                            font: font
                        }
                    }
                }
            },
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: theme.margins.top * 567, // converted from cm to twips approx
                            bottom: theme.margins.bottom * 567,
                            left: theme.margins.left * 567,
                            right: theme.margins.right * 567,
                        }
                    }
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: "Page ", font, size: 28 }),
                                    new TextRun({ children: ["PAGE_NUMBER"], font, size: 28 }),
                                    new TextRun({ text: " of ", font, size: 28 }),
                                    new TextRun({ children: ["NUM_PAGES"], font, size: 28 }),
                                ],
                            }),
                        ],
                    }),
                },
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${exam.metadata.title || 'Exam'}.docx`);
    }
}
