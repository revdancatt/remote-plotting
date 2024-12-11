const {
  spawn
} = require('node:child_process')
const path = require('path')
const fs = require('fs')

function runCommand (args) {
  return new Promise(function (resolve, reject) {
    console.log('Running command: axicli ' + args.join(' '))
    const s = spawn('nextdraw', args)
    s.stdout.on('data', (data) => {
      // console.log(`stdout: ${data}`)
      resolve(data.toString().trim())
    })
    // For some reason axicli gives us the data in the stderr rather than out, so
    //  I guess we do it here
    s.stderr.on('data', (data) => {
      resolve(data.toString().trim())
    })
    s.on('close', (code) => {
      // console.log(`child process exited with code ${code}`)
    })
  })
}

exports.index = async (req, res) => {
  const startTime = new Date().getTime()

  let svgDIR = process.env.SVGDIR

  //  If we've been passed an svgfile, but it doesn't have an '.svg' then it's probably a folder
  if (req.params.svgfile) {
    if (!req.params.svgfile.includes('.svg')) {
      req.params.newDir = req.params.svgfile
      delete req.params.svgfile
    }
  }

  //  If we have a directory, then we need to switch to that one
  req.templateValues.newDir = ''
  if (req.params.newDir) {
    svgDIR = path.join(svgDIR, req.params.newDir)
    req.templateValues.newDir = req.params.newDir + '/'
  }

  //  Grab all the files inside it too
  const allFiles = fs.readdirSync(svgDIR).filter((file) => {
    return fs.statSync(path.join(svgDIR, file)).isFile()
  }).filter((file) => {
    return file[0] !== '.'
  })
  const svgFiles = allFiles.filter((file) => {
    const extensionSplit = file.split('.')
    const extension = extensionSplit.pop()
    return extension === 'svg'
  }).map((file) => {
    const fileObj = {
      filename: file
    }
    if (fs.existsSync(path.join(svgDIR, file.replace('.svg', '.json')))) {
      fileObj.status = '📊'
      const statusObj = JSON.parse(fs.readFileSync(path.join(svgDIR, file.replace('.svg', '.json')), 'utf-8'))
      if (statusObj.started) fileObj.status = '🦾'
    }
    return fileObj
  })
  req.templateValues.allFiles = allFiles
  req.templateValues.svgFiles = svgFiles

  //  See if we have been passed a single svgfile
  let jsonFile = null
  let jsonObj = {}
  if (req.params.svgfile) {
    req.templateValues.svgfile = req.params.svgfile
    jsonFile = path.join(svgDIR, req.params.svgfile.replace('.svg', '.json'))
  }

  //  If we have been sent an action, then we need to do that here

  if (req.body.action) {
    if (req.body.action === 'toggle') {
      await runCommand(['-m', 'utility', '-M', 'toggle'])
    }

    if (req.body.action === 'toggle50') {
      await runCommand(['-m', 'utility', '--mode', 'toggle', '--penlift', '3', '--pen_pos_up', '50'])
    }

    if (req.body.action === 'align') {
      await runCommand(['-m', 'utility', '-M', 'disable_xy'])
    }

    if (req.body.action === 'walk_home') {
      await runCommand(['-m', 'utility', '-M', 'walk_home'])
    }

    if (req.body.action === 'version') {
      global.version = await runCommand(['version'])
      // req.templateValues.version = bl.toString()
    }

    if (req.body.action === 'sysinfo') {
      global.sysinfo = await runCommand(['-m', 'sysinfo'])
    }

    //  delete the files
    if (req.body.action === 'delete') {
      if (fs.existsSync(path.join(svgDIR, req.params.svgfile))) fs.unlinkSync(path.join(svgDIR, req.params.svgfile))
      if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile)
      if (req.params.newDir) return res.redirect(`/${req.params.newDir}`)
      return res.redirect('/')
    }

    if (req.body.action === 'deleteDirectory') {
      fs.rmdirSync(svgDIR)
      return res.redirect('/')
    }

    if (req.body.action === 'uploadFile') {
      const svgFile = req.files.thisfile
      svgFile.mv(path.join(svgDIR, svgFile.name))
      if (req.params.newDir) return res.redirect(`/${req.params.newDir}/${svgFile.name}`)
      return res.redirect(`/${svgFile.name}`)
    }

    //  Make a new directory
    if (req.body.action === 'makeDirectory') {
      fs.mkdirSync(path.join(svgDIR, req.body.newDirectory))
      return res.redirect(`/${req.body.newDirectory}`)
    }

    if (req.body.action === 'preview') {
      let preview = null
      try {
        const params = []
        let file = `${process.env.SVGDIR}/`
        if (req.params.newDir) file += `${req.params.newDir}/`
        file += `${req.params.svgfile}`
        params.push(file)
        params.push('--model')
        params.push(process.env.MODEL)
        params.push('--report_time')
        params.push('--preview')
        if (req.body.constSpeed) params.push('--const_speed')
        if (req.body.brushless) params.push('--penlift')
        if (req.body.brushless) params.push('3')
        if (req.body.brushless) params.push('--pen_pos_up')
        if (req.body.brushless) params.push('50')
        params.push('-s')
        params.push(req.body.speed)
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
        jsonObj.brushless = false
        if (req.body.brushless) jsonObj.brushless = true
        jsonObj.speed = req.body.speed
        jsonObj.webhook = req.body.webhook.trim()
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

      const params = []
      let file = `${process.env.SVGDIR}/`
      if (req.params.newDir) file += `${req.params.newDir}/`
      file += `${req.params.svgfile}`
      params.push(file)
      params.push('--model')
      params.push(process.env.MODEL)
      if (req.body.constSpeed) params.push('--const_speed')
      if (req.body.brushless) params.push('--penlift')
      if (req.body.brushless) params.push('3')
      if (req.body.brushless) params.push('--pen_pos_up')
      if (req.body.brushless) params.push('50')
      params.push('-s')
      params.push(req.body.speed)
      if (req.body.webhook.trim() !== '') {
        params.push('--webhook')
        params.push('--webhook_url')
        params.push(req.body.webhook.trim())
      }
      runCommand(params)
    }

    if (req.params.newDir) {
      if (req.params.svgfile) return res.redirect(`/${req.params.newDir}/${req.params.svgfile}`)
      return res.redirect(`/${req.params.newDir}`)
    }
    if (req.params.svgfile) return res.redirect(`/${req.params.svgfile}`)
    return res.redirect('/')
  }

  //  If we have a jsonFile of the thing we are looking at read it in
  if (jsonFile && fs.existsSync(jsonFile)) jsonObj = JSON.parse(fs.readFileSync(jsonFile), 'utf-8')
  if (jsonObj && jsonObj.time && jsonObj.time.totalSeconds) {
    const futureTime = new Date(new Date().getTime() + (jsonObj.time.totalSeconds * 1000))
    jsonObj.time.futureTime = futureTime
  }
  if (!jsonObj.speed) jsonObj.speed = process.env.DEFAULTSPEED
  if (!jsonObj.webhook) jsonObj.webhook = process.env.WEBHOOK.trim()

  //  Check to see if we are in progress
  if (jsonObj.started) {
    //  find the elapsed time
    const elapsed = Math.floor((new Date().getTime() - jsonObj.started) / 1000)
    const percent = Math.floor(elapsed / jsonObj.time.totalSeconds * 10000) / 100
    const remaining = jsonObj.time.totalSeconds - elapsed
    if (remaining <= 0) {
      delete jsonObj.started
      jsonObj.finished = true
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

  if (global.sysinfo) {
    req.templateValues.sysinfo = global.sysinfo
    delete global.sysinfo
  }

  req.templateValues.elapsed = new Date().getTime() - startTime
  return res.render('main/index', req.templateValues)
}

exports.dir = async (req, res) => {
  const startTime = new Date().getTime()

  const svgDIR = process.env.SVGDIR
  req.templateValues.directories = fs.readdirSync(svgDIR).filter((file) => {
    return fs.statSync(path.join(svgDIR, file)).isDirectory()
  })

  req.templateValues.elapsed = new Date().getTime() - startTime
  return res.render('dir/index', req.templateValues)
}
