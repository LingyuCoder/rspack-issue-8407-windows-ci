# Rspack issue #8407 Windows verification

This repository verifies [web-infra-dev/rspack#8407](https://github.com/web-infra-dev/rspack/issues/8407) on a real GitHub-hosted Windows runner.

## Result

**The panic is gone in current Rspack releases, but the published long-path build is not fixed. The patched source build passes the original reproduction.**

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
| 24.20.0 | patched source [`27c3874`](https://github.com/LingyuCoder/rspack/commit/27c387400196282d14fdcba36d260dc4505064f4) / 2.2.3 | deep | 1 | Passes |

The current releases fail while resolving the long `swiper.css` path, followed by a `cssExtractLoader` error. Enabling the Windows `LongPathsEnabled` registry policy does not change the result. Node 22.9 and Node 24 produce the same error as Node 20, so the Node.js long-path fixes in [nodejs/node#50753](https://github.com/nodejs/node/issues/50753) and [nodejs/node#54304](https://github.com/nodejs/node/issues/54304) do not fix this Rspack reproduction. The matching shallow-path controls pass, so the failure is specific to the deep-path setup rather than the fixture or dependency installation.

Two causal controls pass with the same deep project directory: disabling Rspack symlink resolution (`resolve.symlinks=false`) and installing dependencies with pnpm's hoisted node linker. Both prevent the resolved `swiper.css` path from expanding through pnpm's long `.pnpm` target, which confirms that the failure is triggered by Rspack canonicalizing the symlink to an extended-length Windows path.

See the intentionally red [published-release run](https://github.com/LingyuCoder/rspack-issue-8407-windows-ci/actions/runs/34076946377) and the green [patched-source run](https://github.com/LingyuCoder/rspack-issue-8407-windows-ci/actions/runs/34086667300). The patched run builds Rspack from the pinned source revision, checks that Rsbuild resolves that exact local build, and then successfully builds the unmodified deep-path reproduction.

## Diagnosis

With `resolve.symlinks` enabled, Rspack canonicalizes pnpm's `node_modules/swiper` symlink to its physical `.pnpm` target. The resulting `swiper.css` path is longer than 260 characters, so [`dunce::canonicalize`](https://gitlab.com/kornelski/dunce/-/blob/v1.0.5/src/lib.rs#L151-180) correctly retains Windows' extended-length path prefix: `\\?\C:\...`.

Rspack then passes that path through request/resource parsers where `?` normally starts a resource query. The current [JavaScript resource parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/packages/rspack/src/util/identifier.ts#L304-L341), [Rust loader resource parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/crates/rspack_loader_runner/src/loader.rs#L301-L334), and [native resolver specifier parser](https://github.com/web-infra-dev/rspack/blob/7c1c826b7f5dc13cfd6fd77cccd501663e4f24b8/crates/rspack_resolver/src/specifier.rs#L22-L101) do not special-case the namespace marker. They therefore parse `\\?\C:\...\swiper.css` as path `\\` plus query `?\C:\...\swiper.css`. This explains the observed resolution context of `\` exactly.

The fix follows [webpack/enhanced-resolve#551](https://github.com/webpack/enhanced-resolve/pull/551): preserve the `\\?\` or `\\.\` prefix for filesystem I/O, classify it as a Windows absolute path, and skip the namespace marker when scanning for a real query or fragment. Rspack needs this behavior in its JavaScript resource parser, Rust loader parser, native resolver specifier parser, and path/contextification consumers. It converts resolved JavaScript loader identifiers to their drive/UNC spelling only after filesystem access and cache-version calculation; [nodejs/node#60435](https://github.com/nodejs/node/issues/60435) tracks the same `EISDIR` / `lstat 'C:'` failure for namespaced long paths in Node 22, and the Windows integration run reproduced it under Node 24. This lets the JavaScript loader runner retain webpack's direct `require(loader.path)` behavior. Once the primary resolution succeeds, the secondary `cssExtractLoader` `__esModule` exception disappears without a separate error-propagation change.

## What the workflow does

The release workflow clones the original reproduction, verifies its pinned commit, installs dependencies with pnpm, and runs `rsbuild build` on GitHub's `windows-2022` runner. It includes deep-path tests with the Windows long-path policy both disabled and enabled, plus shallow-path controls using the same source files and package versions.

The patched workflow builds the pinned Rspack revision, runs DOS-device parser and real-filesystem resolver tests, runs a Windows-only loader integration case, and then injects that build into the original 18-level reproduction. A runtime assertion checks the `@rspack/core` path resolved from Rsbuild before the final build runs.

The fixture is adapted from [Xellon/rspack-repro](https://github.com/Xellon/rspack-repro/tree/bug-repro).
