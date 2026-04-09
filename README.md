# [CSV→JSON] Converter

> Convert CSV files to JSON — drag-and-drop browser UI **and** a full-featured Node.js CLI. Zero dependencies.

---

## ✨ Features

### Browser App
- **Drag-and-drop** or click to upload `.csv` files
- **Live JSON preview** with syntax highlighting
- **Table view** toggle to inspect parsed data
- **Download** converted `.json` file instantly
- **Paste** CSV directly from clipboard
- Auto-detect delimiter (`,` `;` `\t` `|`)
- Options: type casting, null handling, output format, indent

### CLI
- Convert single files or batch (`*.csv`)
- Pipe from stdin / write to stdout
- `--output-dir` for batch output
- Colorized output with timing stats
- All the same options as the browser

### Parser Engine
- RFC 4180 compliant — handles quoted fields, escaped quotes, multiline fields
- Auto type-casting: numbers, booleans, null
- Three output formats: `array` | `object` (keyed) | `split`
- Shared `converter.js` works in both browser and Node

---

## 🚀 Getting Started

### Browser (GitHub Pages)
1. Push to GitHub → Settings → Pages → main branch → Save
2. Open `https://YOUR_USERNAME.github.io/csv-to-json`

### CLI — Global install
```bash
npm install -g csv2json-cli
csv2json data.csv
```

### CLI — Run locally
```bash
git clone https://github.com/YOUR_USERNAME/csv-to-json.git
cd csv-to-json
chmod +x bin/csv2json.js
node bin/csv2json.js sample.csv
```

---

## ⌨️ CLI Usage

```bash
# Basic
csv2json input.csv

# Custom output path
csv2json input.csv -o result.json

# Semicolon-delimited, no header
csv2json data.csv --delimiter ";" --no-header

# Batch convert folder
csv2json data/*.csv --output-dir ./json

# Pipe
cat data.csv | csv2json --stdin --stdout
csv2json data.csv --stdout | jq '.[0]'

# Options
csv2json data.csv --format keyed --indent 4 --no-types --no-nulls
```

### All flags

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <file>` | Output file | same name as input |
| `--output-dir <dir>` | Output dir for batch | — |
| `-d, --delimiter <char>` | `auto`,`,`,`;`,`\t`,`\|` | `auto` |
| `--no-header` | No header row | header on |
| `--no-types` | Disable type casting | casting on |
| `--no-nulls` | Keep empty as `""` | null on |
| `-f, --format` | `array` \| `object` \| `split` | `array` |
| `-i, --indent` | `2` \| `4` \| `tab` \| `0` | `2` |
| `--stdout` | Print to stdout | off |
| `--stdin` | Read from stdin | off |
| `-q, --quiet` | Suppress output | off |

---

## 🗂 Project Structure

```
csv-to-json/
├── index.html          ← Browser app
├── css/style.css       ← Terminal-green dark theme
├── js/
│   ├── converter.js    ← Shared parser (browser + Node)
│   └── app.js          ← Browser UI logic
├── bin/
│   └── csv2json.js     ← CLI entry point
├── test/
│   └── test.js         ← 18 tests, zero dependencies
├── sample.csv          ← Example file
└── package.json
```

---

## 🧪 Tests

```bash
npm test
# 18 passed, 0 failed
```

---

## License

MIT © 2024
