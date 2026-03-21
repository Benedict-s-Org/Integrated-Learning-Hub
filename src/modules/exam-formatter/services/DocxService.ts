import { 
    Document, 
    Packer, 
    Paragraph, 
    TextRun, 
    AlignmentType, 
    HeadingLevel,
    PageBreak,
    BorderStyle
} from 'docx';
import { saveAs } from 'file-saver';
import { ExamDocument, Template } from '../types';

export class DocxService {
    static async generate(exam: ExamDocument, template: Template) {
        const { theme } = template;
        
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
                                new TextRun({ text: "Name: ______________________", italics: true }),
                                new TextRun({ text: "\t\tClass: ______________________", italics: true }),
                            ],
                            spacing: { after: 200 }
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Date: ______________________", italics: true }),
                                new TextRun({ text: "\t\tDuration: ___________________", italics: true }),
                            ],
                            spacing: { after: 800 }
                        })
                    );
                    break;

                case 'SECTION_HEADER':
                    children.push(
                        new Paragraph({
                            text: block.content.title?.toUpperCase() || 'SECTION',
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 400, after: 200 },
                            border: {
                                bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: "000000" }
                            }
                        })
                    );
                    if (block.content.description) {
                        children.push(
                            new Paragraph({
                                text: block.content.description,
                                spacing: { after: 200 }
                            })
                        );
                    }
                    break;

                case 'QUESTION':
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${index}. `, bold: true }),
                                new TextRun({ text: block.content.stem || '', bold: !!block.content.bold }),
                                ...(block.content.marks ? [
                                    new TextRun({ text: `\t[${block.content.marks}]`, bold: true, underline: {} })
                                ] : [])
                            ],
                            spacing: { before: 200, after: 100 }
                        })
                    );
                    
                    if (block.content.options) {
                        block.content.options.forEach((opt: string, i: number) => {
                            children.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: `   ${String.fromCharCode(65 + i)}. `, bold: true }),
                                        new TextRun({ text: opt })
                                    ],
                                    spacing: { after: 50 }
                                })
                            );
                        });
                    }
                    break;

                case 'INSTRUCTIONS':
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: "Instructions to Candidates:", bold: true })
                            ],
                            spacing: { before: 200 }
                        })
                    );
                    block.content.items?.forEach((item: string) => {
                        children.push(
                            new Paragraph({
                                text: item,
                                bullet: { level: 0 },
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
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${exam.metadata.title || 'Exam'}.docx`);
    }
}
