-- Seed default homework habit options
INSERT INTO homework_problem_options (label, category)
SELECT label, category FROM (
    VALUES 
        ('Re-correction', 'Writing Habits'),
        ('Poor Handwriting', 'Writing Habits'),
        ('Missing Punctuation', 'Grammar & Mechanics'),
        ('Misspelt Words', 'Grammar & Mechanics'),
        ('Verb Tenses', 'Grammar & Mechanics'),
        ('Prepositions', 'Grammar & Mechanics'),
        ('Subject-Verb Agreement', 'Grammar & Mechanics'),
        ('Article Usage', 'Grammar & Mechanics'),
        ('Capitalization', 'Grammar & Mechanics'),
        ('Sentence Structure', 'Grammar & Mechanics')
) AS t(label, category)
WHERE NOT EXISTS (
    SELECT 1 FROM homework_problem_options WHERE label = t.label
);
