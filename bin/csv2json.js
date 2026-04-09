#!/usr/bin/env node
'use strict';

/**
 * csv2json CLI
 * Usage: csv2json [files...] [options]
 */

const fs   = require('fs');
const path = require('path');
const { convert } = require('../js/converter.js');

// ── ANSI helpers ────────────────────────────────────────────────
const NO_COLOR = process.env.NO_COLOR || !process.stdout.isTTY;
const c = {
  reset:  s => NO_COLOR ? s : `\x1b[0m${s}\x1b[0m`,
  green:  s => NO_COLOR ? s : `\x1b[32m${s}\x1b[0m`,
  yellow: s => NO_COLOR ? s : `\x1b[33m${s}\x1b[0m`,
  cyan:   s => NO_COLOR ? s : `\x1b[36m${s}\x1b[0m`,
  red:    s => NO_COLOR ? s : `\x1b[31m${s}\x1b[0m`,
  dim:    s => NO_COLOR ? s : `\x1b[2m${s}\x1b[0m`,
  bold:   s => NO_COLOR ? s : `\x1b[1m${s}\x1b[0m`,
};

// ── Help ─────────────────────────────────────────────────────────
function help() {
  console.log(`
  ${c.cyan(c.bold('csv2json'))} — Convert CSV files to JSON

  ${c.bold('Usage:')}
    csv2json <file.csv> [options]
    csv2json *.csv --output-dir ./json
    cat data.csv | csv2json --stdin

  ${c.bold('Options:')}
    ${c.green('-o, --output <file>')}      Output file path (default: same name as input)
    ${c.green('--output-dir <dir>')}       Output directory for batch conversion
    ${c.green('-d, --delimiter <char>')}   CSV delimiter: auto | , | ; | \\t | |   [default: auto]
    ${c.green('--no-header')}              Treat first row as data, not headers
    ${c.green('--no-types')}               Disable automatic type casting
    ${c.green('--no-nulls')}               Keep empty values as "" instead of null
    ${c.green('-f, --format <fmt>')}       array | object | split               [default: array]
    ${c.green('-i, --indent <n>')}         Indentation: 2 | 4 | tab | 0        [default: 2]
    ${c.green('--stdout')}                 Print JSON to stdout instead of file
    ${c.green('--stdin')}                  Read CSV from stdin
    ${c.green('-q, --quiet')}              Suppress output except errors
    ${c.green('-h, --help')}               Show help
    ${c.green('-v, --version')}            Show version

  ${c.bold('Examples:')}
    csv2json data.csv
    csv2json data.csv -o result.json --indent 4
    csv2json *.csv --output-dir ./output
    csv2json data.csv --delimiter ";" --no-header --format split
    csv2json data.csv --stdout | jq '.[0]'
    cat piped.csv | csv2json --stdin --stdout
`);
}

// ── Arg parser ───────────────────────────────────────────────────
function parseArgs(argv) {
  const args  = argv.slice(2);
  const files = [];
  const opts  = {
    output:    null,
    outputDir: null,
    delimiter: 'auto',
    header:    true,
    autoTypes: true,
    nullEmpty: true,
    format:    'array',
    indent:    2,
    stdout:    false,
    stdin:     false,
    quiet:     false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => {
      if (args[i + 1] === undefined || args[i + 1].startsWith('-'))
        throw new Error(`Missing value for ${a}`);
      return args[++i];
    };

    switch (a) {
      case '-h': case '--help':    help(); process.exit(0); break;
      case '-v': case '--version':
        console.log(require('../package.json').version);
        process.exit(0); break;
      case '-o': case '--output':    opts.output    = next(); break;
      case '--output-dir':           opts.outputDir = next(); break;
      case '-d': case '--delimiter': opts.delimiter = next(); break;
      case '--no-header':  opts.header    = false; break;
      case '--no-types':   opts.autoTypes = false; break;
      case '--no-nulls':   opts.nullEmpty = false; break;
      case '-f': case '--format':  opts.format = next(); break;
      case '-i': case '--indent':
        const iv = next();
        opts.indent = iv === 'tab' ? 'tab' : iv === '0' ? 0 : parseInt(iv) || 2;
        break;
      case '--stdout': opts.stdout = true; break;
      case '--stdin':  opts.stdin  = true; break;
      case '-q': case '--quiet': opts.quiet = true; break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
        files.push(a);
    }
  }
  return { files, opts };
}

