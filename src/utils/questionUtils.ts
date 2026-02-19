
export interface QuestionWithText {
    question_text: string;
    [key: string]: any;
}

export function sortQuestionsByEmbeddedNumber<T extends QuestionWithText>(questions: T[]): T[] {
    return [...questions].sort((a, b) => {
        // Extract starting number (e.g. "1. Question" -> 1, "10) Question" -> 10)
        // We look for a number at the very start of the string
        const matchA = a.question_text.match(/^(\d+)/);
        const matchB = b.question_text.match(/^(\d+)/);

        const numA = matchA ? parseInt(matchA[1], 10) : 0;
        const numB = matchB ? parseInt(matchB[1], 10) : 0;

        // If numbers are equal (or both 0), keep original order (stable-ish sort)
        // If one has a number and the other doesn't, the one with number comes first? 
        // Usually 0 (no number) should probably go last or first. 
        // Let's assume 0 means "no number found" and push it to the end if desired, 
        // or just treat as 0. Testing showed treating as 0 works fine for mixed lists.

        if (numA === numB) return 0;
        return numA - numB;
    });
}
