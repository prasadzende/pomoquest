# 🍅 PomoQuest

A cute, pixel-game Pomodoro timer for **Windows, macOS and Linux**.
Type a time, press **START**, and the window stays on top of everything until the timer ends or you stop it.
Each session can be logged to your **Obsidian vault**.

## Download

Download the latest installers from [GitHub Releases](https://github.com/prasadzende/pomoquest/releases):

- **Windows:** setup installer or portable `.exe`
- **macOS:** `.dmg` for Intel and Apple Silicon
- **Linux:** `.AppImage` or `.deb`

GitHub Actions builds these installers and publishes a release for every commit pushed to `main`. Release names include the app version and build number.

![icon](build/icon.png)

## How it works

- **What are you doing?** Type your activity in the box under the timer. The first line becomes the log entry, and any extra lines are saved as notes under it. You can keep editing while the timer runs; whatever is there when it ends gets logged.
- **Tags.** Tap the tag chips (`#deepwork`, `#coding`, `#meeting`, `#learning`, `#planning`, `#review`, `#email`, `#admin`) to add them. Your picks are remembered for next time. Change the list in ⚙ Settings → Tags. You can also type `#anything` straight into the activity box.
- **One box, one button.** Type a time and press START (or Enter). You can type it any of these ways: `25`, `25:00`, `1:30:00`, `1h 30m`, `45 min`, `90s`.
- **Stays on top while running.** The window floats above all other windows and can't be minimised, hidden or closed. If you try, the tomato complains. On macOS it also follows you across Spaces and full-screen apps.
- **Time's up:** a chiptune fanfare plays, you get a desktop notification and a "TIME'S UP!" screen. Press OK and the window goes back to normal.
- **STOP** ends the session early. If it ran for at least a minute, it's logged as stopped early.
- **Game stuff:** XP, levels, coins and a day streak. The tomato hero reacts as you go.

## Obsidian logging (optional)

Click ⚙ and choose your vault with **Browse**. If you don't choose one, the timer still works and nothing is logged.

| Setting | What it does |
|---|---|
| Folder | Folder inside the vault (blank = vault root) |
| Note name | Daily (`2026-11-16`), daily day-first (`16-11-2026`), daily with weekday, weekly (`2026-W47`), monthly (`2026-11`), one single note (`Pomodoro Log`), or **Custom** |
| Heading | Entries go under this heading. It's created if it's missing. |
| Tags | Comma-separated list of tag chips shown under the activity box |

Custom names use Moment-style tokens (`YYYY`, `MM`, `DD`, `dddd`, `MMMM`, `WW`…). Put plain words in brackets, for example `[Focus] YYYY-MM`.
If you use Obsidian's Daily Notes plugin, its folder and date format are picked up automatically.
Settings save automatically, and the preview line shows exactly which note will be written.

Example entries:

```markdown
## 🍅 Pomodoro Log
- 🍅 **10:00 – 10:25** (25 min) Feature store design doc #deepwork #coding
	- Added the backfill section
	- Pinged Nishantha about SLAs
- ⏹️ **10:30 – 10:42** (12 min of 50 min, stopped early) Sprint planning prep #planning
```

Because tags are real Obsidian tags, you can click one in Obsidian to see every session with that tag.

Weekly, monthly and single-note names include the date in each line, for example `**Mon 16 Nov, 10:00 – 10:25**`.

## Run it

You need [Node.js 20+](https://nodejs.org).

```bash
npm install
npm start
npm test        # logic tests, no window needed
```

## Make installers

```bash
npm run dist:win     # Windows installer + portable .exe
npm run dist:mac     # macOS .dmg (Intel + Apple Silicon); run this on a Mac
npm run dist:linux   # Linux AppImage + .deb
```

Files land in `dist/`. The GitHub Actions workflow (`.github/workflows/build.yml`) tests and builds on Windows, macOS, and Linux, then publishes the installers as a GitHub Release whenever code is pushed or merged to `main`.

## Good to know

- If you quit with the timer running (Cmd+Q / Alt+F4), it asks first and logs the session as stopped early.
- The app isn't code-signed. On macOS, right-click it and choose **Open** the first time. On Windows, choose **More info → Run anyway**.
- Settings and XP live in your user data folder (`%APPDATA%/PomoQuest`, `~/Library/Application Support/PomoQuest`, `~/.config/PomoQuest`).

## License

PomoQuest is available under the [MIT License](LICENSE).
