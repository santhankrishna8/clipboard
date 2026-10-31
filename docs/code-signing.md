# Code signing with SignPath Foundation

Why: the installer is unsigned, so browsers say "isn't commonly downloaded" and Windows says "unknown publisher". SignPath Foundation signs open-source projects for free, with a certificate issued to SignPath Foundation. The warnings do not vanish on day one (Windows also weighs how many people have downloaded a file), but the publisher is named and reputation carries across versions.

What is already in the repository:

| File | What it does |
|---|---|
| `LICENSE` | MIT. SignPath only signs projects under an OSI-approved licence. |
| `README.md` | The code signing policy section SignPath asks projects to publish. |
| `.github/workflows/release.yml` | Builds the installer on GitHub's runners, sends it to SignPath when configured, and publishes the release with a SHA-256 checksum. Without the SignPath settings it publishes the installer unsigned. |
| `.signpath/artifact-configuration.xml` | Tells SignPath which file in the upload to sign. |
| `package.json` | The installer is always named `Clipvault-Setup.exe`, so the website's download link never changes. |

## What only you can do

1. **Turn on two-factor sign-in** for your GitHub account (Settings, Password and authentication). SignPath requires it for everyone who can release.
2. **Apply** at <https://signpath.org/> (the open-source programme). They ask for the project name, the repository (`https://github.com/santhankrishna8/clipboard`), the licence (MIT), and a short description. A description you can paste:

   > Clipvault is a Windows desktop app that keeps a private, encrypted clipboard history and a vault for ID numbers and documents, entirely on the user's own computer. It makes no network connections. Electron, Angular and TypeScript; MIT licensed; built from source on GitHub Actions.

   Approval is theirs. They may want to see that the project is maintained, so keep committing and publish releases.
3. **After approval**, in SignPath create the project with the slug `clipvault`, add the artifact configuration from `.signpath/artifact-configuration.xml` (slug `initial`), and a signing policy with the slug `release-signing`. Connect GitHub as the trusted build system. If SignPath's pages use different names, change the matching values in `.github/workflows/release.yml`.
4. **In the GitHub repository** (Settings, Secrets and variables, Actions) add:
   - the secret `SIGNPATH_API_TOKEN` (an API token from SignPath), and
   - the variable `SIGNPATH_ORGANIZATION_ID` (your organisation id, shown in SignPath).
5. **Publish a signed release:**
   ```
   git tag v1.0.1
   git push --tags
   ```
   The workflow builds, signs, and replaces `Clipvault-Setup.exe` on the release. The download button on the website keeps working.
6. Afterwards, edit the "not code-signed" sentences in `README.md` and in the download note on the website (`site/index.html`, the "Windows shows a warning" box).

SignPath's own documentation is the authority if anything above has changed: <https://docs.signpath.io/>.
