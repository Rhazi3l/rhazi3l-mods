# Dashboards on a host with a page check

Some hosts build the dashboard from a page plus a data store, and check the page. These rules came from one such host and have not been checked against its documentation. If the host's own guidance says otherwise, follow the host.

- Do work on a copy when the user has one. Do not touch the original.
- Do make the audit and passes as text edits to the page, with asserted replacements, so a missed target fails loudly. Check the script with `node --check` before publishing.
- Do pin every write to the version you last read, and re-read the version before a second write.
- Do follow the script rules of a one-writer page. Outside a drawing, a script may only set `class`, `style`, `hidden`, `open`, `disabled`, `checked`, `selected`, `value`, `tabindex` and `aria-*`. Text that depends on data lives in elements marked as drawings and stored empty. Drawings must not be nested, and a drawing inside a hidden element does not run, so show or hide optional sections from the data callback.
- Do treat the look (colours per mode, charts in order) as its own document. A whole replacement clears tweaks, and a partial update replaces the nested mode object, so send the complete dark or light object.
- Do check, after publishing, that every chart colour slot shows the colour you chose. A colour too close to an earlier one can be replaced by the host's default. In one host, pairs near 20 apart in CIE Lab were replaced and pairs near 24 were kept, so keep at least about 30.
- Do use the host's own sans family where it provides one. On the Dashboard artifact type this was the `--font-anthropic-sans` token. A system monospace stack differs across Windows, Mac and Linux, and a host mono token may not take effect.
- Do read the page check after publishing. If no tab has the dashboard open, there is no result, so say that and do not claim a pass.
- Do use a real clock for edit timestamps.
