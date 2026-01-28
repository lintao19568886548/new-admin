<div align="center"> <a href="https://github.com/anncwb/vue-vben-admin"> <img alt="VbenAdmin Logo" width="215" src="https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp"> </a> <br> <br>

[![license](https://img.shields.io/github/license/anncwb/vue-vben-admin.svg)](LICENSE)

<h1>Vue Vben Admin</h1>
</div>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vbenjs_vue-vben-admin&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vbenjs_vue-vben-admin) ![codeql](https://github.com/vbenjs/vue-vben-admin/actions/workflows/codeql.yml/badge.svg) ![build](https://github.com/vbenjs/vue-vben-admin/actions/workflows/build.yml/badge.svg) ![ci](https://github.com/vbenjs/vue-vben-admin/actions/workflows/ci.yml/badge.svg) ![deploy](https://github.com/vbenjs/vue-vben-admin/actions/workflows/deploy.yml/badge.svg)

**目录**

- [cap相关命令](#cap相关命令)
- [关于双端同步开发的建议](#关于双端同步开发的建议)
- [关于`git cherry-pick`的用法](#关于git-cherry-pick的用法)

---

# cap相关命令

## 1. **当您修改的是 Web 前端代码 (例如 Vue 组件、JavaScript、CSS):**

- **第一步：构建 Web 应用。** 您需要先将您的 Web 前端代码（Vue 项目）打包成静态文件。这通常通过在您的 `playground` 目录下运行类似以下的命令来完成 (具体命令取决于您项目 `package.json` 中的 `scripts` 配置)：
  ```bash
  pnpm build
  ```
  或者
  ```bash
  npm run build
  ```
  这个命令会把您的 Web 应用编译打包到类似 `dist` 或 `www` 的文件夹中。
- **第二步：同步到 Capacitor Android 项目。** 构建完成后，您需要将这些新生成的 Web 静态文件同步到您的 Android 原生项目中。这通过 Capacitor CLI 完成：
  ```bash
  npx cap sync android
  ```
  或者，如果您全局或项目内安装了 `cap`：
  ```bash
  pnpm cap sync android
  ```
  这个命令会把 Web 资源复制到 Android 项目的 `assets` 目录，并更新原生项目的配置（如果需要）。
- **第三步：在 Android Studio 中运行。** 同步完成后，您就可以在 Android Studio 中打开您的 `android` 项目，然后点击 "Run" 按钮来构建和运行您的应用到模拟器或真实设备上。Android Studio 会编译原生代码并将 Web 资源打包进 APK。

**小结 (Web 代码修改):** 是的，通常是 `构建 Web -> 同步 Capacitor -> Android Studio 运行`。

**优化提示 (Live Reload):** 为了加速 Web 前端开发，Capacitor 提供了 Live Reload 功能。通过运行类似 `npx cap run android --livereload --external` 的命令，您可以在设备或模拟器上实时看到 Web 代码的更改，而无需每次都手动执行 `build` 和 `sync`。这在频繁修改 UI 或 Web 逻辑时非常有用。**⚠️注意：这种方法部署的前端是通过http服务提供的，而不是通过本地资源直接启动，需要你额外开启前端http服务。**

## 2. **当您修改的是原生 Android 代码 (例如 Java 或 Kotlin 文件，直接在 Android Studio 的 `android` 项目中修改):**

- 您只需要在 Android Studio 中修改代码，然后直接点击 "Run" 或 "Apply Changes"。Android Studio 会处理原生代码的编译和部署。这种情况下，您**不需要**执行 Web 应用的 `build` 或 Capacitor 的 `sync` 命令。

## 3. **当您添加/移除 Capacitor 插件或修改 Capacitor 配置时:**

- 在安装或卸载插件后 (例如 `pnpm install some-plugin`)，您**必须**运行 `npx cap sync android` (或 `pnpm cap sync android`)。这个命令会更新原生项目的依赖和配置。
- 之后，您就可以在 Android Studio 中运行应用。

## **总结来说：**

- **改 Web 代码 (如 <mcfile name="app.vue" path="c:\github\vben-admin\android\vben-admin\playground\src\app.vue"></mcfile>)**: `build` (Web) -> `sync` (Capacitor) -> `run` (Android Studio)，或者使用 Live Reload。
- **改原生 Android 代码**: 直接在 Android Studio 中 `run`。
- **改插件或 Capacitor 配置**: `sync` (Capacitor) -> `run` (Android Studio)。

---

# 关于双端同步开发的建议

**核心思路：利用现有 Monorepo 结构，在 `playground/src` 中管理平台差异，辅以 `git cherry-pick` 处理特殊情况。**

1.  **统一代码库，平台感知：**
    - 你目前的 `vben-admin` 项目是 Monorepo 结构（使用 pnpm workspace），这非常适合多端开发。你的主要 Vue 应用代码应该在 `playground/src` 目录下。这个目录下的代码将同时作为网页版和 Capacitor App（通过 `vite build` 构建后供 Capacitor 使用）的源。
    - **默认共享**：大多数情况下，你在 `playground/src` 或 `packages/` 中所做的更改，会自然地同时影响到网页版和 App 版。

2.  **处理平台差异：**
    - **微小差异（样式、少量逻辑）：** 在同一个 Vue 组件内部，你可以使用 Capacitor 提供的 API 来检测当前运行环境，并据此应用不同的样式或逻辑。例如，使用 `Capacitor.isNativePlatform()` 或 `Capacitor.getPlatform()`：

      ```vue
      <script lang="ts" setup>
      import { ref, onMounted } from 'vue';
      import { Capacitor } from '@capacitor/core';

      const isNativeApp = ref(false);
      const platform = ref('');

      onMounted(() => {
        isNativeApp.value = Capacitor.isNativePlatform();
        if (isNativeApp.value) {
          platform.value = Capacitor.getPlatform(); // 'android', 'ios', 'web'
        }
      });
      </script>

      <template>
        <div
          :class="{
            'mobile-padding': isNativeApp,
            'desktop-padding': !isNativeApp,
          }"
        >
          <p v-if="isNativeApp">这是 App 特有的内容。</p>
          <p v-else>这是网页特有的内容。</p>
          <p>这是共享内容。</p>
        </div>
      </template>
      ```

    - **显著差异（整个组件或视图不同）：** 如果某个组件或视图在 App 和网页端有很大不同，推荐使用动态导入的方式加载特定于平台的组件：
      - 创建两个版本的组件，例如：`MyFeature.web.vue` 和 `MyFeature.app.vue`。
      - 在父组件中根据平台动态加载它们：

        ```vue
        <script lang="ts" setup>
        import { shallowRef, onMounted, defineAsyncComponent } from 'vue';
        import { Capacitor } from '@capacitor/core';

        const PlatformSpecificComponent = shallowRef(null);

        onMounted(async () => {
          if (Capacitor.isNativePlatform()) {
            // 对于App环境，加载 MyFeature.app.vue
            PlatformSpecificComponent.value = defineAsyncComponent(
              () => import('./MyFeature.app.vue'),
            );
          } else {
            // 对于Web环境，加载 MyFeature.web.vue
            PlatformSpecificComponent.value = defineAsyncComponent(
              () => import('./MyFeature.web.vue'),
            );
          }
        });
        </script>

        <template>
          <component
            :is="PlatformSpecificComponent"
            v-if="PlatformSpecificComponent"
          />
        </template>
        ```

    - **共享模块/包：** 对于那些可以在多个项目（如主应用、其他潜在应用）或平台间完全复用的逻辑、UI 组件（不含平台特定逻辑），可以将它们抽离到 `packages/` 目录下（例如 `packages/@core/shared-components`, `packages/@core/shared-utils`）。然后在 `playground/src` 中引入这些共享包。

3.  **Git 工作流与代码同步：**
    - **特性分支：** 建议所有新功能或修改都在独立的特性分支上进行。
    - **合并到主干：** 当一个特性开发完成并通过测试后，将其合并到你的主开发分支（如 `main` 或 `develop`）。如果这个特性包含了平台差异化的逻辑（如上述的条件渲染或动态导入），这些差异本身就是特性代码的一部分。
    - **`git cherry-pick` 的使用：** 你提到的“不能挑选的合并”问题，`git cherry-pick` 正是为此而生的。如果你在一个分支（比如 `feature-web-only`）上做了一个提交（commit A），后来发现这个提交（或者它的一部分逻辑）也适用于 App，但你又不想合并 `feature-web-only` 分支上的所有其他改动，你可以这样做：
      1.  切换到你的 App 开发分支或主开发分支：`git checkout main-dev`
      2.  挑选那个特定的提交：`git cherry-pick <commit_A_hash>` 这样，只有 commit A 的改动会被应用到 `main-dev` 分支上。 **但是，请注意：** 过度依赖 `git cherry-pick` 可能会使版本历史变得复杂且难以管理。最佳实践是尽可能地在最初设计特性时就考虑到多端兼容性，将平台差异作为特性本身的一部分来实现，从而减少对 `cherry-pick` 的依赖。它更适合用于意外情况的修正或小范围、一次性的代码移植。

4.  **App 特有的适配：**
    - 如你所见，`playground/src/app.vue` 中已经有针对安全区域（safe-area-inset）的 CSS 适配，这是很好的实践。
    - App 可能还需要与原生功能交互（通过 Capacitor 插件），这些调用通常也会在 `playground/src` 的相关组件或服务中进行，并可能通过平台检测来确保只在 App 环境下执行。

**总结：**

- **主要策略：** 维护一个主要的、平台感知的代码库 (`playground/src`)。
- **共享优先：** 尽可能编写可在多端共享的代码。
- **按需差异化：** 在组件内部通过平台检测API处理小的差异，或通过动态导入加载平台专属组件来处理大的差异。
- **Git 分支管理：** 使用特性分支进行开发，完成后合并回主线。
- **`git cherry-pick`：** 作为辅助工具，用于从一个分支挑选特定提交到另一个分支，但不要作为常规同步手段。

---

# 关于`git cherry-pick`的用法

`git cherry-pick` 是一个非常有用的 Git 命令，它允许你选择一个或多个已经存在的提交（commits），并将这些提交应用到你当前所在的另一个分支上。这就像从一棵樱桃树上“挑选”特定的樱桃（提交）并放到另一个篮子（分支）里一样。

下面是如何使用 `git cherry-pick` 的详细说明：

### 1. `git cherry-pick` 的基本用法

最基本的使用方式是挑选单个提交：

- **第一步：找到你想要挑选的提交的哈希值 (commit hash)。** 你可以使用 `git log` 命令在源分支上查找。例如，如果你想从 `feature-branch` 挑选一个提交：

  ```bash
  git log feature-branch
  ```

  复制你需要的那个提交的完整哈希值（或者至少是能唯一标识它的前7位字符）。

- **第二步：切换到你想要应用这个提交的目标分支。** 假设你想把提交应用到 `main` 分支：

  ```bash
  git checkout main
  ```

- **第三步：执行 `git cherry-pick` 命令。**
  ```bash
  git cherry-pick <commit-hash>
  ```
  将 `<commit-hash>` 替换为你复制的实际哈希值。Git 会尝试将这个提交的更改应用到 `main` 分支，并创建一个新的提交（拥有新的哈希值，但作者、日期和提交信息通常会保留）。

### 2. 挑选多个提交

你可以一次挑选多个提交：

- **按顺序挑选多个不连续的提交：**

  ```bash
  git cherry-pick <commit-hash-A> <commit-hash-B> <commit-hash-C>
  ```

  Git 会按照你列出的顺序依次应用这些提交。

- **挑选一个连续范围的提交：** 如果你想挑选从 `commit-A` (不包括 A) 到 `commit-B` (包括 B) 之间的所有提交：
  ```bash
  git cherry-pick <commit-A>^..<commit-B>
  ```
  注意 `^` 符号，它表示 `commit-A` 的父提交，所以范围从 `commit-A` 的下一个提交开始。或者，如果你想挑选包括 `commit-A` 到 `commit-B` 的所有提交：
  ```bash
  git cherry-pick <commit-A>..<commit-B> # 这种方式通常需要 commit-A 是 commit-B 的祖先
  # 更安全的方式是逐个指定或使用上面的 ^ 语法，或者先切换到 commit-B，然后挑选从 commit-A 到 HEAD 的范围
  ```
  一个更常见的挑选范围的方式是：
  ```bash
  git cherry-pick <hash-of-oldest-commit-in-range>^..<hash-of-newest-commit-in-range>
  ```
  例如，挑选 `A`, `B`, `C` 三个连续提交 (假设 `A` 是最早的)：
  ```bash
  git log # 找到 A, B, C 的哈希
  git cherry-pick <hash_A>^..<hash_C>
  ```

### 3. 处理冲突 (Conflicts)

在 `cherry-pick` 过程中，如果被挑选的提交与当前分支上的更改有冲突，Git 会暂停 `cherry-pick` 过程，并提示你解决冲突。

- **第一步：查看冲突文件。** 使用 `git status` 查看哪些文件有冲突。

- **第二步：手动解决冲突。** 打开冲突文件，你会看到类似以下的标记：

  ```
  <<<<<<< HEAD
  当前分支的代码
  =======
  被挑选提交的代码
  >>>>>>> <commit-hash>
  ```

  你需要编辑这些文件，删除这些标记，并保留你想要的代码版本。

- **第三步：标记冲突已解决。** 解决完所有冲突后，使用 `git add <resolved-file-name>` 将文件标记为已解决。

- **第四步：继续 `cherry-pick`。**

  ```bash
  git cherry-pick --continue
  ```

  Git 会完成这个提交的应用。

- **如果想中止 `cherry-pick`：** 如果你在解决冲突时遇到困难，或者决定不进行这次 `cherry-pick`，可以中止操作，恢复到 `cherry-pick` 之前的状态：
  ```bash
  git cherry-pick --abort
  ```

### 4. `git cherry-pick` 的常用选项

- `-e` 或 `--edit`：在应用提交前，允许你编辑提交信息。

  ```bash
  git cherry-pick -e <commit-hash>
  ```

- `-n` 或 `--no-commit`：应用提交的更改到你的工作目录和暂存区，但不会自动创建一个新的提交。这允许你在提交前检查更改，或者将多个 `cherry-pick` 的更改合并成一个提交。

  ```bash
  git cherry-pick -n <commit-hash>
  # 之后你可以 git commit -m "新的提交信息"
  ```

- `-x`：在生成的提交信息的末尾自动添加一行 `(cherry picked from commit <original-commit-hash>)`。这有助于追踪提交的来源。

- `--mainline <parent-number>`：当你要 `cherry-pick` 一个合并提交（merge commit）时，合并提交通常有两个或多个父提交。你需要告诉 Git 你想采用哪个父提交的变更路径。父提交从 1 开始编号。例如，如果一个合并提交的哈希是 `M`，它合并了 `P1` 和 `P2`，你想应用从 `P1` 到 `M` 的这条线的更改：
  ```bash
  git cherry-pick -m 1 <merge-commit-hash>
  ```
  通常，`1` 代表合并时当前分支（`--ours`），`2` 代表被合并进来的分支（`--theirs`）。你需要用 `git show <merge-commit-hash>` 查看合并信息来确定哪个父提交是你想要的。

### 5. 什么时候使用 `git cherry-pick`？

- **紧急修复**：当一个 bug 在开发分支被修复，而这个修复也需要立即应用到已经发布的稳定版本分支上时。
- **选择性功能**：某个特性分支上的一个小功能或改进，你希望提前应用到另一个分支，但又不想合并整个特性分支。
- **避免不必要的合并**：当你只想引入某个分支的特定更改，而不是该分支上的所有历史记录。

### 6. 注意事项

- **重复提交**：`cherry-pick` 会在目标分支上创建一个新的提交，这个新提交包含了源提交的更改，但它有不同的哈希值。如果你之后又尝试合并包含原始提交的分支，可能会遇到冲突或重复的更改。
- **理解上下文**：确保你理解被挑选提交的上下文，它可能依赖于源分支上的其他提交。单独挑选一个提交可能导致代码无法正常工作或引入新的问题。
- **团队协作**：在团队项目中使用 `cherry-pick` 时，最好与团队成员沟通，确保大家都清楚代码的流向，避免混淆。

总的来说，`git cherry-pick` 是一个强大的工具，但需要谨慎使用。在大多数情况下，`git merge` 或 `git rebase` 可能是更合适的代码集成策略。

---

**English** | [中文](./README.zh-CN.md) | [日本語](./README.ja-JP.md)

## Introduction

Vue Vben Admin is a free and open source middle and back-end template. Using the latest `vue3`, `vite`, `TypeScript` and other mainstream technology development, the out-of-the-box middle and back-end front-end solutions can also be used for learning reference.

## Upgrade Notice

This is the latest version, 5.0, and it is not compatible with previous versions. If you are starting a new project, it is recommended to use the latest version. If you wish to view the old version, please use the [v2 branch](https://github.com/vbenjs/vue-vben-admin/tree/v2).

## Feature

- **Latest Technology Stack**: Developed with cutting-edge front-end technologies like Vue 3 and Vite
- **TypeScript**: A language for application-scale JavaScript
- **Themes**: Multiple theme colors available with customizable options
- **Internationalization**: Comprehensive built-in internationalization support
- **Permissions**: Built-in solution for dynamic route-based permission generation

## Preview

- [Vben Admin](https://vben.pro/) - Full version Chinese site

Test Account: vben/123456

<p align="center">
    <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview1.png">
    <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview2.png">
    <img alt="VbenAdmin Logo" width="100%" src="https://anncwb.github.io/anncwb/images/preview3.png">
</p>

### Use Gitpod

Open the project in Gitpod (free online dev environment for GitHub) and start coding immediately.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/vbenjs/vue-vben-admin)

## Documentation

[Document](https://doc.vben.pro/)

## Install and use

- Get the project code

```bash
git clone https://github.com/vbenjs/vue-vben-admin.git
```

- Installation dependencies

```bash
cd vue-vben-admin

corepack enable

pnpm install
```

- run

```bash
pnpm dev
```

- build

```bash
pnpm build
```

## Change Log

[CHANGELOG](https://github.com/vbenjs/vue-vben-admin/releases)

## How to contribute

You are very welcome to join！[Raise an issue](https://github.com/anncwb/vue-vben-admin/issues/new/choose) Or submit a Pull Request。

**Pull Request:**

1. Fork code!
2. Create your own branch: `git checkout -b feat/xxxx`
3. Submit your changes: `git commit -am 'feat(function): add xxxxx'`
4. Push your branch: `git push origin feat/xxxx`
5. submit`pull request`

## Git Contribution submission specification

- reference [vue](https://github.com/vuejs/vue/blob/dev/.github/COMMIT_CONVENTION.md) specification ([Angular](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular))
  - `feat` Add new features
  - `fix` Fix the problem/BUG
  - `style` The code style is related and does not affect the running result
  - `perf` Optimization/performance improvement
  - `refactor` Refactor
  - `revert` Undo edit
  - `test` Test related
  - `docs` Documentation/notes
  - `chore` Dependency update/scaffolding configuration modification etc.
  - `ci` Continuous integration
  - `types` Type definition file changes
  - `wip` In development

## Browser support

The `Chrome 80+` browser is recommended for local development

Support modern browsers, not IE

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt=" Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>IE | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt=" Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Safari |
| :-: | :-: | :-: | :-: | :-: |
| not support | last 2 versions | last 2 versions | last 2 versions | last 2 versions |

## Maintainer

[@Vben](https://github.com/anncwb)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vbenjs/vue-vben-admin&type=Date)](https://star-history.com/#vbenjs/vue-vben-admin&Date)

## Donate

If you think this project is helpful to you, you can help the author buy a cup of coffee to show your support!

![donate](https://unpkg.com/@vbenjs/static-source@0.1.7/source/sponsor.png)

<a style="display: block;width: 100px;height: 50px;line-height: 50px; color: #fff;text-align: center; background: #408aee;border-radius: 4px;" href="https://www.paypal.com/paypalme/cvvben">Paypal Me</a>

## Contributor

<a href="https://github.com/vbenjs/vue-vben-admin/graphs/contributors">
  <img alt="Contributors"
        src="https://opencollective.com/vbenjs/contributors.svg?button=false" />
</a>

## Discord

- [Github Discussions](https://github.com/anncwb/vue-vben-admin/discussions)

## License

[MIT © Vben-2020](./LICENSE)
