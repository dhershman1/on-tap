const { bold, dim, underline, green, cyan, red } = require('colorette')
const through = require('through2')
const duplexer = require('duplexer3')
const Parser = require('tap-parser')
const symbols = require('figures')

function isFinalStats (str) {
  return /^#\s(ok|tests|pass|fail|skip|failed):?\s{1,}\d?/.test(str)
}

function pad (str, n = 2) {
  return str.padStart(str.length + n)
}

function prettyStack (rawError) {
  return rawError.split('\n').map(pad).join('\n') + '\n'
}

function formatFail (f, hideStack) {
  const title = `${symbols.cross} ${f.name}`
  const divider = Array.from(title, () => '-').join('')
  const err = [
    pad(`${red(title)}`, 4),
    pad(`${red(divider)}`, 4),
    pad(cyan(`Operator: ${f.diag.operator}`), 4),
    pad(cyan(`Expected: ${f.diag.expected}`), 4),
    pad(cyan(`Actual: ${f.diag.actual}`), 4),
    pad(cyan(`At: ${f.diag.at}`), 4)
  ]

  if (hideStack) {
    return err.join('\n')
  }

  return err.concat(pad(cyan(`  Stack: ${prettyStack(f.diag.stack)}`))).join('\n')
}

function tapOn (args) {
  const startTime = new Date().getTime()
  const tap = new Parser()
  const output = through()
  const stream = duplexer(tap, output)
  let skippedTests = 0
  let lastStr = ''

  tap.on('pass', assert => {
    output.push(pad(`${green(symbols.tick)} ${dim(assert.name)}\n`, 4))
  })

  tap.on('fail', assert => {
    output.push(formatFail(assert, args.stack))
  })

  tap.on('skip', assert => {
    output.push(pad(`${cyan('-  ' + assert.name)}\n`, 4))
  })

  tap.on('comment', res => {
    const isSkip = /# SKIP/.test(res)

    if (isSkip || isFinalStats(res)) {
      if (isSkip) {
        skippedTests++
      }

      return
    }

    const cleanedStr = res.replace('# ', '')

    if (lastStr !== cleanedStr) {
      output.push(`\n\n${pad(underline(cleanedStr))}\n`)
      lastStr = cleanedStr
    }
  })

  tap.on('complete', results => {
    if (args.summarize) {
      const failCount = results.failures.length
      const [past, plural] = failCount === 1 ? ['was', 'failure'] : ['were', 'failures']
      const finalFailMsg = `${bold(red('Failed Tests:'))} There ${past} ${bold(red(failCount))} ${plural}\n\n`

      output.push('\n' + pad(finalFailMsg))
      results.failures.forEach(f => output.push(`${formatFail(f, args.stack)}\n`))
    }
    output.push('\n' + pad(`Total: ${results.count}\n`))
    output.push(pad(green(`Passed: ${results.pass}\n`)))
    output.push(pad(red(`Failed: ${results.fail}\n`)))
    output.push(pad(cyan(`Skipped: ${skippedTests}\n`)))
    output.push(pad(`Duration: ${new Date().getTime() - startTime}ms\n\n`))
  })

  return stream
}

module.exports = tapOn
