import type { FormDefinition } from "../types/forms";

export const DEFAULT_WELCOME_CONSENT_FORM: FormDefinition = {
  title: "Cognitive Task Experiment",
  description: "Things Are Harder Than They Seem: Self vs. Other Predictions",
  theme: { primary: "#4285f4" },
  navigation: { mode: "sections" },
  sections: [
    {
      id: "info",
      nextButtonText: "I've read this",
      items: [
        {
          type: "info",
          id: "study_info",
          html: `<h3 style="font-size:16px;font-weight:600;margin-bottom:8px;">📋 Study Information</h3>
<ul style="margin:0;padding-left:20px;line-height:1.8;">
  <li>You will complete two sets of <strong>anagram puzzles</strong> — rearranging scrambled letters to form English words.</li>
  <li>Before each set, you will be asked to <strong>predict how many seconds</strong> it will take to complete each puzzle.</li>
  <li>Each set has <strong>10 puzzles</strong>. You have up to <strong>5 attempts</strong> per puzzle. If you can't solve it, you can skip.</li>
</ul>
<div style="margin-top:12px;padding:10px 14px;background:#e8f0fe;border-radius:8px;font-size:13px;">
  ⚠️ <strong>Important:</strong> Each timer starts when you see the puzzle. Your data will be used for research purposes only.
</div>`,
        },
      ],
    },
    {
      id: "consent",
      items: [
        {
          type: "consent",
          id: "consent_agree",
          label: "I understand the study and agree to participate",
          required: true,
        },
      ],
    },
  ],
};

export const DEFAULT_DEMOGRAPHICS_FORM: FormDefinition = {
  title: "Background Information",
  description: "Please provide some basic information before we begin.",
  theme: { primary: "#4285f4" },
  sections: [
    {
      id: "demographics",
      items: [
        {
          type: "short_text",
          id: "nickname",
          title: "Nickname / Alias",
          required: true,
          placeholder: "Enter a nickname",
        },
        {
          type: "number",
          id: "age",
          title: "Age",
          required: true,
          min: 1,
          max: 120,
          placeholder: "Enter your age",
        },
        {
          type: "multiple_choice",
          id: "gender",
          title: "Gender",
          required: true,
          options: ["Male", "Female", "Other"],
        },
        {
          type: "multiple_choice",
          id: "education",
          title: "Education Level",
          required: true,
          options: [
            "Secondary school",
            "Undergraduate student",
            "Bachelor's degree",
            "Master's student / degree",
            "PhD student / degree",
            "Other",
          ],
        },
        {
          type: "multiple_choice",
          id: "english_proficiency",
          title: "English Proficiency",
          required: true,
          options: [
            "Native speaker",
            "Advanced (C1–C2)",
            "Upper-intermediate (B2)",
            "Intermediate (B1)",
            "Elementary (A2)",
            "Beginner (A1)",
          ],
        },
      ],
    },
  ],
};

export const DEFAULT_PRED_TASK1_FORM: FormDefinition = {
  title: "Time Prediction – Task 1 (Easy)",
  description:
    "You will solve 10 anagram puzzles (3 warm-up + 7 easy). Before you begin, predict how long each puzzle will take.",
  theme: { primary: "#4285f4" },
  sections: [
    {
      id: "prediction",
      items: [
        {
          type: "info",
          id: "task_info",
          html: `<div style="padding:12px 16px;background:#e8f0fe;border-radius:8px;">
  <strong>Task 1 (Easy)</strong> — 10 anagrams with short words (3–4 letters each)
</div>`,
        },
        {
          type: "number",
          id: "prediction_seconds",
          title: "How many seconds do you think it will take to solve each puzzle?",
          required: true,
          min: 1,
          max: 600,
          placeholder: "Enter seconds per puzzle",
        },
      ],
    },
  ],
};

