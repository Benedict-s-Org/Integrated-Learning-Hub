---
description: Codebase research protocol to save tokens and understand system logic
---

# Codebase Research Workflow

This workflow is strictly designed to save tokens and quickly orient the AI agent within the codebase before making changes.

## WHEN TO USE THIS WORKFLOW
To save tokens, do **NOT** read the manifest for every single request. 

**DO NOT read the manifest if:**
- You are making a simple UI tweak (e.g., changing a button color).
- You are fixing a typo or minor logic bug in a file you already know.
- The user points you directly to the exact file and line number.

**DO read the manifest if:**
- You are starting a brand new task in a new chat session.
- You are touching core logic (e.g., coins, auth, users).
- You are adding a feature that interacts across multiple unknown files/components.

---

## Step 1: Read the Manifest Index
If the conditions above indicate you need research, you MUST read the first 30-50 lines of the codebase manifest to understand the high-level architecture and find line ranges for detailed features.

Use the `view_file` tool to read the index:
`AbsolutePath`: `[project_root]/.agent/codebase_manifest.md`
`StartLine`: 1
`EndLine`: 50

## Step 2: Read Specific Details
If the feature you are working on is listed in the index, use the provided line range to read ONLY that specific section of the manifest using `view_file` with the precise `StartLine` and `EndLine`. 

DO NOT read the entire manifest file.

## Step 3: Proceed with Source Code
Once you have retrieved the high-level logic from the manifest, proceed with analyzing the actual source code (`.tsx`, `.ts`, `.sql`) using `grep_search` or `view_file_outline` as usual, but now equipped with the architectural context.

## Step 4: Maintenance (After Changes)
If you add a new page, service, or major database schema during your task, you MUST update `.agent/codebase_manifest.md` before finishing the conversation. 
1. Add a brief entry to the Index table.
2. Add a detailed section at the bottom of the file.
3. Update the line numbers in the Index if necessary.
