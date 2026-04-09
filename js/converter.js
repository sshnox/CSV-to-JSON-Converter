/**
 * csv-converter.js
 * Shared CSV → JSON conversion engine.
 * Works in both browser (window.CsvConverter) and Node.js (module.exports).
 */

(function (global) {
  'use strict';

  /* ── CSV Parser ─────────────────────────────────────────────── */

  /**
   * Detect the most likely delimiter from the first few lines.
   */
  function detectDelimiter(text) {
    const sample = text.slice(0, 4096);
    const candidates = [',', ';', '\t', '|'];
    let best = ',', bestCount = -1;
    for (const d of candidates) {
      // Count occurrences outside of quotes in first line
      const firstLine = sample.split('\n')[0];
      let inQuote = false, count = 0;
      for (const ch of firstLine) {
        if (ch === '"') inQuote = !inQuote;
        else if (ch === d && !inQuote) count++;
      }
      if (count > bestCount) { bestCount = count; best = d; }
    }
    return best;
  }

  /**
   * Parse a single CSV line respecting RFC 4180 quoting.
   */
  function parseLine(line, delimiter) {
    const fields = [];
    let field = '';
    let inQuote = false;
    let i = 0;

    while (i < line.length) {
      const ch = line[i];

      if (inQuote) {
        if (ch === '"') {
          // Escaped quote?
          if (line[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuote = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuote = true;
        } else if (ch === delimiter) {
          fields.push(field);
          field = '';
        } else {
          field += ch;
        }
      }
      i++;
    }

    fields.push(field); // last field
    return fields;
  }

  /**
   * Split CSV text into rows, handling multi-line quoted fields.
   */
  function splitRows(text) {
    const rows = [];
    let current = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inQuote = !inQuote;
      if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQuote) {
        if (ch === '\r') i++; // skip \n of \r\n
        if (current !== '') rows.push(current);
        current = '';
      } else if (ch !== '\r') {
        current += ch;
      }
    }
    if (current.trim()) rows.push(current);
    return rows;
  }

  /* ── Type casting ───────────────────────────────────────────── */

  function castValue(raw, opts) {
    if (opts.nullEmpty && raw === '') return null;

    if (opts.autoTypes) {
      // Boolean
      if (raw === 'true' || raw === 'TRUE')  return true;
      if (raw === 'false' || raw === 'FALSE') return false;

      // Number — guard against empty and pure-whitespace
      const trimmed = raw.trim();
      if (trimmed !== '' && !isNaN(trimmed) && trimmed !== '') {
        const n = Number(trimmed);
        if (!isNaN(n)) return n;
      }
    }

    return raw;
  }

  /* ── Main converter ─────────────────────────────────────────── */

  /**
   * Convert CSV text to JSON.
   *
   * @param {string} csvText  - Raw CSV string
   * @param {Object} options
   *   delimiter  {string}  'auto' | ',' | ';' | '\t' | '|'
   *   header     {boolean} treat first row as headers
   *   autoTypes  {boolean} cast numbers/booleans
   *   nullEmpty  {boolean} convert empty strings to null
   *   format     {string}  'array' | 'object' | 'split'
   *   indent     {number|string} JSON indent (0 = minified, 'tab')
   *
   * @returns {{ json: string, rows: number, cols: number, records: any[] }}
   */
  function convert(csvText, options) {
    const opts = Object.assign({
      delimiter: 'auto',
      header:    true,
      autoTypes: true,
      nullEmpty: true,
      format:    'array',
      indent:    2,
    }, options);

    if (!csvText || !csvText.trim()) {
      throw new Error('CSV input is empty.');
    }

    const delimiter = opts.delimiter === 'auto'
      ? detectDelimiter(csvText)
      : (opts.delimiter === '\\t' ? '\t' : opts.delimiter);

    const rawRows = splitRows(csvText);
    if (rawRows.length === 0) throw new Error('No rows found in CSV.');

    let headers = [];
    let dataRows = rawRows;

    if (opts.header) {
      headers = parseLine(rawRows[0], delimiter).map(h => h.trim() || `col_${0}`);
      dataRows = rawRows.slice(1);
    } else {
      // Generate column names: col_0, col_1, ...
      const firstCols = parseLine(rawRows[0], delimiter).length;
      headers = Array.from({ length: firstCols }, (_, i) => `col_${i}`);
    }

    // Ensure unique headers
    const seen = {};
    headers = headers.map(h => {
      if (seen[h] !== undefined) { seen[h]++; return `${h}_${seen[h]}`; }
      seen[h] = 0; return h;
    });

    // Parse each row
    const records = dataRows
      .filter(r => r.trim())
      .map((row, ri) => {
        const fields = parseLine(row, delimiter);
        const obj = {};
        headers.forEach((h, i) => {
          const raw = i < fields.length ? fields[i] : '';
          obj[h] = castValue(raw, opts);
        });
        return obj;
      });

    // Build output
    let output;
    const indent = opts.indent === 'tab' ? '\t'
                 : opts.indent === 0 || opts.indent === '0' ? undefined
                 : Number(opts.indent) || 2;

    if (opts.format === 'object') {
      const key = headers[0];
      output = {};
      records.forEach(r => { output[r[key]] = r; });
    } else if (opts.format === 'split') {
      output = {
        columns: headers,
        rows: records.map(r => headers.map(h => r[h])),
      };
    } else {
      output = records;
    }

    return {
      json:    JSON.stringify(output, null, indent),
      records,
      rows:    records.length,
      cols:    headers.length,
      headers,
      delimiter,
    };
  }

  /* ── Export ─────────────────────────────────────────────────── */
  const CsvConverter = { convert, detectDelimiter, parseLine };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CsvConverter;
  } else {
    global.CsvConverter = CsvConverter;
  }

}(typeof window !== 'undefined' ? window : global));
