import { Hono } from 'hono';
import { z } from 'zod';
import type { AppCtx } from '../lib/middleware';
import { authUser, loadSubscription, requirePlan } from '../lib/middleware';
import { Err } from '../lib/errors';
import { newId } from '../lib/ids';
import { parseVoice } from '../services/voice';
import { enqueue } from '../services/command';

const app = new Hono<AppCtx>();
app.use('*', authUser, loadSubscription({ requireActive: true }), requirePlan('premium'));

const schema = z.object({
  device_id: z.string().min(1),
  transcript: z.string().min(1).max(400),
});

app.post('/command', async (c) => {
  const u = c.get('user')!;
  const { device_id, transcript } = schema.parse(await c.req.json());

  const device = await c.env.DB.prepare(
    `SELECT id, plan_bound, enabled FROM devices WHERE id=?1 AND user_id=?2`
  ).bind(device_id, u.id).first<any>();
  if (!device) throw Err.notFound('Device');
  if (!device.enabled) throw Err.forbidden('Device disabled');

  const parse = parseVoice(transcript);
  if (parse.error) {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs (id, user_id, device_id, command_text, execution_status)
       VALUES (?1, ?2, ?3, ?4, 'unparsed')`
    ).bind(newId(), u.id, device_id, transcript).run();
    return c.json(
      { error: { code: 'VOICE_PARSE', message: parse.error } },
      400,
    );
  }

  try {
    const command = await enqueue(c.env, {
      userId: u.id,
      deviceId: device_id,
      command: parse.parsed,
      source: 'voice',
    });
    if (command && typeof command.payload === 'string') {
      try { command.payload = JSON.parse(command.payload); } catch {}
    }
    await c.env.DB.prepare(
      `INSERT INTO voice_logs
         (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'queued')`
    ).bind(
      newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed),
    ).run();
    return c.json({ command, parsed: parse.parsed }, 202);
  } catch (e) {
    await c.env.DB.prepare(
      `INSERT INTO voice_logs
         (id, user_id, device_id, command_text, parsed_command, execution_status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'rejected')`
    ).bind(
      newId(), u.id, device_id, transcript, JSON.stringify(parse.parsed),
    ).run();
    throw e;
  }
});

app.get('/logs', async (c) => {
  const u = c.get('user')!;
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM voice_logs WHERE user_id=?1 ORDER BY created_at DESC LIMIT 100`
  ).bind(u.id).all<any>();
  return c.json({ logs: results });
});

export default app;
