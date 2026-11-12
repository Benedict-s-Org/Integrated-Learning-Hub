# Notion database creation prompts (Learning System)

Paste the block below into Notion AI. It creates the **micro-skills** database only (6 properties). SRS and Proofreading databases stay as they are.

## Micro-skills (minimum)

```
Create a new Notion database named "Learning System Micro-skills".

Create ONLY these 6 properties. Do not add any other property, relation, rollup, formula, or linked database.

1. Name — Title. Human-readable skill name, for example "modal can + bare infinitive".
2. ID — Text. Permanent skill id, for example "ms_modal_can_bare_infinitive_01". This value must never change when the name changes.
3. Measures — Text. One or two sentences: what a correct answer must do. This text is also the student tip after a set.
4. Year — Select. Options exactly: 1, 2, 3, 4, 5, 6. The school year when this skill is first taught.
5. Boundary — Text. One sentence saying what this skill does not include.
6. Longman — Text. Book references only, for example "M11.2" or "M11.3, M11.6". Plain text, not a relation.

Leave the database empty. Do not add sample rows. Do not add views beyond the default table.
```
