# Wild source ownership

- Work in this original checkout. Read README and the current source before changing it.
- `src/page/index.html`, its ordered CSS/runtime includes and `src/content/main.json` are the editable homepage source. Root `index.html` is generated. Preserve all user changes in these sources before building.
- Navigation, footer and learning semantics belong to `eppelas/aim-web-platform`. Follow that repository's `skills/shared-content/SKILL.md` for an explicit shared-content request. Never patch their generated copies, change protected links through the page editor, or extract a new parent from a consumer build.
- `platform-dependency.json` pins the parent. A release records both source and parent SHA. Changing a pin requires component review and rebuilding all consumers.
- Preserve approved visuals, animation renderers, input behavior and legal text. Animation work should change scheduling/caching unless the user requests a visual change.
- Existing priority exceptions are in `important-budget.json`. Do not refresh the budget to silence failures. Remove obsolete exceptions; justify and review any newly required one.
- Public artifacts come from `tools/release/public_build.py`. Never publish the whole working folder or a Google HTML snapshot. Google keeps the existing public inline editor and version-checked publisher. Actions imports only approved text fields from a snapshot tied to an ancestor source commit; browser HTML/code never becomes GitHub source.
- Run the relevant source, component, editor and release checks; verify desktop/mobile behavior and public dependency closure. Keep backups and source-to-destination logs outside the public artifact.
- The source branch is `wild`. Remote `main` contains another homepage: update only its `wild/` artifact via the release tool. Do not force push, discard changes, or permanently delete files.
- CODEOWNERS and skills guide changes; they are not an access-control mechanism. Report missing repository protection or credentials explicitly.
