const {
  exec
} = require('node:child_process')
const path = require('path')
const fs = require('fs')

function runCommand (command) {
  return new Promise(function (resolve, reject) {
    const s = exec(command)
    s.stdout.on('data', (data) => {
      // console.log(`stdout: ${data}`)
      resolve(data.trim())
    })
    // For some reason axicli gives us the data in the stderr rather than out, so
    //  I guess we do it here
    s.stderr.on('data', (data) => {
      resolve(data.trim())
    })
    s.on('close', (code) => {
      // console.log(`child process exited with code ${code}`)
    })
  })
}

exports.index = async (req, res) => {
  const startTime = new Date().getTime()

  const downloadDir = process.env.DOWNLOADDIR

  //  Grab all the files inside it too
  const svgFiles = fs.readdirSync(downloadDir).filter((file) => {
    return fs.statSync(path.join(downloadDir, file)).isFile()
  }).filter((file) => {
    return file[0] !== '.'
  }).filter((file) => {
    const extensionSplit = file.split('.')
    const extension = extensionSplit.pop()
    return extension === 'svg'
  }).map((file) => {
    const fileObj = {
      filename: file
    }
    if (fs.existsSync(path.join(downloadDir, file.replace('.svg', '.json')))) {
      fileObj.status = '📊'
      const statusObj = JSON.parse(fs.readFileSync(path.join(downloadDir, file.replace('.svg', '.json')), 'utf-8'))
      if (statusObj.started) fileObj.status = '🦾'
    }
    return fileObj
  })
  req.templateValues.svgFiles = svgFiles

  //  See if we have been passed a single svgfile
  let jsonFile = null
  let jsonObj = {}
  if (req.params.svgfile) {
    req.templateValues.svgfile = req.params.svgfile
    jsonFile = path.join(downloadDir, req.params.svgfile.replace('.svg', '.json'))
  }

  //  If we have been sent an action, then we need to do that here
  if (req.body.action) {
    if (req.body.action === 'toggle') {
      await runCommand('axicli --mode toggle')
    }

    if (req.body.action === 'align') {
      await runCommand('axicli --mode align')
    }

    if (req.body.action === 'version') {
      global.version = await runCommand('axicli version')
      // req.templateValues.version = bl.toString()
    }

    if (req.body.action === 'preview') {
      let preview = null
      try {
        let params = `axicli /Users/danielcatt/Downloads/${req.params.svgfile} --config /Users/danielcatt/Downloads/axidraw_conf_A1.py --model 4 --report_time --preview`
        if (req.body.constSpeed) params += ' --const_speed'
        params += ` -s ${req.body.speed}`
        preview = await runCommand(params)
        const getTime = preview.replace('Estimated print time: ', '').split(' ')
        const times = getTime[0].split(':')
        let hours = 0
        let minutes = 0
        let seconds = 0
        if (times.length > 0) seconds = parseInt(times.pop(), 10)
        if (times.length > 0) minutes = parseInt(times.pop(), 10)
        if (times.length > 0) hours = parseInt(times.pop(), 10)

        let distance = 0
        for (let i = 0; i < getTime.length; i++) {
          if (getTime[i] === 'draw:') distance = parseFloat(getTime[i + 1])
        }

        const totalSeconds = (hours * 60 * 60) + (minutes * 60) + seconds

        if (fs.existsSync(jsonFile)) jsonObj = JSON.parse(fs.readFileSync(jsonFile), 'utf-8')
        jsonObj.time = {
          hours,
          minutes,
          seconds,
          totalSeconds
        }
        jsonObj.distance = distance
        jsonObj.constSpeed = false
        if (req.body.constSpeed) jsonObj.constSpeed = true
        jsonObj.speed = req.body.speed
        fs.writeFileSync(jsonFile, JSON.stringify(jsonObj, null, 4), 'utf-8')
      } catch (er) {
        console.log('ERROR')
        console.log(er)
      }
    }

    if (req.body.action === 'plot') {
      jsonObj = JSON.parse(fs.readFileSync(jsonFile), 'utf-8')
      jsonObj.started = new Date().getTime()
      await fs.writeFileSync(jsonFile, JSON.stringify(jsonObj, null, 4), 'utf-8')
      let params = `axicli /Users/danielcatt/Downloads/${req.params.svgfile} --config /Users/danielcatt/Downloads/axidraw_conf_A1.py --model 4`
      if (req.body.constSpeed) params += ' --const_speed'
      params += ` -s ${req.body.speed}`
      runCommand(params)
    }
    return res.redirect(`/${req.params.svgfile}`)
  }

  //  If we have a jsonFile of the thing we are looking at read it in
  if (jsonFile && fs.existsSync(jsonFile)) jsonObj = JSON.parse(fs.readFileSync(jsonFile), 'utf-8')
  if (jsonObj && jsonObj.time && jsonObj.time.totalSeconds) {
    const futureTime = new Date(new Date().getTime() + (jsonObj.time.totalSeconds * 1000))
    jsonObj.time.futureTime = futureTime
  }
  if (!jsonObj.speed) jsonObj.speed = 20

  //  Check to see if we are in progress
  if (jsonObj.started) {
    //  find the elapsed time
    const elapsed = Math.floor((new Date().getTime() - jsonObj.started) / 1000)
    const percent = Math.floor(elapsed / jsonObj.time.totalSeconds * 10000) / 100
    const remaining = jsonObj.time.totalSeconds - elapsed
    if (remaining <= 0) {
      delete jsonObj.started
      fs.writeFileSync(jsonFile, JSON.stringify(jsonObj, null, 4), 'utf-8')
    } else {
      jsonObj.elapsed = elapsed
      jsonObj.percent = percent
      jsonObj.remaining = remaining
      jsonObj.endTime = new Date(jsonObj.started + (jsonObj.time.totalSeconds * 1000))
    }
  }
  req.templateValues.svgObj = jsonObj

  if (global.version) {
    req.templateValues.version = global.version
    delete global.version
  }

  req.templateValues.elapsed = new Date().getTime() - startTime
  return res.render('main/index', req.templateValues)
}
