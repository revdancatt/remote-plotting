require('dotenv').config()

const path = require('path')
const express = require('express')
const exphbs = require('express-handlebars')
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
console.log('Listening on port: %s', process.env.PORT)
http.createServer(app).listen(process.env.PORT)
