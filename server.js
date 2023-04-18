require('dotenv').config()

const path = require('path')
const express = require('express')
const exphbs = require('express-handlebars')
const fileUpload = require('express-fileupload')
const routes = require('./app/routes/index.js')
const bodyParser = require('body-parser')
const http = require('http')
const helpers = require('./app/helpers')
const gradient = require('gradient-string')

const app = express()
const hbs = exphbs.create({
  extname: '.html',
  helpers,
  partialsDir: path.join(__dirname, 'app', 'templates', 'includes')
})

app.engine('html', hbs.engine)
app.set('view engine', 'html')
app.locals.layout = false
app.set('views', path.join(__dirname, 'app', 'templates'))
app.use(
  express.static(path.join(__dirname, 'app', 'public'), {
    'no-cache': true
  })
)
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(fileUpload({
  createParentPath: true
}))

app.use('/', routes)

app.use((request, response) => {
  response.status(404).render('static/404')
})

if (process.env.NODE_ENV !== 'DEV') {
  app.use((err, req, res) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
  })
}

console.log(gradient('red', 'yellow', 'green', 'blue')('-='.repeat(40)))

// Check that we have valid information in the .env file
if (!process.env.SVGDIR) {
  console.log()
  console.log(gradient('red', 'orange', 'yellow')('ERROR: Missing SVGDIR in .env file'))
  console.log('Please copy over the .env.example file to .env and fill in the required information')
  console.log()
  console.log(gradient('red', 'yellow', 'green', 'blue')('-='.repeat(40)))
  process.exit(1)
}

console.log('Listening on port: %s', process.env.PORT)
http.createServer(app).listen(process.env.PORT)
