# Public Adapter Template

OpenPort includes a public-safe adapter repository template at:

- `templates/openport-adapter-public-template`

## Purpose

This template helps teams publish adapter code without exposing product-internal logic or infrastructure details.

## Required isolation rules

- keep all product internals in separate private systems
- expose only adapter mapping logic required by OpenPort interfaces
- avoid private hostnames, IDs, schemas, and sample data in the public repository
- keep secrets out of git and inject via runtime environment

## Suggested publication workflow

1. Copy template into a new repository.
2. Replace package name and repository metadata.
3. Implement upstream endpoint mapping.
4. Add CI checks (`build` and `test`) in the new repository.
5. Run an independent security review before first release.
