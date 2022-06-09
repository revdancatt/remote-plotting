const fs = require('fs')
const path = require('path')
const moment = require('moment')

exports.ifIndexDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor === 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIndexNotDivisibleBy = (index, divisor, options) => {
  if ((index + 1) % divisor !== 0 && index > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.indexOf = (context, ndx, options) => options.fn(context[ndx])

exports.ifEven = (n, options) => {
  if (n % 2 === 0 || n === 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifOdd = (n, options) => {
  if (n % 2 !== 0 && n > 0) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqual = (v1, v2, options) => {
  if (v1 === v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifNotEqual = (v1, v2, options) => {
  if (v1 !== v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgt = (v1, v2, options) => {
  if (v1 > v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifgte = (v1, v2, options) => {
  if (v1 >= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflt = (v1, v2, options) => {
  if (v1 < v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.iflte = (v1, v2, options) => {
  if (v1 <= v2) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifEqualNumbers = (v1, v2, options) => {
  if (parseInt(v1, 10) === parseInt(v2, 10)) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.ifIsNotNull = (v1, options) => {
  if (v1 !== null) {
    return options.fn(this)
  }
  return options.inverse(this)
}

exports.and = (v1, v2) => {
  return v1 && v2
}

exports.or = (v1, v2, options) => {
  if (v1 || v2) return options.fn(this)
  return options.inverse(this)
}

exports.notor = (v1, v2, options) => {
  if (!(v1 || v2)) return options.fn(this)
  return options.inverse(this)
}

exports.subtract = (v1, v2) => {
  return v1 - v2
}

exports.multiply = (v1, v2) => {
  const result = v1 * v2
  if (parseInt(result, 10) === result) return result
  return result.toFixed(2)
}

exports.timePretty = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('dddd, MMMM Do YYYY, h:mm:ss a')
}

const datePrettyNoYear = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('dddd, MMMM Do')
}
exports.datePrettyNoYear = datePrettyNoYear

const datePretty = t => {
  if (t === null || t === undefined) return ''
  return moment(t).format('dddd, MMMM Do YYYY')
}
exports.datePretty = datePretty

exports.datePrettyDM = (day, month) => {
  const d = new Date()
  const thisYear = new Date(d.getFullYear(), month - 1, day)
  const nextYear = new Date(d.getFullYear() + 1, month - 1, day)
  if (thisYear < d) {
    return datePretty(nextYear)
  }
  return datePretty(thisYear)
}

const timeAgo = backThen => {
  if (backThen === null || backThen === undefined) return ''
  // const d = new Date()
  // const bd = new Date(backThen)
  // if (d.getMonth() === bd.getMonth() && d.getDate() === bd.getDate()) return 'Today'
  return moment(backThen).fromNow()
}
exports.timeAgo = timeAgo

const timeUntil = backThen => {
  if (backThen === null || backThen === undefined) return ''

  // const d = new Date()
  // const bd = new Date(backThen)
  // if (d.getMonth() === bd.getMonth() && d.getDate() === bd.getDate()) return 'Today'
  return moment(new Date().getTime()).to(backThen)
}
exports.timeUntil = timeUntil

exports.timeAgoDM = (day, month) => {
  const d = new Date()
  const thisYear = new Date(d.getFullYear(), month - 1, day)
  const nextYear = new Date(d.getFullYear() + 1, month - 1, day)
  if (thisYear < d) {
    return timeAgo(nextYear)
  }
  return timeAgo(thisYear)
}

exports.duration = (startTime, endTime) => {
  const start = moment(startTime)
  const end = moment(endTime)
  console.log(end.diff(start, 'seconds'))
  return moment.duration(endTime - startTime).humanize()
}

exports.durationPrecise = (startTime, endTime) => {
  const start = moment(startTime)
  const end = moment(endTime)
  let seconds = end.diff(start, 'seconds')
  let minutes = 0
  let hours = 0
  let days = 0

  if (seconds > 60) {
    minutes = seconds
    seconds = seconds - (Math.floor(seconds / 60) * 60)
    minutes = Math.floor((minutes - seconds) / 60)
  }

  if (minutes > 60) {
    hours = minutes
    minutes = minutes - (Math.floor(minutes / 60) * 60)
    hours = Math.floor((hours - minutes) / 60)
  }

  if (hours > 24) {
    days = hours
    hours = hours - (Math.floor(hours / 24) * 24)
    days = Math.floor((days - hours) / 24)
  }

  const niceDiff = []
  if (days === 1) niceDiff.push(`${days} day`)
  if (days > 1) niceDiff.push(`${days} days`)
  if (hours === 1) niceDiff.push(`${hours} hour`)
  if (hours > 1) niceDiff.push(`${hours} hours`)
  if (minutes === 1) niceDiff.push(`${minutes} minute`)
  if (minutes > 1) niceDiff.push(`${minutes} minutes`)
  if (seconds === 1) niceDiff.push(`${seconds} second`)
  if (seconds > 1) niceDiff.push(`${seconds} seconds`)
  if (niceDiff.length > 0) {
    niceDiff[niceDiff.length - 1] = `and ${niceDiff[niceDiff.length - 1]}`
  }
  return niceDiff.join(', ')
}

exports.prettyNumber = x => {
  if (x === null || x === undefined) return ''
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

exports.dumpThis = object => {
  console.log(object)
  return ''
}

exports.dumpJSON = object => {
  let pre = "<pre class='admin_view'>"
  pre += JSON.stringify(object, null, 4)
  pre += '</pre>'
  return pre
}

exports.dumpJSONunformatted = object => {
  return JSON.stringify(object, null, 4)
}

exports.addReturns = text => {
  if (text === null || text === undefined) return ''
  return text.replace(/\n/g, '<br />')
}

exports.toUpperCase = text => {
  if (text === null || text === undefined) return ''
  return text.toUpperCase()
}

exports.openSeaLink = (name, curationStatus) => {
  let link = 'https://opensea.io/assets/art-blocks'
  if (curationStatus === 'playground') link += '-playground'
  if (curationStatus === 'factory') link += '-factory'
  link += `?ref=0x29b2f895343cadfb3f5101bef6484b1f01c83dc9&search[stringTraits][0][name]=${name}&search[stringTraits][0][values][0]=All%20${name}`
  if (link.slice(-1) !== 's') link += 's'
  return link
}

exports.openSeaFeatureLink = (name, curationStatus, feature, value) => {
  let link = 'https://opensea.io/assets/art-blocks'
  if (curationStatus === 'playground') link += '-playground'
  if (curationStatus === 'factory') link += '-factory'
  link += `?ref=0x29b2f895343cadfb3f5101bef6484b1f01c83dc9&search[stringTraits][0][name]=${name}&search[stringTraits][0][values][0]=`
  link += `${feature}%3A%20`
  link += encodeURIComponent(value)
  return link
}

exports.calcPercent = (count, total) => {
  return (count / total * 100).toFixed(2)
}

exports.truncate = (str, num) => {
  return str.length > num ? str.slice(0, num > 3 ? num - 3 : num) + '…' : str
}

exports.lastUpdated = () => {
  const againTxt = path.join(__dirname, '..', '..', 'data', 'again.txt')
  const mtime = fs.statSync(againTxt).mtime
  return timeAgo(mtime)
}

exports.lastOpenSea = () => {
  const openSeaTxt = path.join(__dirname, '..', '..', 'data', 'openSeaLastFetch.txt')
  const mtime = fs.statSync(openSeaTxt).mtime
  return timeAgo(mtime)
}

exports.lastTheGraph = () => {
  const theGraphTxt = path.join(__dirname, '..', '..', 'data', 'theGraphLastFetch.txt')
  const mtime = fs.statSync(theGraphTxt).mtime
  return timeAgo(mtime)
}

exports.totalProjectValue = (price, maxInvocations) => {
  return `value: ${price} * ${maxInvocations - 1} * 0.9 = <a href="https://www.google.com/search?q=${(price * (maxInvocations - 1) * 0.9).toFixed(8)}+eth+in+gbp">${(price * (maxInvocations - 1) * 0.9).toFixed(8)}</a>`
}
exports.encode = (text) => {
  try {
    return encodeURIComponent(text.replace(/\//g, '|'))
  } catch (er) {
    return text
  }
}

exports.toFixed = (price, places) => {
  try {
    return price.toFixed(places)
  } catch (er) {
    return ''
  }
}
