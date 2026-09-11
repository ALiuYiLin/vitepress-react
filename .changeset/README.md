# Changesets

This folder holds the [changesets](https://github.com/changesets/changesets) that
describe upcoming releases of `@10coding/vitepress-react`. Changesets — not the
git history — owns the `version` field and `CHANGELOG.md`.

## Everyday commands

- `pnpm changeset` — record a change (pick the bump type, write a summary). The
  summary becomes the changelog entry.
- `pnpm changeset:status` — dry check: which packages would be bumped, and to
  which version, without touching any file.
- `pnpm changeset:version` — consume the pending changesets: bump `version` in
  `package.json` and prepend a changelog entry. Rarely needed by hand — the
  release scripts below run it for you.
- `pnpm changeset:publish` — publish whatever `package.json` currently holds and
  create the matching git tag. In pre mode it uses the dist-tag from `pre.json`,
  otherwise `latest`, unless `--tag <name>` is passed.

## Releasing an alpha: `pnpm release`

The one-command release. It runs, in order:

```sh
pnpm changeset:pre:enter     # changeset pre enter alpha
pnpm changeset:version       # 2.0.0-alpha.23 -> 2.0.0-alpha.24 + changelog entry
pnpm build                   # publishing does not build: dist/ is shipped as-is
pnpm changeset:pre:exit      # changeset pre exit (see below)
git add package.json CHANGELOG.md THIRD-PARTY-NOTICES.md .changeset
git commit -m "chore: release"
pnpm changeset:publish --tag next
git push origin HEAD --tags
```

### Why enter and exit pre mode on every release

`changeset version` computes `2.0.0` from `2.0.0-alpha.23`: a `patch` bump on a
prerelease drops the prerelease identifier. Pre mode is what keeps the `-alpha.N`
suffix, so versioning has to happen while in pre mode.

Publishing, in contrast, refuses a custom dist-tag in pre mode
(`Releasing under custom tag is not allowed in pre mode!`) and would use the
`alpha` dist-tag from `pre.json` — while `docs/zh/guide/getting-started.md` tells
users to install `@next`. Exiting pre mode before publishing satisfies both: the
version already carries the `-alpha.N` suffix and `changeset publish --tag next`
is allowed.

`pre enter` fails when the repo is already in pre mode and `pre exit` fails when
it is not, so the repository is left in the *exit* state between releases, where
the next `pnpm release` can enter pre mode again. That is also why `pre.json` is
committed. Each released changeset is kept in `.changeset/pre/` so it can be
reused for the changelog of the normal release.

Because every published version so far is a `2.0.0-alpha.*` one, `changeset
publish` also prints `will be published to latest rather than alpha as it will be
its first published version`. That preview line describes the *default* tag only;
`--tag next` wins, and npm ends up with `next` → `2.0.0-alpha.N`.

### Recovering from a failure halfway

Every step can be run again by hand:

```sh
# publishing failed after the release commit was created — the commit already
# carries the new version and changelog entry
pnpm changeset:publish --tag next
git push origin HEAD --tags

# the chain stopped before `pre exit` (publish would then refuse --tag)
pnpm changeset:pre:exit

# abandon the half-finished release instead
git reset --hard HEAD~1     # drop the release commit
git clean -fd .changeset    # drop pre.json and the consumed changesets
```

Do not run a bare `pnpm changeset:version` outside this chain: in the exit state
it finalizes the release as a normal version (`2.0.0`) and deletes `pre.json`.

## Releasing a stable version: `pnpm release:stable`

Once the alpha line is done, `pnpm release:stable` versions and publishes the
normal release under the `latest` dist-tag. Because consumed alpha changesets were
kept in `.changeset/pre/`, the `2.0.0` changelog covers the whole prerelease line;
that release removes `pre.json` and the `pre/` folder.

## Notes

- Keep `# Changelog` as the first line of `CHANGELOG.md`. Changesets prepends a
  new entry only when the file does not start with a version heading
  (`/^#{1,6}\s+\d+\.\d+/`, which a `## [2.0.0-alpha.19](…)` link heading does not
  match); otherwise it inserts the entry right after the first line, i.e. inside
  the oldest entry.
- `pnpm changelog` (conventional-changelog) is the older, git-history-based
  generator and writes the same `CHANGELOG.md`. Do not run it on top of a
  changesets-managed changelog.
- `commit: false` in `config.json` is intentional: changesets only rewrites files
  and the release scripts create the commit explicitly, so only the release files
  can be staged by accident.
- The release chain does not run `pnpm check` (format + build + the full test
  suite). Run it before releasing when the release commit matters.
- `pnpm release` only moves the `next` dist-tag: `latest` keeps pointing at the
  last normal release until `pnpm release:stable` runs. To move it by hand:
  `npm dist-tag add @10coding/vitepress-react@<version> latest`.
- Monorepo: private workspaces (`docs`, `__tests__/*`, `playground/*`) are never
  versioned or published — see `privatePackages` in `config.json`. The published
  package is the repository root, which is why `pnpm-workspace.yaml` lists `.`
  explicitly: changesets only sees packages matched by those globs.
