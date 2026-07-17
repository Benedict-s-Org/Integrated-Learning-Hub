# L6A Design Review Report

**Status:** NEEDS REVISION

## Checklist Evaluation

1. **Confirm L6A is design-only and does not authorize implementation:** PASS. The design clearly states it is for defining architecture for phase L6B.
2. **Confirm L6B must not start until L6A review is approved:** PASS. Addressed in Section 7 of the design.
3. **Confirm convert is treated as higher risk than scan-only:** PASS. Acknowledged in Section 1 ("consumes significant compute resources", "modifies local disk state").
4. **Confirm the design preserves the local-first boundary:** PASS.
5. **Confirm Learning Hub will not receive raw document content:** PASS. Addressed in Threat Model table.
6. **Confirm Learning Hub will not receive raw markdown output by default:** PASS.
7. **Confirm Learning Hub will not receive filenames, local paths, job IDs, OCR text, AI review comments, or raw manifest data by default:** FAIL. The design mentions no paths, filenames, or file contents, but misses explicitly prohibiting job IDs, OCR text, AI review comments, and raw manifest data from responses.
8. **Confirm the proposed convert endpoint is a controlled wrapper, not a direct passthrough:** PASS. Addressed in Section 5.1.
9. **Confirm job_type is allowlisted:** FAIL. The design proposes `{"confirm": true}` but omits an explicit `job_type` parameter (e.g., `{"job_type": "convert"}`) and its allowlist validation.
10. **Confirm request values use POST body only, not query strings:** PASS.
11. **Confirm no arbitrary command execution is allowed:** PASS.
12. **Confirm no shell commands are constructed from frontend input:** PASS.
13. **Confirm input_path and output_path handling has clear validation rules:** PASS (Backend uses hardcoded paths, rejecting frontend inputs).
14. **Confirm output overwrite behavior is addressed:** PASS.
15. **Confirm whether timestamped run folders, empty output folder requirement, or overwrite confirmation is recommended:** FAIL. The design leaves the strategy ambiguous ("either by cleanly overwriting... or generating new output directories"). A concrete recommendation is needed.
16. **Confirm user confirmation is required before conversion:** PASS.
17. **Confirm stronger warning copy is required than scan-only:** FAIL. Mentions a warning, but needs to explicitly mandate stronger copy than the scan-only equivalent.
18. **Confirm successful response is sanitized and aggregate-only:** PASS.
19. **Confirm error responses use predefined safe error codes only:** PASS.
20. **Confirm no raw exception messages, stack traces, paths, filenames, or document excerpts are returned:** PASS.
21. **Confirm no Supabase write/import is included:** FAIL. Not explicitly excluded.
22. **Confirm no Learning Hub import is included:** FAIL. Not explicitly excluded.
23. **Confirm no OCR or AI review is included:** FAIL. Not explicitly excluded.
24. **Confirm no GitHub API usage is included:** FAIL. Not explicitly excluded.
25. **Confirm CORS remains strict local-only:** PASS.
26. **Confirm credentials remain disabled:** FAIL. Not explicitly confirmed.
27. **Confirm no wildcard or public LAN origins are allowed:** PASS.
28. **Confirm frontend sensitive path inputs remain volatile React state only:** PASS.
29. **Confirm paths are not stored in localStorage, sessionStorage, URL params, Supabase, analytics, logs, or durable storage:** FAIL. Mentions local/session storage but omits analytics, logs, URL params, and Supabase.
30. **Confirm the design defines L6C Security / QA Review requirements after L6B:** PASS.

---

## Findings

### Critical
*None.*

### High
- **Missing Explicit Prohibitions in Responses:** The design must explicitly confirm that Learning Hub will not receive `job IDs`, `OCR text`, `AI review comments`, or `raw manifest data` by default (Checklist #7).
- **Missing `job_type` Allowlist:** The design lacks an explicit `job_type` allowlist parameter for the wrapper endpoint (Checklist #9).
- **Missing Out-of-Scope Explicit Exclusions:** The design does not explicitly prohibit Supabase write/import, Learning Hub import, OCR/AI review, and GitHub API usage for this phase (Checklist #21, #22, #23, #24).

### Medium
- **Ambiguous Overwrite Strategy:** Output overwrite behavior (#15) needs a firmer recommendation (e.g., explicitly recommending timestamped run folders or an empty output folder requirement) rather than leaving it open to interpretation.
- **Credentials & Logging Constraints:** The design should explicitly confirm credentials remain disabled (#26). The guardrails for not storing paths should explicitly extend to URL params, Supabase, analytics, logs, and durable storage (#29), beyond just `localStorage` and `sessionStorage`.

### Low
- **Warning Copy Strength:** The confirmation copy requirement (#17) should explicitly state that the warning copy must be *stronger* than the scan-only warning.

### Notes
- The rest of the design correctly adheres to L5A roadmap principles (local-first boundary, strict CORS, no path inputs, no arbitrary shell execution).

---

## Required Design Changes
To pass the review, the following updates must be applied to `l6a_controlled_convert_security_design.md`:
1. Update Section 3 (Threat Model) to explicitly list the prohibited data returns: no job IDs, OCR text, AI review comments, or raw manifest data.
2. Update Section 2.1 to include an explicit `job_type` payload (e.g., `{"job_type": "convert", "confirm": true}`) and mandate that the backend allowlists this value.
3. Add a new section or update existing guardrails to explicitly list the out-of-scope items: no Supabase imports, no Learning Hub imports, no OCR/AI reviews, no GitHub API usage, and no credentials required/used.
4. Specify the exact output overwrite strategy (e.g., strictly use timestamped run folders or fail if the target directory is not empty).
5. Update Sections 4 & 5 to explicitly mention that paths must not be stored in URL params, analytics, or logs.
6. Explicitly state that the frontend warning copy must be stronger/more explicit than the scan-only variant.

## Final Recommendation
**Revise L6A.** Do not proceed to L6B until the requested revisions are incorporated into the L6A design and it passes a follow-up review.
