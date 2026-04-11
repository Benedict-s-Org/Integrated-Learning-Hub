-- Update the Welcome & Consent content with the new draft
INSERT INTO app_content (key, content, description, updated_at)
VALUES (
  'anagram_welcome',
  '{
    "title": "Cognitive Task Experiment",
    "subtitle": "Things Are Harder Than They Seem: Self vs. Other Predictions",
    "study_info_title": "📋 Study Information",
    "study_info_items": [
      "You will complete <em>two sets of anagram puzzles</em>—rearranging scrambled letters to form English words.",
      "Before each set, you will be asked to <em>predict how many seconds</em> it will take you to complete each puzzle.",
      "Each set has 10 puzzles. You have up to <strong>5 attempts</strong> per puzzle. If you cannot solve it, you can <em>skip</em>.",
      "<strong>Timing:</strong> Typically <em>does not exceed 20 minutes</em> in total. For each puzzle, you may set your own <em>time limit</em> (if you choose).",
      "<strong>Voluntary Participation:</strong> Participation is <em>voluntary</em>. You may stop at any time. <em>If you leave early, your responses will not be saved.</em>"
    ],
    "notes_title": "⚠️ Important Notes & Consent",
    "notes_items": [
      "<strong>Data:</strong> We record predicted time, actual time, attempts, answer, and hints used. <strong>No</strong> name, student ID, or IP are collected.",
      "<strong>Minimal Risk:</strong> You may experience mild frustration. You may take a break or stop at any time.",
      "<strong>Confidentiality:</strong> Responses are for <em>research purposes only</em> and reported in <em>aggregate form</em>.",
      "<strong>Eligibility:</strong> By participating, you confirm that you are <strong>18 years old or above</strong>.",
      "<strong>Contact:</strong> Researcher (chunfungtsang@ln.hk) or supervisor (kelvinlui@ln.edu.hk)"
    ],
    "consent_text": "I have read and understood the information above, and I agree to participate in this study.",
    "start_button_text": "I Agree & Start →",
    "group_label": "Your assigned group:",
    "predict_self_text": "You will predict for \"yourself\"",
    "predict_other_text": "You will predict for \"other students\""
  }'::jsonb,
  'Updated Welcome & Consent content based on new draft',
  now()
)
ON CONFLICT (key) DO UPDATE
SET 
  content = EXCLUDED.content,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;
