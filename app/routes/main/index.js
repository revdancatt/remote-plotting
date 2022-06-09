const {
  exec
} = require('node:child_process')
const path = require('path')
const fs = require('fs')

function runCommand (command) {
  return new Promise(function (resolve, reject) {
    const s = exec(command)
    /*
    s.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`)
    })
    */
    // For some reason axicli gives us the data in the stderr rather than out, so
    //  I guess we do it here
    s.stderr.on('data', (data) => {
      resolve(data.trim())
    })
    /*
    s.on('close', (code) => {
      console.log(`child process exited with code ${code}`)
    })
    */
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
  })
  req.templateValues.svgFiles = svgFiles

  //  See if we have been passed a single svgfile
  if (req.params.svgfile) {
    req.templateValues.svgfile = req.params.svgfile
  }

  //  If we have been sent an action, then we need to do that here
  if (req.body.action) {
    console.log('req.body.action: ', req.body.action)

    if (req.body.action === 'version') {
      // const bl = await spawn('axicli', ['version'])
      // req.templateValues.version = bl.toString()
    }

    if (req.body.action === 'preview') {
      let preview = null
      try {
        const params = `axicli /Users/danielcatt/Downloads/${req.params.svgfile} --config /Users/danielcatt/Downloads/axidraw_conf_A1.py --model 4 --const_speed -s 1 --report_time --preview`
        preview = await runCommand(params)
        console.log('1 -=-=-=-=-=-=-=-=-=-')
        console.log(preview)
        console.log('1 -=-=-=-=-=-=-=-=-=-')
      } catch (er) {
        console.log('ERROR')
        console.log(er)
      }
      if (preview) {
        // req.templateValues.preview = preview.toString()
      }
    }
  }

  req.templateValues.elapsed = new Date().getTime() - startTime
  return res.render('main/index', req.templateValues)
}
