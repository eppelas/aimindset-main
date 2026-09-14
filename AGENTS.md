<!-- AIM MANDATORY INSTRUCTIONS: START -->
# READ FIRST — MANDATORY INSTRUCTIONS

Before any work, read [MANDATORY_INSTRUCTIONS.md](MANDATORY_INSTRUCTIONS.md). It is the linked, parent-owned contract for this repository, not optional onboarding.
Ordinary page work never authorizes changes to the structure, content, links, order or actions of the shared top-level menu, footer or learning elements. Use only allowed theme settings for that shared shell. The optional page-specific submenu belongs to this page; its presence, items, labels, links and order may change within the page task. Do not edit this instruction mirror or bypass its checks.
<!-- AIM MANDATORY INSTRUCTIONS: END -->

# Wild source ownership

- Work in this original checkout. Read README and the current source before changing it.
- `src/page/index.html`, its ordered CSS/runtime includes and `src/content/main.json` are the editable homepage source. Root `index.html` is generated. Preserve all user changes in these sources before building.
- Shared top-level navigation, footer and learning semantics belong to `eppelas/aim-web-platform`. Follow that repository's `skills/shared-content/SKILL.md` for an explicit shared-content request. Never patch their generated copies, change protected links through the page editor, or extract a new parent from a consumer build.
- `platform-dependency.json` pins the parent. A release records both source and parent SHA. Changing a pin requires component review and rebuilding all consumers.
- Preserve approved visuals, animation renderers, input behavior and legal text. Animation work should change scheduling/caching unless the user requests a visual change.
- Existing priority exceptions are in `important-budget.json`. Do not refresh the budget to silence failures. Remove obsolete exceptions; justify and review any newly required one.
- Public artifacts come from `tools/release/public_build.py`. Never publish the whole working folder or a Google HTML snapshot. Google keeps the existing public inline editor and version-checked publisher. Actions imports only approved text fields from a snapshot tied to an ancestor source commit; browser HTML/code never becomes GitHub source.
- Run the relevant source, component, editor and release checks; verify desktop/mobile behavior and public dependency closure. Keep backups and source-to-destination logs outside the public artifact.
- The source branch is `wild`. Remote `main` contains another homepage: update only its `wild/` artifact via the release tool. Do not force push, discard changes, or permanently delete files.
- CODEOWNERS and skills guide changes; they are not an access-control mechanism. Report missing repository protection or credentials explicitly.

## Page-local submenu

The submenu belongs to this page and may be absent. Its items, labels, links, order and presence may change within a page task through `src/site-sections.json`; no parent-content skill is needed. Google editing changes its visible labels only. A text save never changes section destinations, order or hidden items. This permission does not cover the shared top-level menu.

## Parent shell boundary

The complete header/footer renderer is parent-owned in `components/shell/runtime.js`. `src/site-sections.json` contains only validated page-local section links. The old `src/site-shell.js` is retained unchanged for recovery and is not a build input. Do not edit or reconnect that legacy file; generated output uses only the pinned parent renderer. Do not add DOM mutations to change menu/footer text, links, order or visibility. Release checks compare the final desktop/mobile DOM against the pinned parent, including mobile menu copies.

For a new independent page repository, follow the parent's `MANDATORY_INSTRUCTIONS.md` and `skills/connect-page/SKILL.md`; install its `templates/page/AGENTS.md`. Use its theme API for colors/sizes. An ordinary page task does not authorize a shared-content change; use the parent `skills/shared-content/SKILL.md` only for an explicit shared request.
