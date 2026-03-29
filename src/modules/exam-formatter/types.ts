export type BlockType = 
    | 'COVER'
    | 'INSTRUCTIONS'
    | 'SECTION_HEADER'
    | 'READING_PASSAGE'
    | 'GRID_LAYOUT'
    | 'QUESTION'
    | 'SUBQUESTION'
    | 'MCQ_OPTIONS'
    | 'MARKS'
    | 'ANSWER_LINES'
    | 'STIMULUS_BOX'
    | 'PAGE_BREAK'
    | 'END_PAPER';

export interface Block {
    id: string;
    type: BlockType;
    content: any; // e.g., stem, options[], answerIndex, marks, mcqStyle, mcqColumns, hangingIndent, questionType, gridData
    settings?: Record<string, any>;
    styleOverrides?: Record<string, any>;
    sourceRef?: {
        notionId: string;
        lastEditedTime: string;
    };
}

export interface ExamMetadata {
    title: string;
    subject: string;
    date: string;
    duration: string;
    totalMarks: number;
    version: string;
}

export interface ExamDocument {
    metadata: ExamMetadata;
    templateId: string;
    blocks: Block[];
}

export interface ThemeConfig {
    pageSize: 'A4' | 'LETTER';
    fontFamily: string; // 'serif' | 'sans-serif' | 'monospace' | 'pmingliu'
    fontSize: number;
    headerEnabled: boolean;
    footerEnabled: boolean;
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    typography: {
        paragraphSpacing: number;
        lineHeight: number;
    };
}

export interface Template {
    id: string;
    name: string;
    theme: ThemeConfig;
    presets: Record<string, any>;
}
