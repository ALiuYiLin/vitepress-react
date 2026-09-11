# Changesets

This folder holds the [changesets](https://github.com/changesets/changesets) that
describe upcoming releases of `@10coding/vitepress-react`.

- `pnpm changeset` — record a change (pick the bump type, write a summary). The
  summary becomes the entry in `CHANGELOG.md`.
- `pnpm changeset status --verbose` — dry check: which packages would be bumped
  and to which version.
- `pnpm changeset:version` — consume the pending changesets: bump `version` in
  `package.json` and prepend a changelog entry.
- `pnpm changeset:publish` — build, then publish under the `next` dist-tag and
  create the matching git tag.

## Prerelease line

The package currently ships prereleases (`2.0.0-alpha.x`). Enter prerelease mode
before versioning, otherwise `changeset version` computes `2.0.0` — it drops the
prerelease identifier:

```sh
pnpm changeset pre enter alpha   # once, while releasing on the alpha line
pnpm changeset:version           # 2.0.0-alpha.23 -> 2.0.0-alpha.24
pnpm changeset:publish           # publishes with --tag next
pnpm changeset pre exit          # when the alpha line is over
```

## Monorepo notes

Private workspaces (`docs`, `__tests__/*`, `playground/*`) are never versioned or
published — see `privatePackages` in `config.json`. The published package is the
repository root, which is why `pnpm-workspace.yaml` lists `.` explicitly:
changesets only sees packages matched by those globs.

`commit: false` is intentional: changesets does not commit for you, so the
release commit and tag stay in your hands. `scripts/release.ts` (the
conventional-changelog based flow) remains available as an alternative.
