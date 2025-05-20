<div align="center"> <a href="https://github.com/anncwb/vue-vben-admin"> <img alt="VbenAdmin Logo" width="215" src="https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp"> </a> <br> <br>

[![license](https://img.shields.io/github/license/anncwb/vue-vben-admin.svg)](LICENSE)

<h1>Vue Vben Admin</h1>
</div>

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vbenjs_vue-vben-admin&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vbenjs_vue-vben-admin) ![codeql](https://github.com/vbenjs/vue-vben-admin/actions/workflows/codeql.yml/badge.svg) ![build](https://github.com/vbenjs/vue-vben-admin/actions/workflows/build.yml/badge.svg) ![ci](https://github.com/vbenjs/vue-vben-admin/actions/workflows/ci.yml/badge.svg) ![deploy](https://github.com/vbenjs/vue-vben-admin/actions/workflows/deploy.yml/badge.svg)

# cap相关命令

## 1.  **当您修改的是 Web 前端代码 (例如 Vue 组件、JavaScript、CSS):**
*   **第一步：构建 Web 应用。**
    您需要先将您的 Web 前端代码（Vue 项目）打包成静态文件。这通常通过在您的 `playground` 目录下运行类似以下的命令来完成 (具体命令取决于您项目 `package.json` 中的 `scripts` 配置)：
    ```bash
    pnpm build
    ```
    或者
    ```bash
    npm run build
    ```
    这个命令会把您的 Web 应用编译打包到类似 `dist` 或 `www` 的文件夹中。
*   **第二步：同步到 Capacitor Android 项目。**
    构建完成后，您需要将这些新生成的 Web 静态文件同步到您的 Android 原生项目中。这通过 Capacitor CLI 完成：
    ```bash
    npx cap sync android
    ```
    或者，如果您全局或项目内安装了 `cap`：
    ```bash
    pnpm cap sync android
    ```
    这个命令会把 Web 资源复制到 Android 项目的 `assets` 目录，并更新原生项目的配置（如果需要）。
*   **第三步：在 Android Studio 中运行。**
    同步完成后，您就可以在 Android Studio 中打开您的 `android` 项目，然后点击 "Run" 按钮来构建和运行您的应用到模拟器或真实设备上。Android Studio 会编译原生代码并将 Web 资源打包进 APK。

**小结 (Web 代码修改):** 是的，通常是 `构建 Web -> 同步 Capacitor -> Android Studio 运行`。

**优化提示 (Live Reload):**
为了加速 Web 前端开发，Capacitor 提供了 Live Reload 功能。通过运行类似 `npx cap run android --livereload --external` 的命令，您可以在设备或模拟器上实时看到 Web 代码的更改，而无需每次都手动执行 `build` 和 `sync`。这在频繁修改 UI 或 Web 逻辑时非常有用。**⚠️注意：这种方法部署的前端是通过http服务提供的，而不是通过本地资源直接启动，需要你额外开启前端http服务。**

## 2.  **当您修改的是原生 Android 代码 (例如 Java 或 Kotlin 文件，直接在 Android Studio 的 `android` 项目中修改):**
*   您只需要在 Android Studio 中修改代码，然后直接点击 "Run" 或 "Apply Changes"。Android Studio 会处理原生代码的编译和部署。这种情况下，您**不需要**执行 Web 应用的 `build` 或 Capacitor 的 `sync` 命令。

## 3.  **当您添加/移除 Capacitor 插件或修改 Capacitor 配置时:**
*   在安装或卸载插件后 (例如 `pnpm install some-plugin`)，您**必须**运行 `npx cap sync android` (或 `pnpm cap sync android`)。这个命令会更新原生项目的依赖和配置。
*   之后，您就可以在 Android Studio 中运行应用。

## **总结来说：**

*   **改 Web 代码 (如 <mcfile name="app.vue" path="c:\github\vben-admin\android\vben-admin\playground\src\app.vue"></mcfile>)**: `build` (Web) -> `sync` (Capacitor) -> `run` (Android Studio)，或者使用 Live Reload。
*   **改原生 Android 代码**: 直接在 Android Studio 中 `run`。
*   **改插件或 Capacitor 配置**: `sync` (Capacitor) -> `run` (Android Studio)。
        
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
