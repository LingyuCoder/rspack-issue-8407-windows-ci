# Rspack issue #8407 Windows verification

This repository verifies [web-infra-dev/rspack#8407](https://github.com/web-infra-dev/rspack/issues/8407) on a real GitHub-hosted Windows runner.

## Result

**The panic is gone in current Rspack releases, but the long-path build is not fixed.**

The controlled run on Windows Server 2022 used the original 18-level fixture, pinned at commit [`60b3053`](https://github.com/Xellon/rspack-repro/commit/60b30536941b5ac572b573da4de18317f583a498). The app directory is 217 characters long before pnpm adds its nested dependency paths.

| Node | Rspack / Rsbuild | Location | `LongPathsEnabled` | Result |
| --- | --- | --- | ---: | --- |
| 20.20.2 | 1.1.8 / 1.1.13 | deep | 0 | Reproduces `should have module` panic |
| 20.20.2 | 1.7.12 / 1.7.6 | shallow | 0 | Passes |
| 20.20.2 | 1.7.12 / 1.7.6 | deep | 0 or 1 | Fails without a panic |
| 20.20.2 | 2.2.2 / 2.2.3 | shallow | 0 | Passes |
| 20.20.2 | 2.2.2 / 2.2.3 | deep | 0 or 1 | Fails without a panic |
| 22.9.0 | 2.2.2 / 2.2.3 | deep | 1 | Fails without a panic |
| 24.20.0 | 2.2.2 / 2.2.3 | deep | 1 | Fails without a panic |
| 24.20.0 | 2.2.2 / 2.2.3 | deep, `resolve.symlinks=false` | 1 | Passes |
| 24.20.0 | 2.2.2 / 2.2.3 | deep, pnpm hoisted install | 1 | Passes |

The current releases fail while resolving the long `swiper.css` path, followed by a `cssExtractLoader` error. Enabling the Windows `LongPathsEnabled` registry policy does not change the result. Node 22.9 and Node 24 produce the same error as Node 20, so the Node.js long-path fixes in [nodejs/node#50753](https://github.com/nodejs/node/issues/50753) and [nodejs/node#54304](https://github.com/nodejs/node/issues/54304) do not fix this Rspack reproduction. The matching shallow-path controls pass, so the failure is specific to the deep-path setup rather than the fixture or dependency installation.

Two causal controls pass with the same deep project directory: disabling Rspack symlink resolution (`resolve.symlinks=false`) and installing dependencies with pnpm's hoisted node linker. Both prevent the resolved `swiper.css` path from expanding through pnpm's long `.pnpm` target, which confirms that the failure is triggered by Rspack canonicalizing the symlink to an extended-length Windows path.

See the [controlled GitHub Actions run](https://github.com/LingyuCoder/rspack-issue-8407-windows-ci/actions/runs/34076946377) and its uploaded build logs. The overall run is intentionally red because current Rspack is required to complete the unmodified deep-path build successfully.

## Diagnosis

With `resolve.symlinks` enabled, Rspack canonicalizes pnpm's `node_modules/swiper` symlink to its physical `.pnpm` target. The resulting `swiper.css` path is longer than 260 characters, so [`dunce::canonicalize`](https://gitlab.com/kornelski/dunce/-/blob/v1.0.5/src/lib.rs#L151-180) correctly retains Windows' extended-length path prefix: `\\?\C:\...`.

Rspack then passes that path through request/resource parsers where `?` normally starts a resource query. The current [JavaScript resource parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/packages/rspack/src/util/identifier.ts#L304-L341), [Rust loader resource parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/crates/rspack_loader_runner/src/loader.rs#L301-L334), and [native resolver specifier parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/crates/rspack_resolver/src/specifier.rs#L22-L101) do not special-case the namespace marker. They therefore parse `\\?\C:\...\swiper.css` as path `\\` plus query `?\C:\...\swiper.css`. This explains the observed resolution context of `\` exactly.

The proposed fix is to preserve the `\\?\` prefix for filesystem I/O while making all three parsers skip its namespace-marker `?` when looking for a real resource query. The same behavior should cover `\\?\UNC\server\share\...`, and the Windows absolute-path/contextification helpers should recognize both extended path forms. A separate error-propagation fix should ensure that a failed `importModule` factorization reaches the loader callback as an error instead of returning `undefined` and producing the secondary `cssExtractLoader` `__esModule` exception.

## What the workflow does

The workflow clones the original reproduction, verifies its pinned commit, installs dependencies with pnpm, and runs `rsbuild build` on GitHub's `windows-2022` runner. It includes deep-path tests with the Windows long-path policy both disabled and enabled, plus shallow-path controls using the same source files and package versions.

The fixture is adapted from [Xellon/rspack-repro](https://github.com/Xellon/rspack-repro/tree/bug-repro).
