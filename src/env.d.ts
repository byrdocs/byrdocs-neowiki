/// <reference types="astro/client" />

type ExamChoiceRevealMode = "answers" | "checked";

interface ExamChoiceState {
    selected: string[];
    revealed: boolean;
    mode?: ExamChoiceRevealMode;
}

interface ExamStateData {
    blanks: Record<string, true>;
    solutions: Record<string, true>;
    choices: Record<string, ExamChoiceState>;
}

interface ExamStateController {
    read: () => ExamStateData;
    update: (updater: (state: ExamStateData) => ExamStateData) => ExamStateData;
    sync: () => void;
    toggleAll: () => void;
    getAllShown: () => boolean;
    hasRevealable: () => boolean;
    events: {
        change: string;
        setAll: string;
    };
}

interface Window {
    __examState?: ExamStateController;
}
