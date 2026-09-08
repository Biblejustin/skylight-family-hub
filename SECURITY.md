# Security and private data

This repository publishes application source and generic setup examples. It does not publish a configured household instance.

## Keep private

- `data/` in its entirety, including auth state, calendar credentials, exports, logs, member names and completion history.
- Display URLs, secret iCal addresses, shared photo album links, NAS credentials and session cookies.
- Uploaded photos, screenshots of real calendars, backups and migration archives.
- Android signing keys, generated APKs and local tooling caches.

The Git and Docker ignore files exclude these classes of artifacts. Ignore rules are not a substitute for reviewing `git diff --cached` before a push. A build image should contain only application code and empty example configuration; mount private data at runtime.

## Deployment boundaries

Use a trusted home LAN. Set an editor password before adding secrets. The default empty app has authentication disabled until a password is set. Do not forward its HTTP port from your router to the internet. For remote administration, use your existing VPN rather than publishing the app directly.

Secret iCal URLs grant read access to anyone who holds them. Public Apple Shared Album URLs grant access to their photos. Display tokens grant broader read access than a screenshot: authenticated display clients can receive calendar configuration. Keep those URLs out of screenshots, Git issues, and logs you share publicly.

Chore checkoffs and reward redemption are household interactions, not a tamper-proof accounting system. A person chooser does not authenticate that person.

Keep complete private backups before updating or migrating. Do not run two writable instances against the same files. Update the Docker image from this fork's source; upstream in-app system upgrades are not this deployment's update mechanism.

## Reporting

Do not include personal data or working credentials in public issues. Provide a minimal example with invented people/events and redacted URLs. If a secret was published, rotate it at its provider; deleting the latest file alone does not remove Git history.

## Display page authentication

With a parent password enabled, both `/display` and `/display/<id>` require a valid display token or parent session before returning private configuration or display credentials. Empty installations remain open until a password is set. Earlier versions inherited an upstream page route that rendered credentials without authenticating the visitor; update existing deployments to the corrected version. A trusted LAN remains the deployment boundary.
