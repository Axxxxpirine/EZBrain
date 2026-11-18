# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository. You will get an answer there.

## What to know before you deploy

EZBrain is two things with very different exposure:

- **The memory** is a local git repository of Markdown files. It has no network surface. The only risk is
  pushing it somewhere public by mistake: install the `pre-push` hook (see the README) and keep your memory
  in its own folder, outside your clone of this repository.
- **The Hub** is an optional read-only web app. It has no login of its own. In `auth.mode: tailscale` it trusts
  the `Tailscale-User-Login` header that `tailscale serve` adds to each request. This is only safe when the Hub
  listens on `127.0.0.1` (the default) and is reached exclusively through `tailscale serve`. If you bind it to
  another interface or put a different proxy in front of it, anyone who can reach the port can forge that header.
- `auth.mode: none` is for local development only. Never use it on a machine other people can reach.
- Set `auth.allowedLogins` if your tailnet has more than one user: when the list is empty, every member of the
  tailnet can read the whole memory.

## Never commit

Your real memory, `config.yaml`, logs, or anything from your own machines. This repository only contains the
method, the code and fictional example notes.

## Known advisory in the build tooling

`npm audit` in `hub/` reports `picomatch` ([GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)),
a dependency of Vite. No patched version exists upstream as of 2026-11-18. It does not affect a deployed Hub:

- it is a development dependency, not installed on the server (`deploy/deploy.sh` runs `npm ci --omit=dev`, and
  `npm audit --omit=dev` reports no vulnerability);
- it only processes glob patterns from this project's own build configuration, never user input.

It will be updated as soon as a fixed version is published.
