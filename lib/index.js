/**
 * dsh-preset-switch — host half.
 *
 * Registers a `/preset <id>` slash command that re-links a RUNNING session's
 * agent scope to another agent preset (the same `agentPresets.recompose`
 * mechanism `agentPreset.select` uses for blank sessions, without the
 * blank-session lock), records the switch in the session log, and appends a
 * model-visible `<system-reminder>` notice so the next turn knows its tools
 * and prompt follow the new preset.
 *
 * No `harness` needed: this is an ordinary host-plane Cordis plugin using the
 * public `commands`, `agentPresets`, and session services.
 */

export const name = 'preset-switch'

export function apply(ctx) {
  let seq = 0
  /** Per-session serialization: two concurrent switches must not interleave. */
  const pending = new Map()

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'preset',
      description: 'Switch this session to another agent preset (running session; tools and prompt follow the new preset from the next turn)',
      input: { hint: '<preset>' },
      handler: async ({ agent, rawInput }) => {
        const presets = ctx.get('agentPresets')
        if (presets === undefined) {
          return { kind: 'error', text: 'this deployment composes no agent presets' }
        }
        const requested = rawInput.trim()
        if (requested === '') {
          return { kind: 'error', text: 'usage: /preset <id> — pick one from the mode button beside the access-mode control' }
        }
        const run = (pending.get(agent.session.id) ?? Promise.resolve()).then(async () => {
          let target
          try {
            target = await presets.resolve(requested)
          } catch (error) {
            return { kind: 'error', text: `unknown or unusable preset "${requested}": ${String(error && error.message ? error.message : error)}` }
          }
          const before = presets.composedPreset(agent.ctx)
          try {
            await presets.recompose(agent.ctx, target.id)
          } catch (error) {
            return { kind: 'error', text: `failed to switch to "${requested}": ${String(error && error.message ? error.message : error)}` }
          }
          agent.session.append('agent-preset/selected', { agentPreset: target.id })
          const fromText = before === undefined ? '' : before
          const toText = target.name === undefined ? target.id : `${target.name} (${target.id})`
          const notice = '<system-reminder>agent preset switched' +
            (fromText === '' ? '' : ` from ${fromText}`) +
            ` to ${toText}. Your tools and capabilities now follow the new preset.</system-reminder>`
          agent.session.append('user/message', {
            id: `preset-switch-${String(seq++)}`,
            role: 'user',
            content: [{ type: 'text', text: notice }],
            source: { kind: 'plugin', plugin: 'preset-switch' }
          }, { surfaceOp: 'append' })
          return { kind: 'success', text: `switched to ${toText}` }
        })
        pending.set(agent.session.id, run.catch(() => undefined))
        try {
          return await run
        } finally {
          if (pending.get(agent.session.id) === run) pending.delete(agent.session.id)
        }
      }
    })
  })
}
