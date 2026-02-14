# Tag And Release Strategy

## Versioning policy

OpenMCP uses Semantic Versioning:

- `MAJOR`: breaking API or behavior changes
- `MINOR`: backward-compatible features
- `PATCH`: backward-compatible fixes

Tag format:

- stable: `vX.Y.Z`
- pre-release: `vX.Y.Z-rc.N`

## Branch and release flow

1. Merge validated changes to `main`.
2. Run `npm run gate` on `main`.
3. Update changelog and release notes.
4. Create annotated tag on `main`.
5. Publish GitHub release from tag.

## Tag rules

- Use annotated tags only (`git tag -a`).
- One release per tag; never reuse or move published tags.
- Hotfix tags increment patch version (for example `v0.1.1`).

## Release channels

- `rc` tags are for validation and integration testing.
- stable tags are production-ready release points.

## Recommended commands

```bash
git checkout main
git pull --ff-only
npm ci
npm run gate
git tag -a v0.1.0 -m "OpenMCP v0.1.0"
git push origin v0.1.0
```

## Roll-forward policy

If a release issue is found after publish:

1. Create a patch PR.
2. Tag next patch version.
3. Deprecate affected release in GitHub notes.
