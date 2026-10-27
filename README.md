# OpenSci Calculator

A free, open-source scientific calculator for Windows. It has natural textbook display, fractions, statistics, tables, equations, complex numbers, matrices, vectors, a spreadsheet, distributions, base-N and more. Every key works with the mouse or the PC keyboard. Open **SETTINGS → Get Started** in the app to see all keyboard shortcuts.

## Download

Get `OpenSci-Calculator-Portable.exe` from the [Releases](../../releases) page and double-click it. There's nothing to install.
Windows may show "Windows protected your PC" because the exe isn't signed. Click **More info → Run anyway**.

## Build from source

You need [Node.js](https://nodejs.org) 18 or newer.

```
npm install
npm start          # run the app
npm run dist       # build dist/OpenSci-Calculator-Portable.exe
```

On Windows you can also double-click `build-exe.bat`.

Tests live in `app/tests` (for example `node app/tests/features.mjs`). The pixel-comparison scripts (`try*.mjs`) need reference screenshots that aren't included in this repository.

## Licence

MIT. See [LICENSE](LICENSE). `app/src/vendor/decimal.mjs` is decimal.js by Michael Mclaughlin (MIT, see `decimal.LICENCE.md`).

## Disclaimer

This is an independent project. It isn't affiliated with, endorsed by or connected to Casio Computer Co., Ltd. All trademarks belong to their owners.
