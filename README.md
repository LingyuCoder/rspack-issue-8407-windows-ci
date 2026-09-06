# Rspack issue #8407 Windows verification

This repository verifies [web-infra-dev/rspack#8407](https://github.com/web-infra-dev/rspack/issues/8407) on a real GitHub-hosted Windows runner.

The workflow copies the original reproduction into the same 18-level directory structure used by the reporter, installs dependencies with pnpm, and runs `rsbuild build`.

It tests:

- the reproduction's legacy versions (`@rspack/core` 1.1.8 and `@rsbuild/core` 1.1.13), which must reproduce the `should have module` panic;
- the latest Rspack v1 versions (`@rspack/core` 1.7.12 and `@rsbuild/core` 1.7.6), which must build successfully;
- the current major versions (`@rspack/core` 2.2.2 and `@rsbuild/core` 2.2.3), which must build successfully.

The CI run is green only when the legacy case reproduces the reported panic and both current cases complete without a panic.

The fixture is adapted from [Xellon/rspack-repro](https://github.com/Xellon/rspack-repro/tree/bug-repro).
