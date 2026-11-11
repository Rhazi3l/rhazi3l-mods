# Dashboards on a host with a page check

Some hosts build the dashboard from a page plus a data store, and check the page. These rules came from one such host and have not been checked against its documentation. If the host's own guidance says otherwise, follow the host.

- Work on a copy when the user has one. Never touch the original.
- Do the audit and the passes as text edits to the page, with asserted replacements, so a missed target fails loudly. Check the script with `node --check` before publishing.
- Pin every write to the version you last read, and re-read the version before a second write.
- Script rules on a one-writer page: outside a drawing, a script may only set `class`, `style`, `hidden`, `open`, `disabled`, `checked`, `selected`, `value`, `tabindex` and `aria-*`. Text that depends on data lives in elements marked as drawings and stored empty. Drawings must not be nested, and a drawing inside a hidden element does not run, so show or hide optional sections from the data callback.
- The look (colours per mode, charts in order) is its own document. A whole replacement clears tweaks, and a partial update replaces the nested mode object, so send the complete dark or light object.
- Read the page check after publishing. If no tab has the dashboard open, there is no result, so say that and do not claim a pass.
- Use a real clock for edit timestamps.
