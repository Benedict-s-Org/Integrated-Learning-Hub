
export interface QuestionWithText {
    question_text?: string;
    question?: string;
    [key: string]: any;
}

export function sortQuestionsByEmbeddedNumber<T extends QuestionWithText>(questions: T[]): T[] {
    return [...questions].sort((a, b) => {
        const textA = a.question_text || a.question || '';
        const textB = b.question_text || b.question || '';

        const matchA = textA.match(/^(\d+)/);
        const matchB = textB.match(/^(\d+)/);

        const numA = matchA ? parseInt(matchA[1], 10) : 0;
        const numB = matchB ? parseInt(matchB[1], 10) : 0;

        if (numA === numB) return 0;
        return numA - numB;
    });
}
