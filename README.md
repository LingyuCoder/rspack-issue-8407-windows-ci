# Rspack issue #8407 Windows verification

This repository verifies [web-infra-dev/rspack#8407](https://github.com/web-infra-dev/rspack/issues/8407) on a real GitHub-hosted Windows runner.

## Result

**The panic is gone in current Rspack releases, but the long-path build is not fixed.**

The controlled run on Windows Server 2022 used the original 18-level fixture, pinned at commit [`60b3053`](https://github.com/Xellon/rspack-repro/commit/60b30536941b5ac572b573da4de18317f583a498). The app directory is 217 characters long before pnpm adds its nested dependency paths.

| Rspack / Rsbuild | Location | `LongPathsEnabled` | Result |
| --- | --- | ---: | --- |
| 1.1.8 / 1.1.13 | deep | 0 | Reproduces `should have module` panic |
| 1.7.12 / 1.7.6 | shallow | 0 | Passes |
| 1.7.12 / 1.7.6 | deep | 0 or 1 | Fails without a panic |
| 2.2.2 / 2.2.3 | shallow | 0 | Passes |
| 2.2.2 / 2.2.3 | deep | 0 or 1 | Fails without a panic |

The current releases fail while resolving the long `swiper.css` path, followed by a `cssExtractLoader` error. Enabling the Windows `LongPathsEnabled` registry policy does not change the result. The matching shallow-path controls pass, so the failure is specific to the deep-path setup rather than the fixture or dependency installation.

See the [controlled GitHub Actions run](https://github.com/LingyuCoder/rspack-issue-8407-windows-ci/actions/runs/34044179625) and its uploaded build logs. The overall run is intentionally red because current Rspack is required to complete the deep-path build successfully.

## What the workflow does

The workflow clones the original reproduction, verifies its pinned commit, installs dependencies with pnpm, and runs `rsbuild build` on GitHub's `windows-2022` runner. It includes deep-path tests with the Windows long-path policy both disabled and enabled, plus shallow-path controls using the same source files and package versions.

The fixture is adapted from [Xellon/rspack-repro](https://github.com/Xellon/rspack-repro/tree/bug-repro).
