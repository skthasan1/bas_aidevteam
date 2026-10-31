# Windows notes for the QA lead

Purpose: lessons about running tests on Windows, so the same time is not lost twice. These are general; check each against your own machine.

## Shell

- Know which shell your tool runs: PowerShell, or a POSIX shell such as Git Bash. Syntax differs. `&&` does not exist in older PowerShell; use `;` with an `if ($?)`. Backticks and heredocs differ.
- Do not write a script in one shell's syntax and run it in the other.
- Set an environment variable per command: `$env:NAME = 'value'` in PowerShell, `NAME=value command` in a POSIX shell.
- Quote paths that contain spaces.

## Paths and separators

- Windows uses `\`; many tools accept `/`. Config files, test snapshots and globs are more portable with `/`.
- Case: Windows file systems are case-insensitive, Linux CI is not. A test that passes on a mismatched name locally can fail in CI. Match the case in imports.
- Long paths: very deep folders can exceed the old path limit. Keep the workspace near a drive root, or enable long paths.
- Line endings: a file saved with CRLF can break a shell script or change a snapshot. Check `git config core.autocrlf` and prefer LF for scripts.
- When a test compares paths, normalise them first.

## Symlinks

- Creating a symbolic link may need Developer Mode or an elevated shell. Without it, a checkout that contains links becomes plain text files holding the target path, and tests then fail in strange ways.
- Workspaces that rely on links (package managers that link a store into each project) may need a copy mode instead. If installs behave oddly, check whether a link was created or a file.
- Do not delete a folder that contains a link with a tool that follows links; you may delete the target's contents.

## Processes and ports

- A dev server that was stopped uncleanly can leave a process holding the port. Look up the owner of the port before you kill anything, and only stop processes you started. Others' ports are not yours.
- Start a server in the background and read its log; do not sleep in a loop waiting for it.
- Use a different port from the developers' own running copy, and record it in the report.

## Browsers and scripts

- Headless browsers need their binaries downloaded once; that is an install, so do it only where your role allows.
- Screenshots: set the viewport and device scale explicitly; a screen with display scaling at 125 or 150 percent changes pixel measurements if you do not.
- Dev-tools emulation of forced colours is not a real Windows high-contrast theme. If you can run the real theme, do, and say which you used.
- Fonts differ by OS. A line-wrap difference between your Windows run and a Linux CI run is not necessarily a bug.

## Files

- A file open in an editor or a scanner may be locked and a delete fails. Close it or retry; do not work around it by renaming system files.
- Antivirus scanning can slow installs and file watchers. Note slow numbers as "on Windows with scanning on".
- Time zones: set them explicitly when a test depends on dates.

## Report it

Put "OS: Windows <version>, shell: <which>" in every report's environment. A failure that only happens on Windows is still a finding; say it is Windows-only and give the CI result if you have one.