export const DEFAULT_PRED_TASK2_FORM: FormDefinition = {
  title: "Time Prediction – Task 2 (Hard)",
  description:
    "You will solve 10 harder anagram puzzles. Before you begin, predict how long each puzzle will take.",
  theme: { primary: "#4285f4" },
  sections: [
    {
      id: "prediction",
      items: [
        {
          type: "info",
          id: "task_info",
          html: `<div style="padding:12px 16px;background:#e8f0fe;border-radius:8px;">
  <strong>Task 2 (Hard)</strong> — 10 anagrams with longer words (5–7 letters each)
</div>`,
        },
        {
          type: "number",
          id: "prediction_seconds",
          title: "How many seconds do you think it will take to solve each puzzle?",
          required: true,
          min: 1,
          max: 600,
          placeholder: "Enter seconds per puzzle",
        },
      ],
    },
  ],
};

export const DEFAULT_POSTSURVEY_FORM: FormDefinition = {
  title: "Post-Task Questionnaire",
  description:
    "Please answer the following questions honestly. There are no right or wrong answers.",
  theme: { primary: "#673ab7" },
  navigation: { mode: "sections" },
  sections: [
    {
      id: "scales",
      title: "Part 1: Personality & Thinking Styles",
      items: [
        {
          type: "linear_scale",
          id: "optimism1",
          title: "I generally expect things to go well for me.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
        {
          type: "linear_scale",
          id: "optimism2",
          title: "I rarely expect things to work out the way I want them to.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
        {
          type: "linear_scale",
          id: "optimism3",
          title: "I'm always optimistic about my future.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
        {
          type: "info",
          id: "nfc_spacer",
          html: "<hr style='margin:16px 0; border: none; border-top: 1px solid #e0e0e0;' />",
        },
        {
          type: "linear_scale",
          id: "nfc1",
          title: "I enjoy tasks that require a lot of thinking.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
        {
          type: "linear_scale",
          id: "nfc2",
          title: "I prefer complex problems over simple ones.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
        {
          type: "linear_scale",
          id: "nfc3",
          title: "Thinking hard and for a long time is not my idea of fun.",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Strongly Disagree",
          maxLabel: "Strongly Agree",
        },
      ],
    },
    {
      id: "perception_and_experience",
      title: "Part 2: Task Perception & Past Experience",
      items: [
        {
          type: "linear_scale",
          id: "task1Difficulty",
          title: "How difficult did you find Task 1 (3–4 letter words)?",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Very Easy",
          maxLabel: "Very Hard",
        },
        {
          type: "linear_scale",
          id: "task2Difficulty",
          title: "How difficult did you find Task 2 (5–7 letter words)?",
          required: true,
          min: 1,
          max: 7,
          minLabel: "Very Easy",
          maxLabel: "Very Hard",
        },
        {
          type: "info",
          id: "exp_spacer",
          html: "<hr style='margin:16px 0; border: none; border-top: 1px solid #e0e0e0;' />",
        },
        {
          type: "linear_scale",
          id: "pastAnagramExperience",
          title: "How often have you done word puzzles or anagram games before?",
          required: true,
          min: 1,
          max: 5,
          minLabel: "Never",
          maxLabel: "Very often",
        },
        {
          type: "linear_scale",
          id: "pastPsychExperience",
          title: "How often have you participated in psychology experiments before?",
          required: true,
          min: 1,
          max: 5,
          minLabel: "Never",
          maxLabel: "Very often",
        },
      ],
    },
    {
      id: "check_and_comments",
      title: "Part 3: Final Checks",
      items: [
        {
          type: "multiple_choice",
          id: "manipulationCheck",
          title: "When you made your time predictions, who did you predict for?",
          required: true,
          options: ["Myself", "Other students", "I'm not sure"],
        },
        {
          type: "paragraph",
          id: "comments",
          title: "Any comments or feedback? (optional)",
          required: false,
          placeholder: "Share any thoughts about the experiment...",
        },
      ],
    },
  ],
};
