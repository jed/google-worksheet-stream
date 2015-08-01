import {get, request} from "https"
import {Transform} from "readable-stream"
import {format} from "url"
import JSONStream from "JSONStream"

export default class Worksheet {
  constructor(options) {
    let {token, spreadsheetId, worksheetId = "od6"} = options

    this.host = "spreadsheets.google.com"
    this.path = `/feeds/cells/${spreadsheetId}/${worksheetId}/private/full`
    this.token = token
  }

  get cells() { return new Cells(this) }
  get rows() { return new Rows(this) }
  get objects() { return new Objects(this) }
}

class Cells{
  constructor(worksheet) {
    this.worksheet = worksheet
  }

  createReadStream(options) {
    let headers = {
      "GData-Version": "3.0",
      "If-Match": "*"
    }

    let query = {alt: "json"}
    for (let key in options) {
      let prop = key.replace(/[A-Z]/g, "-$&").toLowerCase()
      if (options[key]) query[prop] = options[key]
    }

    let {worksheet} = this
    let path = format({pathname: worksheet.path, query})
    options = {host: worksheet.host, headers, path}

    let parser = JSONStream.parse("feed.entry.*.gs$cell")
    let formatter = new Transform({objectMode: true})

    formatter._transform = function(data, enc, cb) {
      let {row, col, inputValue, numericValue} = data

      let key = [row, col].map(Number)
      let value = numericValue
        ? parseFloat(numericValue, 10)
        : inputValue

      this.push({key, value})
      cb()
    }

    parser.pipe(formatter)

    worksheet.token.get((err, token) => {
      if (err) return formatter.emit("error", err)

      let {token_type, access_token} = token
      headers.Authorization = `${token_type} ${access_token}`

      get(options, res => {
        if (res.statusCode >= 300) {
          let {statusCode, statusMessage} = res
          let err = new Error(`[${statusCode}] ${statusMessage}`)
          return parser.emit("error", err)
        }

        res.pipe(parser)
      })
    })

    return formatter
  }

  createWriteStream(options) {
    let headers = {
      "GData-Version": "3.0",
      "Content-Type": "application/atom+xml",
      "If-Match": "*"
    }

    let {worksheet} = this
    let path = format({pathname: `${worksheet.path}/batch`})
    options = {method: "POST", host: worksheet.host, headers, path}

    let formatter = new Transform({objectMode: true})

    formatter._transform = function(data, enc, cb) {
      let {key: [row, col], value} = data
      if (value == null) value = ""

      let entry =
        `<batch:operation type="update"/>` +
        `<id>https://${worksheet.host}${worksheet.path}/R${row}C${col}</id>` +
        `<gs:cell row="${row}" col="${col}" inputValue="${value}"/>`

      this.push(`<entry>${entry}</entry>`)
      cb()
    }

    formatter._flush = function(cb) {
      this.push(`</feed>`)
      cb()
    }

    this.worksheet.token.get((err, token) => {
      if (err) return formatter.emit("error", err)

      let {token_type, access_token} = token
      headers.Authorization = `${token_type} ${access_token}`

      let req = request(options, res => {
        if (res.statusCode >= 300) {
          let {statusCode, statusMessage} = res
          let err = new Error(`[${statusCode}] ${statusMessage}`)
          return formatter.emit("error", err)
        }
      })

      req.write(
        `<feed ` +
          `xmlns="http://www.w3.org/2005/Atom" ` +
          `xmlns:batch="http://schemas.google.com/gdata/batch" ` +
          `xmlns:gs="http://schemas.google.com/spreadsheets/2006">` +
          `<id>https://${this.host}${this.path}</id>`
      )

      formatter.pipe(req)
    })

    return formatter
  }
}

class Rows {
  constructor(worksheet) {
    this.cells = worksheet.cells
  }

  createReadStream(options) {
    let {minRow, maxRow} = options || {}
    let thisRow

    let rs = this.cells.createReadStream({minRow, maxRow})
    let transform = new Transform({objectMode: true})

    transform._transform = function(data, enc, cb) {
      let {key: [row, col], value} = data

      if (!thisRow) thisRow = {key: row, value: {}}

      if (thisRow.key === row) {
        thisRow.value[col] = value
        return cb()
      }

      this._flush(err => {
        err ? cb(err) : this._transform(data, enc, cb)
      })
    },

    transform._flush = function(cb) {
      if (thisRow) this.push(thisRow)
      thisRow = null
      cb()
    }

    return rs.pipe(transform)
  }

  createWriteStream() {
    let ws = this.cells.createWriteStream()
    let transform = new Transform({objectMode: true})

    transform._transform = function(data, enc, cb) {
      let {key, value} = data
      let offset = Number(Array.isArray(value))

      for (let col in value) this.push({
        key: [key, Number(col) + offset],
        value: value[col]
      })

      cb()
    }

    transform.pipe(ws)

    return transform
  }
}

class Objects {
  constructor(worksheet) {
    this.rows = worksheet.rows
    this.header = null
  }

  getHeader(cb) {
    if (this.header) setImmediate(cb, null, this.header)

    else this.rows
      .createReadStream({maxRow: 1})
      .once("data", data => {
        this.header = Object
          .keys(data.value)
          .map(col => ({name: data.value[col], col}))
      })
      .on("end", () => {
        this.header
          ? cb(null, this.header)
          : cb(new Error("No header exists."))
      })
  }

  createReadStream(options) {
    let {minRow, maxRow} = options || {}
    let self = this

    minRow = Math.max(minRow || 0, 2)

    let rs = this.rows.createReadStream({minRow, maxRow})
    let transform = new Transform({objectMode: true})

    transform._transform = function(data, enc, cb) {
      self.getHeader((err, header) => {
        if (err) return cb(err)

        let value = {}

        for (let key in header) {
          let {name, col} = header[key]

          if (col in data.value) {
            value[name] = data.value[col]
          }
        }

        this.push({key: data.key, value})
        cb()
      })
    }

    return rs.pipe(transform)
  }

  createWriteStream() {
    let self = this
    let ws = this.rows.createWriteStream()
    let transform = new Transform({objectMode: true})

    transform._transform = function(data, enc, cb) {
      self.getHeader((err, header) => {
        if (err) return cb(err)

        let value = {}

        for (let key in header) {
          let {name, col} = header[key]

          value[col] = data.value[name]
        }

        this.push({key: data.key, value})
        cb()
      })
    }

    transform.pipe(ws)

    return transform
  }
}
