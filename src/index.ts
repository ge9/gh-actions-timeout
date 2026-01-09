import * as core from "@actions/core"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

async function runCommand(cmd: string): Promise<boolean> {
  try {
    await execAsync(cmd, { shell: "bash" })
    return true
  } catch {
    return false
  }
}

async function runCommandIgnoreResult(cmd: string): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { shell: "bash" })
    if (stdout) process.stdout.write(stdout)
    if (stderr) process.stderr.write(stderr)
  } catch (e: any) {
    if (e?.stdout) process.stdout.write(e.stdout)
    if (e?.stderr) process.stderr.write(e.stderr)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function postMain() {
  const interval = Number(core.getInput("interval") || "10")
  const timeout = Number(core.getInput("timeout") || "600")
  const checkCmd = core.getInput("check-cmd", { required: true })
  const keepCmdInput = core.getInput("keep-cmd")
  const keepCmd = keepCmdInput ? keepCmdInput : checkCmd
  const infoCmd = core.getInput("info-cmd")

  let remaining = timeout
  let everSucceeded = false

  core.info(`(post) interval=${interval}s timeout=${timeout}s`)

  while (remaining > 0) {
    if (!everSucceeded) {
      const ok = await runCommand(checkCmd)

      if (ok) {
        everSucceeded = true
        core.info("check-cmd succeeded, entering keep mode")
        continue
      }

      if (infoCmd) {
        await runCommandIgnoreResult(infoCmd)
      }

      remaining -= interval
      core.info(`waiting... (${remaining}s left)`)
    } else {
      const ok = await runCommand(keepCmd)

      if (!ok) {
        core.info("keep-cmd failed, exiting job")
        return
      }
    }

    await sleep(interval * 1000)
  }

  if (!everSucceeded) {
    core.info("timeout waiting for check-cmd to succeed")
  }
}

async function main() {
  if (!!core.getState("isPost")) {
    await postMain()
  }else{
  core.saveState("isPost", "true")
  const infoCmd = core.getInput("info-cmd")
  runCommandIgnoreResult(infoCmd)
  }
}

main().catch(err => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
