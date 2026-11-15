# DEPENDENCIES — pinned framework & native deps (todo 15)

The two dependencies that were previously floating on `…/tarball/main` are now
pinned to **immutable commit tarballs**, and a committed `package-lock.json`
makes installs reproducible.

## Pinned dependencies

| package   | repo                         | pinned commit (main)                    | resolved | tarball |
|-----------|------------------------------|-----------------------------------------|----------|---------|
| `meowsab` | `deveni0/ws`                 | `446bc68b8a0bade128bfbea224e33dc552ebc10b` | `1.0.2`  | `https://github.com/deveni0/ws/archive/446bc68b8a0bade128bfbea224e33dc552ebc10b.tar.gz` |
| `sharp`   | `deveni0/sharp-tmx`          | `67f11b2c6176c50cd9beb821f10c7fd50dc8459e` | `0.34.5` | `https://github.com/deveni0/sharp-tmx/archive/67f11b2c6176c50cd9beb821f10c7fd50dc8459e.tar.gz` |

Both the `dependencies` and the `overrides` blocks (`overrides.sharp` and
`overrides["*"].sharp`) point at the same pinned `sharp` tarball, so a nested
`sharp` can never float back to `main`.

The `meowsab` version the runtime shield relies on is **1.0.2** (commit
`446bc68`). The shield is the second layer over this pinned code — it is **not**
removed by this change.

## Runtime shield (BOT_SHIELD) — one-line note

> The pinned `meowsab@1.0.2` (`dist/index.cjs`) still contains the watermark /
> ban-check strings the shield neutralises — `KeysMessageWA` (×2), `keyCore1`
> (×5), `keyCore2` (×2), `keysMessagesObjWA` (×5) — and still exposes
> `sendButtonNormal`, so `Utils.keyCore1/keyCore2/keysMessagesObjWA` stubbing and
> the `globalThis.eval` kill-switch guard in `index.js` stay armed.

Verified against the **pinned archive tarball** (not just the installed copy):
the extracted `dist/index.cjs` from
`archive/446bc68…tar.gz` carries exactly those strings and the framework surface
`Client` / `Utils` / `Convert` / `Scrapy` / `SubBots`. `tests/unit.task-15.test.mjs`
locks this in (plus a vm test that the guarded `eval` refuses a payload decoding
to `process.exit(0)`, and that a failed shield install raises a `shield` event
instead of being swallowed). Toggle with `BOT_SHIELD=0` (still works).

## Reproducible installs

`package-lock.json` is committed. On a fresh host:

```bash
npm ci          # installs exactly the pinned tree (meowsab/sharp at the SHAs above)
```

`npm ci --dry-run` validates the lockfile against `package.json` (exit 0).

> Note: inside this repo's worktrees `node_modules` is a symlink into the main
> checkout, so `npm ls --depth=0` there reports the pre-lockfile install as
> "extraneous". That is an artifact of the symlink, not of the pin; a real host
> after `npm ci` is clean.

## Experimental protocol surfaces (EXPERIMENTAL_PROTOCOLS)

The framework's own interactive-button enum (`meowsab/dist/index.cjs`, `Ue`)
accepts exactly six names:

```
quick_reply · cta_url · cta_call · cta_copy · single_select · call_permission_request
```

The upstream fork also ships a Pix-copy button named `cta_pix_code_copy` and a
payment note labelled `payment_info`. **Neither is a member of that enum**, so
neither can be shipped as-is; implementing them would require a hand-built relay
that bypasses the framework's schema, which is explicitly rejected here.

`plugins/native/experimental.js` therefore ships the one experimental surface the
schema does accept — a `call_permission_request` button — and it is **OFF by
default**. It only emits a native message when the operator sets:

```bash
export EXPERIMENTAL_PROTOCOLS=1   # restart after setting
```

With the flag unset (or `0`) the plugin replies in Arabic and sends nothing. The
two rejected fork surfaces are deliberately omitted, not forgotten:

- `cta_pix_code_copy` — invalid enum name; needs a hand-built relay.
- `payment_info` — invalid label, and its note carries a foreign
  `transactionData` blob plus a third-party bank account, so it is never
  reproduced.

No experimental surface embeds any foreign key, account, or third-party media.

## Rotating the pin (procedure)

1. Resolve the new `main` commit:
   `gh api repos/deveni0/ws/commits/main --jq .sha` (and `…/sharp-tmx/…`).
2. Update `dependencies` **and** both `overrides` entries in `package.json` to
   `https://github.com/deveni0/<repo>/archive/<sha>.tar.gz`.
3. Regenerate the lockfile (never a full install):
   `npm install --package-lock-only --ignore-scripts`
   (build it in a dir without `node_modules` so no symlink `link:` entries leak in).
4. Re-verify the shield strings in the new `dist/index.cjs`
   (`KeysMessageWA`, `keyCore1`, `keyCore2`, `keysMessagesObjWA`, `sendButtonNormal`);
   if the new build dropped them, the shield's watermark check would fail — keep the
   pin and treat a failed shield install as LOUD (it already raises a `shield` event).
5. Commit `package.json` + `package-lock.json`.

`system/autoUpdate.mjs` skips `node_modules`, so hosts keep their installed copy
until they reinstall — a pinned tarball URL is a drop-in for a fresh install, and
the shield keeps protecting the already-installed copy in the meantime.