// ── Format helpers ───────────────────────────────────────────────
function fmtBytes(n) {
  if (n < 1024) return n + 'B';
  if (n < 1048576) return (n / 1024).toFixed(1) + 'KB';
  return (n / 1048576).toFixed(2) + 'MB';
}

// ── Convert a single file ────────────────────────────────────────
function convertFile(inputPath, opts, outputPath) {
  const csv = fs.readFileSync(inputPath, 'utf8');
  const t0  = Date.now();
  const result = convert(csv, opts);
  const elapsed = Date.now() - t0;

  if (opts.stdout) {
    process.stdout.write(result.json + '\n');
    return;
  }

  const outFile = outputPath || inputPath.replace(/\.csv$/i, '.json');
  fs.writeFileSync(outFile, result.json, 'utf8');

  if (!opts.quiet) {
    console.log(
      `  ${c.green('✔')}  ${c.bold(path.basename(inputPath))}` +
      c.dim(` → ${path.basename(outFile)}`) +
      `  ${c.cyan(result.rows + ' rows')}` +
      `  ${c.dim(result.cols + ' cols')}` +
      `  ${c.dim(fmtBytes(result.json.length))}` +
      `  ${c.dim(elapsed + 'ms')}`
    );
  }
}

// ── Read stdin ───────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  let parsedArgs;
  try {
    parsedArgs = parseArgs(process.argv);
  } catch (err) {
    console.error(c.red(`\n  ✖  ${err.message}\n`));
    console.error(c.dim('  Run csv2json --help for usage.\n'));
    process.exit(1);
  }

  const { files, opts } = parsedArgs;

  // Stdin mode
  if (opts.stdin) {
    try {
      const csv = await readStdin();
      const result = convert(csv, opts);
      if (opts.output) {
        fs.writeFileSync(opts.output, result.json, 'utf8');
        if (!opts.quiet) console.log(c.green(`  ✔  Written to ${opts.output}`));
      } else {
        process.stdout.write(result.json + '\n');
      }
    } catch (err) {
      console.error(c.red(`  ✖  ${err.message}`));
      process.exit(1);
    }
    return;
  }

  if (files.length === 0) {
    help();
    process.exit(0);
  }

  // Expand globs (basic)
  const expanded = [];
  for (const pattern of files) {
    if (pattern.includes('*')) {
      const dir   = path.dirname(pattern);
      const ext   = path.extname(pattern);
      const found = fs.readdirSync(dir || '.')
        .filter(f => f.endsWith(ext || '.csv'))
        .map(f => path.join(dir || '.', f));
      expanded.push(...found);
    } else {
      expanded.push(pattern);
    }
  }

  if (!opts.quiet) {
    console.log(`\n  ${c.cyan(c.bold('[CSV→JSON]'))}  converting ${expanded.length} file${expanded.length !== 1 ? 's' : ''}\n`);
  }

  let errCount = 0;

  for (const filePath of expanded) {
    if (!fs.existsSync(filePath)) {
      console.error(c.red(`  ✖  Not found: ${filePath}`));
      errCount++; continue;
    }

    let outputPath = opts.output;
    if (opts.outputDir) {
      if (!fs.existsSync(opts.outputDir)) fs.mkdirSync(opts.outputDir, { recursive: true });
      outputPath = path.join(opts.outputDir, path.basename(filePath).replace(/\.csv$/i, '.json'));
    }

    try {
      convertFile(filePath, opts, outputPath);
    } catch (err) {
      console.error(c.red(`  ✖  ${path.basename(filePath)}: ${err.message}`));
      errCount++;
    }
  }

  if (!opts.quiet) {
    const ok = expanded.length - errCount;
    console.log(`\n  ${ok > 0 ? c.green(`${ok} succeeded`) : ''}${errCount > 0 ? c.red(`  ${errCount} failed`) : ''}\n`);
  }

  if (errCount > 0) process.exit(1);
}

main();
