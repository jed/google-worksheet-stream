import fs from "fs"
import {deepEqual} from "assert"
import {Transform} from "stream"
import concat from "concat-stream"
import async from "async"
import {Token} from "google-oauth-jwt-stream"
import Worksheet from "./google-worksheet-stream"

let email = "91515745676-4gfajos94ps431fm229noqp5rg6hc4og@developer.gserviceaccount.com"
let key = fs.readFileSync("./key.pem")
let scopes = ["https://spreadsheets.google.com/feeds"]

let token = new Token(email, key, scopes)
let spreadsheetId = "16FFNmcTKAcQmMcbO087QzjgnGBh9iP8ME3QTMPD69hE"
let worksheetId = "od6"

let worksheet = new Worksheet({token, spreadsheetId, worksheetId})

let cells = [
  {key: [1, 1], value: "name"            },
  {key: [1, 2], value: "twitter"         },
  {key: [2, 1], value: "Jed Schmidt"     },
  {key: [2, 2], value: "@jedschmidt"     },
  {key: [3, 1], value: "Brian Brennan"   },
  {key: [3, 2], value: "@brianloveswords"},
  {key: [4, 1], value: "Mariko Kosaka"   },
  {key: [4, 2], value: "@kosamari"       },
  {key: [5, 1], value: "Willman Duffy"   },
  {key: [5, 2], value: "@willmanduffy"   }
]

let rows = [
  {key: 1, value: {1: "name"          , 2: "twitter"         }},
  {key: 2, value: {1: "Jed Schmidt"   , 2: "@jedschmidt"     }},
  {key: 3, value: {1: "Brian Brennan" , 2: "@brianloveswords"}},
  {key: 4, value: {1: "Mariko Kosaka" , 2: "@kosamari"       }},
  {key: 5, value: {1: "Willman Duffy" , 2: "@willmanduffy"   }}
]

let objects = [
  {key: 2, value: {name: "Jed Schmidt"   , twitter: "@jedschmidt"     }},
  {key: 3, value: {name: "Brian Brennan" , twitter: "@brianloveswords"}},
  {key: 4, value: {name: "Mariko Kosaka" , twitter: "@kosamari"       }},
  {key: 5, value: {name: "Willman Duffy" , twitter: "@willmanduffy"   }}
]

let reset = cb => {
  let rs = worksheet.cells.createReadStream()
  let ws = worksheet.cells.createWriteStream()
  let t = new Transform({
    objectMode: true,
    transform(data, enc, cb) {
      cb(null, {key: data.key, value: null})
    }
  })

  rs.pipe(t).pipe(ws).on("end", cb)
}

let isEmpty = cb => {
  let rs = worksheet.cells.createReadStream()
  let ws = concat(remoteCells => {
    deepEqual(remoteCells, [])
    cb()
  })

  rs.pipe(ws)
}

let writeCells = cb => {
  let ws = worksheet.cells.createWriteStream()

  for (let cell of cells) ws.write(cell)
  ws.end()

  setImmediate(cb)
}

let readCells = cb => {
  let rs = worksheet.cells.createReadStream()
  let ws = concat(remoteCells => {
    deepEqual(cells, remoteCells)
    cb()
  })

  rs.pipe(ws)
}

let writeRows = cb => {
  let ws = worksheet.rows.createWriteStream()

  for (let row of rows) ws.write(row)
  ws.end()

  setImmediate(cb)
}

let readRows = cb => {
  let rs = worksheet.rows.createReadStream()
  let ws = concat(remoteRows => {
    deepEqual(rows, remoteRows)
    cb()
  })

  rs.pipe(ws)
}

let writeObjects = cb => {
  let ws = worksheet.objects.createWriteStream()

  for (let objects of objects) ws.write(objects)
  ws.end()

  setImmediate(cb)
}

let readObjects = cb => {
  let rs = worksheet.objects.createReadStream()
  let ws = concat(remoteObjects => {
    deepEqual(objects, remoteObjects)
    cb()
  })

  rs.pipe(ws)
}

let log = text => cb => {
  console.log(text)
  setImmediate(cb)
}

let sleep = s => cb => {
  setTimeout(cb, 0 | s * 1000)
}

let done = err => {
  if (err) throw err
}

async.series([
  log("emptying spreadsheet..."),
  reset, sleep(5),
  log("checking spreadsheet..."),
  isEmpty,
  log("ok."),

  log("writing cells..."),
  writeCells, sleep(5),
  log("reading cells..."),
  readCells,
  log("ok."),

  log("emptying spreadsheet..."),
  reset, sleep(5),
  isEmpty,
  log("ok."),

  log("writing rows..."),
  writeRows, sleep(5),
  log("reading rows..."),
  readRows,
  log("ok."),

  log("writing objects..."),
  writeObjects, sleep(5),
  log("reading objects..."),
  readObjects,
  log("ok.")
], done)
