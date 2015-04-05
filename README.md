google-worksheet-stream
=======================

[![Build Status](https://travis-ci.org/jed/google-worksheet-stream.svg)](https://travis-ci.org/jed/google-worksheet-stream)

A streaming interface for [Google Spreadsheets][] that allows you to batch write and read worksheet cells.

Installation
------------

    npm install google-worksheet-stream

API
---

#### let worksheet = new Worksheet({token, spreadsheetId, worksheetId})

Returns a worksheet object with a property for each of the three levels of abstraction: `cells`, `rows`, and `objects`.

This constructor takes three arguments:

- `token` (required): A token instance from [google-oauth-jwt-stream][].
- `spreadsheetId` (required): The 44-character ID of the spreadsheet, as found in its URL.
- `worksheetId` (options): The ID of the worksheet within the spreadsheet, defaulting to `od6`.

### Cells

#### let rs = worksheet.cells.createReadStream(options)

Returns a readable object stream of the cells in the worksheet. Each cell emitted has two properties:

- `key`: a `[row, column]` array of numbers identifying the cell
- `value`: a string or number representing the cell value

The `options` object is not required, and can take the following properties, as documented in the [fetch API][]:

- `minRow`: the minimum row returned, inclusive
- `maxRow`: the maximum row returned, inclusive
- `minCol`: the minimum column returned, inclusive
- `maxCol`: the maximum column returned, inclusive

#### let ws = worksheet.cells.createWriteStream()

Returns a writable object stream of the cells in the worksheet, with the same spec as the readable stream above.

### Rows

#### let rs = worksheet.rows.createReadStream(options)

Returns a readable object stream of the rows in the worksheet. This is an abstraction on top of the `cells` interface in which cells are grouped by row. Each row emitted has two properties:

- `key`: a number identifying the row
- `value`: an object with column numbers as keys and cells as values.

The `options` object is not required, and can take the following properties:

- `minRow`: corresponds to `minRow` in the cell API
- `maxRow`: corresponds to `maxRow` in the cell API

#### let ws = worksheet.rows.createWriteStream()

Returns a writable object stream of the rows in the worksheet, with the same spec as the readable stream above. This stream will also accept arrays as values, in which case keys will be incremented by one, so that the following rows are identical:

- `{key: 2, value: {1: "Jed Schmidt", 2: "@jedschmidt"}}`
- `{key: 2, value: ["Jed Schmidt", "@jedschmidt"]}`

### Objects

#### let rs = worksheet.objects.createReadStream(options)

Returns a readable object stream of the objects in the worksheet. This is an abstraction on top of the `rows` interface, in which column numbers are replaced with attribute names obtained from the first row (the "header" row). Each row emitted has two properties:

- `key`: a number identifying the row
- `value`: an object with column names as keys and cells as values.

The `options` object is not required, and can take the following properties:

- `minRow`: corresponds to `minRow` in the cell API, but starting at 2, since row 1 is used as the header row.
- `maxRow`: corresponds to `maxRow` in the cell API

#### let ws = worksheet.objects.createWriteStream()

Returns a writable object stream of the objects in the worksheet, with the same spec as the readable stream above.

[google-oauth-jwt-stream]: https://github.com/jed/google-oauth-jwt-stream
[Google Spreadsheets]: https://docs.google.com/spreadsheets
[fetch API]: https://developers.google.com/google-apps/spreadsheets/#fetching_specific_rows_or_columns
