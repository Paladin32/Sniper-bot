import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const cases = [];
const voided = new Set();
const skull = new Set();
const antiAdmins = new Set();
const deleted = new Map();
const edited = new Map();
const afk = new Map();
const random = a => a[Math.floor(Math.random() * a.length)];
const idOf = s => s?.match(/^<@!?(\d+)>$/)?.[1] || (/^\d{17,20}$/.test(s || '') ? s : null);
const e = (title, description, color = 0x5865f2) => new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
const send = (m, value) => m.reply(typeof value === 'string' ? { content: value, allowedMentions: { repliedUser: false } } : { ...value, allowedMentions: { repliedUser: false } });
const allowed = (m, p) => m.member?.permissions?.has(p);
const logCase = (m, user, action, reason) => {
  const c = { id: (cases.at(-1)?.id || 0) + 1, guild: m.guild.id, user, mod: m.author.id, action, reason: reason || 'No reason provided', time: Date.now(), voided: false };
  cases.push(c); return c;
};
const duration = s => { const x = /^(\d+)(s|m|h|d)$/i.exec(s || ''); return x ? Number(x[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[x[2].toLowerCase()]) : null; };
async function member(m, raw) {
  const id = idOf(raw); if (!id) return { error: 'Mention a member or provide their Discord ID.' };
  const found = await m.guild.members.fetch(id).catch(() => null);
  return found ? { id, member: found } : { error: 'I could not find that member in this server.' };
}
async function need(m, p, name) { if (allowed(m, p)) return true; await send(m, 'You need the ' + name + ' permission.'); return false; }
const categories = {
  moderation: ['Moderation Commands', [
    's!ban @user [reason] — ban a member', 's!hardban @user [reason] / s!hb — hardban by ID',
    's!kick @user [reason] — kick a member', 's!mute @user time [reason] / s!unmute @user — manage timeouts',
    's!warn @user reason — DM a warning and log it', 's!unban user ID — unban a user', 's!banlist [page] — list server bans',
    's!modlogs @user|ID — view cases', 's!modstats @user|ID — view moderator totals',
    's!void @user|ID [case number] — void cases', 's!antinuke admin @user / s!antinuke remove @user',
    's!nick @user nickname / s!clearnick @user', 's!strip @user — remove manageable roles'
  ]],
  fun: ['Fun & Utilities', [
    's!8ball question — answer a yes/no question', 's!cf / s!coinflip — flip a coin', 's!afk [reason] — mark yourself AFK',
    's!dih [@user] — random fictional lamp measurement', 's!puh [@user] — random fictional underground-space measurement',
    's!compliment — receive a compliment', 's!highfive @user — high-five a member', 's!snipe / s!s — latest deleted message',
    's!editedsnipe / s!es — latest edited message', 's!cs / s!clearsnipes — clear snipe cache',
    's!ping — show bot latency', 's!uptime — show bot uptime', 's!userinfo [@user] — show account info', 's!av [@user|ID] / s!avatar [@user|ID] — show avatar'
  ]],
  tools: ['Server & Channel Tools', [
    's!clean — remove recent bot replies and command messages', 's!purge number / s!p number — delete 1–100 messages',
    's!autoskull — toggle skull reactions', 's!lock / s!unlock — lock or unlock this channel',
    's!serverinfo / s!si — show server information', 's!membercount — show member count', 's!channelinfo — inspect this channel', 's!roleinfo @role — inspect a role', 's!slowmode seconds — set channel slowmode', 's!poll question — create a yes/no poll', 's!role add/remove @user @role — manage roles', 's!say message / s!say embed message — post text or embed'
  ]],
  panels: ['Panels', [
    's!application — shows application panel in the channel where used', 's!support — shows support ticket panel in the channel where used'
  ]]
};
function categoryEmbed(key) { return e(categories[key][0], categories[key][1].map(x => '• ' + x).join('\n')); }
export function cacheDeletedMessage(m) {
  if (m.guild && !m.author?.bot && m.content) deleted.set(m.channel.id, { text: m.content, user: m.author, time: Date.now(), image: m.attachments?.first()?.url });
}
export function cacheEditedMessage(oldM, newM) {
  if (oldM.guild && !oldM.author?.bot && oldM.content && newM.content && oldM.content !== newM.content) edited.set(newM.channel.id, { before: oldM.content, after: newM.content, user: newM.author, time: Date.now() });
}
export async function handlePrefixCommand(m, { postApplicationMenu, postTicketPanel, client, makeApplicationEmbed }) {
  if (!m.guild || m.author.bot) return false;
  if (afk.has(m.author.id) && !m.content.toLowerCase().startsWith('s!')) { afk.delete(m.author.id); await send(m, 'Welcome back! Your AFK status was removed.'); }
  for (const u of m.mentions.users.values()) if (afk.has(u.id)) await send(m, u.tag + ' is AFK: ' + afk.get(u.id).reason);
  if (skull.has(m.channel.id)) await m.react('💀').catch(() => {});
  if (!m.content.toLowerCase().startsWith('s!')) return false;
  const a = m.content.trim().split(/\s+/).slice(1), cmd = (a.shift() || '').toLowerCase(), rest = a.join(' ');
  try {
    if (cmd === 'help') {
      const k = (a[0] || '').toLowerCase();
      const key = ['moderation', 'mod'].includes(k) ? 'moderation' : ['fun', 'utilities'].includes(k) ? 'fun' : ['tools', 'server', 'channel'].includes(k) ? 'tools' : ['panels', 'panel'].includes(k) ? 'panels' : null;
      if (key) await send(m, { embeds: [categoryEmbed(key)] });
      else await send(m, { embeds: [e('Sniper Bot — Help', '**1. Moderation Commands**\nBans, kicks, timeouts, warnings, cases\n\n**2. Fun & Utilities**\nFun, snipes, AFK, avatar, ping\n\n**3. Server & Channel Tools**\nPurge, lock, clean, server info\n\n**4. Panels**\nApplication and support ticket panels\n\nUse s!help moderation, s!help fun, s!help tools, or s!help panels.')] });
      return true;
    }
    if (cmd === 'helpstaff') { await send(m, 's!helpstaff is not included.'); return true; }
    if (Object.hasOwn(categories, cmd)) { await send(m, { embeds: [categoryEmbed(cmd)] }); return true; }
    if (cmd === 'application' || cmd === 'support') {
      if (!allowed(m, PermissionFlagsBits.Administrator)) { await send(m, 'Only administrators can post panels.'); return true; }
      if (cmd === 'application') await postApplicationMenu(m.channel); else await postTicketPanel(m.channel);
      return true;
    }
    if (['ban', 'hardban', 'hb'].includes(cmd)) {
      if (!await need(m, PermissionFlagsBits.BanMembers, 'Ban Members')) return true;
      const id = idOf(a[0]); if (!id) { await send(m, 'Usage: s!ban @user [reason] or s!hardban userID [reason].'); return true; }
      const reason = a.slice(1).join(' ') || 'No reason provided';
      if (cmd === 'ban') { const t = await member(m, a[0]); if (t.error || t.id === m.author.id || !t.member.bannable) { await send(m, t.error || 'I cannot ban that member.'); return true; } }
      await m.guild.members.ban(id, { reason: m.author.tag + ': ' + reason, deleteMessageSeconds: cmd === 'ban' ? 0 : 604800 });
      const c = logCase(m, id, cmd === 'ban' ? 'BAN' : 'HARDBAN', reason);
      await send(m, { embeds: [e('Member Banned', 'User: <@' + id + '> (' + id + ')\nReason: ' + reason + '\nCase #' + c.id, 0xed4245)] }); return true;
    }
    if (cmd === 'kick') {
      if (!await need(m, PermissionFlagsBits.KickMembers, 'Kick Members')) return true;
      const t = await member(m, a[0]); if (t.error) { await send(m, t.error); return true; }
      if (!t.member.kickable || t.id === m.author.id) { await send(m, 'I cannot kick that member.'); return true; }
      const r = a.slice(1).join(' ') || 'No reason provided'; await t.member.kick(r);
      const c = logCase(m, t.id, 'KICK', r); await send(m, 'Kicked <@' + t.id + '>. Case #' + c.id); return true;
    }
    if (cmd === 'mute') {
      if (!await need(m, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return true;
      const t = await member(m, a[0]), ms = duration(a[1]);
      if (t.error || !ms || ms < 1000 || ms > 2419200000) { await send(m, t.error || 'Usage: s!mute @user 10m [reason] (s/m/h/d, max 28d).'); return true; }
      if (!t.member.moderatable || t.id === m.author.id) { await send(m, 'I cannot timeout that member.'); return true; }
      const r = a.slice(2).join(' ') || 'No reason provided'; await t.member.timeout(ms, r);
      const c = logCase(m, t.id, 'TIMEOUT', a[1] + ' — ' + r); await send(m, 'Timed out <@' + t.id + '> for ' + a[1] + '. Case #' + c.id); return true;
    }
    if (cmd === 'unmute') {
      if (!await need(m, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return true;
      const t = await member(m, a[0]); if (t.error) { await send(m, t.error); return true; }
      if (!t.member.moderatable) { await send(m, 'I cannot remove that timeout.'); return true; }
      await t.member.timeout(null); const c = logCase(m, t.id, 'UNTIMEOUT', 'Timeout removed'); await send(m, 'Timeout removed. Case #' + c.id); return true;
    }
    if (cmd === 'warn') {
      if (!await need(m, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return true;
      const t = await member(m, a[0]), r = a.slice(1).join(' '); if (t.error || !r) { await send(m, t.error || 'Usage: s!warn @user reason'); return true; }
      await t.member.send({ embeds: [e('Staff Warning', 'You received a warning in ' + m.guild.name + '.\nReason: ' + r, 0xfee75c)] }).catch(() => {});
      const c = logCase(m, t.id, 'WARN', r); await send(m, 'Warning logged for <@' + t.id + '>. Case #' + c.id); return true;
    }
    if (cmd === 'unban') {
      if (!await need(m, PermissionFlagsBits.BanMembers, 'Ban Members')) return true;
      const id = idOf(a[0]) || a[0]; if (!/^\d{17,20}$/.test(id || '')) { await send(m, 'Usage: s!unban userID [reason]'); return true; }
      await m.guild.members.unban(id, a.slice(1).join(' ') || 'Unban command'); const c = logCase(m, id, 'UNBAN', rest); await send(m, 'Unbanned ' + id + '. Case #' + c.id); return true;
    }
    if (cmd === 'banlist') {
      if (!await need(m, PermissionFlagsBits.BanMembers, 'Ban Members')) return true;
      const page = Math.max(1, Number(a[0]) || 1), bans = [...(await m.guild.bans.fetch()).values()];
      const list = bans.slice((page - 1) * 10, page * 10);
      await send(m, { embeds: [e('Server Ban List · Page ' + page, list.map((b, i) => ((page - 1) * 10 + i + 1) + '. ' + b.user.tag + ' (' + b.user.id + ')').join('\n') || 'No bans on this page.')] }); return true;
    }
    if (cmd === 'modlogs') {
      if (!await need(m, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return true;
      const id = idOf(a[0]) || a[0]; if (!id) { await send(m, 'Usage: s!modlogs @user|ID'); return true; }
      const list = cases.filter(c => c.guild === m.guild.id && c.user === id).slice(-10).reverse();
      await send(m, { embeds: [e('Mod Logs · ' + id, list.map(c => 'Case #' + c.id + ' · ' + c.action + (c.voided || voided.has(c.id) ? ' (voided)' : '') + '\nModerator: <@' + c.mod + '>\nReason: ' + c.reason).join('\n\n') || 'No cases recorded during this bot session.')] }); return true;
    }
    if (cmd === 'modstats') {
      if (!await need(m, PermissionFlagsBits.ModerateMembers, 'Moderate Members')) return true;
      const id = idOf(a[0]) || a[0]; if (!id) { await send(m, 'Usage: s!modstats @user|ID'); return true; }
      const list = cases.filter(c => c.guild === m.guild.id && c.mod === id && !c.voided && !voided.has(c.id));
      await send(m, { embeds: [e('Mod Stats · ' + id, 'Active cases: ' + list.length + '\nBans: ' + list.filter(c => ['BAN', 'HARDBAN'].includes(c.action)).length + '\nKicks: ' + list.filter(c => c.action === 'KICK').length + '\nTimeouts: ' + list.filter(c => c.action === 'TIMEOUT').length + '\nWarnings: ' + list.filter(c => c.action === 'WARN').length)] }); return true;
    }
    if (cmd === 'void') {
      if (!await need(m, PermissionFlagsBits.Administrator, 'Administrator')) return true;
      const id = idOf(a[0]) || a[0], num = Number(a[1]); const list = cases.filter(c => c.guild === m.guild.id && c.user === id && (!num || c.id === num));
      if (!list.length) { await send(m, 'No matching cases found.'); return true; }
      list.forEach(c => { c.voided = true; voided.add(c.id); }); await send(m, 'Voided ' + list.length + ' case(s).'); return true;
    }
    if (cmd === 'antinuke') {
      if (!await need(m, PermissionFlagsBits.Administrator, 'Administrator')) return true;
      const act = a[0], id = idOf(a[1]); if (!['admin', 'remove'].includes(act) || !id) { await send(m, 'Usage: s!antinuke admin @user or s!antinuke remove @user'); return true; }
      if (act === 'admin') antiAdmins.add(id); else antiAdmins.delete(id);
      await send(m, act === 'admin' ? 'Added <@' + id + '> to the anti-nuke admin allowlist.' : 'Removed <@' + id + '> from the anti-nuke admin allowlist.'); return true;
    }
    if (['nick', 'clearnick'].includes(cmd)) {
      if (!await need(m, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames')) return true;
      const t = await member(m, a[0]); if (t.error) { await send(m, t.error); return true; }
      const nick = cmd === 'clearnick' ? null : a.slice(1).join(' '); if (cmd === 'nick' && !nick) { await send(m, 'Usage: s!nick @user nickname'); return true; }
      if (!t.member.manageable) { await send(m, 'I cannot manage that nickname.'); return true; }
      await t.member.setNickname(nick); await send(m, 'Nickname updated for <@' + t.id + '>.'); return true;
    }
    if (cmd === 'strip') {
      if (!await need(m, PermissionFlagsBits.ManageRoles, 'Manage Roles')) return true;
      const t = await member(m, a[0]); if (t.error) { await send(m, t.error); return true; }
      if (!t.member.manageable) { await send(m, 'I cannot manage that member’s roles.'); return true; }
      const roles = t.member.roles.cache.filter(r => r.id !== m.guild.id && r.editable); await t.member.roles.remove(roles); await send(m, 'Removed ' + roles.size + ' manageable role(s).'); return true;
    }
    if (cmd === 'autoskull') {
      if (!await need(m, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return true;
      if (skull.has(m.channel.id)) { skull.delete(m.channel.id); await send(m, 'Auto-skull disabled here.'); } else { skull.add(m.channel.id); await send(m, 'Auto-skull enabled here.'); } return true;
    }
    if (['purge', 'p'].includes(cmd)) {
      if (!await need(m, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return true;
      const n = Number(a[0]); if (!Number.isInteger(n) || n < 1 || n > 100) { await send(m, 'Usage: s!purge number (1–100).'); return true; }
      const gone = await m.channel.bulkDelete(n + 1, true); const note = await m.channel.send('Deleted ' + Math.max(0, gone.size - 1) + ' messages.'); setTimeout(() => note.delete().catch(() => {}), 4000); return true;
    }
    if (cmd === 'clean') {
      if (!await need(m, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return true;
      const recent = await m.channel.messages.fetch({ limit: 50 }), list = recent.filter(x => x.id === m.id || (x.author.id === client.user.id && x.createdTimestamp > Date.now() - 3600000));
      await m.channel.bulkDelete(list, true); return true;
    }
    if (['lock', 'unlock'].includes(cmd)) {
      if (!await need(m, PermissionFlagsBits.ManageChannels, 'Manage Channels')) return true;
      await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { SendMessages: cmd === 'lock' ? false : null }); await send(m, cmd === 'lock' ? '🔒 Channel locked.' : '🔓 Channel unlocked.'); return true;
    }
    if (['serverinfo', 'si'].includes(cmd)) {
      const g = m.guild; const info = e(g.name + ' · Server Information', 'Owner: <@' + g.ownerId + '>\nMembers: ' + g.memberCount + '\nCreated: <t:' + Math.floor(g.createdTimestamp / 1000) + ':D>\nChannels: ' + g.channels.cache.size + '\nRoles: ' + g.roles.cache.size + '\nServer ID: ' + g.id);
      if (g.iconURL()) info.setThumbnail(g.iconURL()); await send(m, { embeds: [info] }); return true;
    }
    if (cmd === 'say') {
      if (!await need(m, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return true;
      const isEmbed = a[0] === 'embed', text = (isEmbed ? a.slice(1) : a).join(' '); if (!text) { await send(m, 'Usage: s!say message or s!say embed message'); return true; }
      if (isEmbed) await m.channel.send({ embeds: [makeApplicationEmbed('Message', text)] }); else await m.channel.send({ content: text, allowedMentions: { parse: [] } });
      await m.delete().catch(() => {}); return true;
    }
    if (cmd === '8ball') { if (!rest) { await send(m, 'Usage: s!8ball question'); return true; } await send(m, random(['It is certain.', 'Without a doubt.', 'Most likely.', 'Ask again later.', 'Cannot predict now.', 'My sources say no.', 'Very doubtful.', 'Signs point to yes.'])); return true; }
    if (['cf', 'coinflip'].includes(cmd)) { await send(m, random(['🪙 Heads!', '🪙 Tails!'])); return true; }
    if (cmd === 'afk') { afk.set(m.author.id, { reason: rest || 'AFK', time: Date.now() }); await send(m, '💤 You are now AFK: ' + (rest || 'AFK')); return true; }
    if (['dih', 'puh'].includes(cmd)) { await send(m, (cmd === 'dih' ? '💡 Fictional lamp measurement: ' : '🕳️ Fictional underground-space measurement: ') + (Math.random() * 99 + 1).toFixed(1) + ' inches.'); return true; }
    if (cmd === 'compliment') { await send(m, random(['You make this server better. 💙', 'Your energy is unmatched. ✨', 'You are doing better than you think. 🌟', 'You have excellent taste in Discord bots. 😎'])); return true; }
    if (cmd === 'highfive') { const t = await member(m, a[0]); if (t.error) { await send(m, t.error); return true; } await send(m, { embeds: [e('🖐️ High Five!', '<@' + m.author.id + '> high-fives <@' + t.id + '>! ✨')] }); return true; }
    if (['snipe', 's'].includes(cmd)) { const x = deleted.get(m.channel.id); if (!x) { await send(m, 'Nothing to snipe yet.'); return true; } const em = e('Latest Deleted Message', x.user.tag + '\n' + x.text); if (x.image) em.setImage(x.image); await send(m, { embeds: [em] }); return true; }
    if (['editedsnipe', 'es'].includes(cmd)) { const x = edited.get(m.channel.id); if (!x) { await send(m, 'No edited message cached.'); return true; } await send(m, { embeds: [e('Latest Edited Message', x.user.tag + '\nBefore: ' + x.before + '\nAfter: ' + x.after)] }); return true; }
    if (['cs', 'clearsnipes'].includes(cmd)) { if (!await need(m, PermissionFlagsBits.ManageMessages, 'Manage Messages')) return true; deleted.delete(m.channel.id); edited.delete(m.channel.id); await send(m, 'Snipe cache cleared.'); return true; }
    if (cmd === 'uptime') { const sec = Math.floor(process.uptime()); await send(m, { embeds: [e('Bot Uptime', Math.floor(sec/86400)+'d '+Math.floor(sec%86400/3600)+'h '+Math.floor(sec%3600/60)+'m '+sec%60+'s')] }); return true; }
    if (cmd === 'membercount') { await send(m, { embeds: [e(m.guild.name, 'Members: **' + m.guild.memberCount + '**')] }); return true; }
    if (cmd === 'userinfo') { const id=idOf(a[0]), u=id?await client.users.fetch(id).catch(()=>null):m.author; if(!u){await send(m,'User not found.');return true;} const gm=await m.guild.members.fetch(u.id).catch(()=>null); const em=e(u.tag+' — User Information','ID: '+u.id+'\nAccount created: <t:'+Math.floor(u.createdTimestamp/1000)+':F>'+(gm?'\nJoined server: <t:'+Math.floor(gm.joinedTimestamp/1000)+':F>\nRoles: '+Math.max(0,gm.roles.cache.size-1):'')); em.setThumbnail(u.displayAvatarURL({size:256})); await send(m,{embeds:[em]}); return true; }
    if (cmd === 'channelinfo') { const c=m.channel; await send(m,{embeds:[e('#'+c.name+' — Channel Information','ID: '+c.id+'\nType: '+c.type+'\nCreated: <t:'+Math.floor(c.createdTimestamp/1000)+':F>\nNSFW: '+Boolean(c.nsfw)+'\nSlowmode: '+(c.rateLimitPerUser||0)+' seconds')]}); return true; }
    if (cmd === 'roleinfo') { const id=idOf(a[0]), role=id?await m.guild.roles.fetch(id).catch(()=>null):null; if(!role){await send(m,'Usage: s!roleinfo @role or role ID');return true;} await send(m,{embeds:[e(role.name+' — Role Information','ID: '+role.id+'\nMembers: '+role.members.size+'\nColor: '+role.hexColor+'\nPosition: '+role.position+'\nMentionable: '+role.mentionable)]}); return true; }
    if (cmd === 'slowmode') { if(!await need(m,PermissionFlagsBits.ManageChannels,'Manage Channels')) return true; const n=Number(a[0]); if(!Number.isInteger(n)||n<0||n>21600){await send(m,'Usage: s!slowmode seconds (0–21600; 0 disables).');return true;} await m.channel.setRateLimitPerUser(n,'Updated by '+m.author.tag); await send(m,n?'Slowmode set to '+n+' seconds.':'Slowmode disabled.'); return true; }
    if (cmd === 'poll') { if(!rest){await send(m,'Usage: s!poll question');return true;} const msg=await m.channel.send({embeds:[e('📊 Poll',rest+'\n\n👍 Yes · 👎 No')]}); await msg.react('👍').catch(()=>{}); await msg.react('👎').catch(()=>{}); return true; }
    if (cmd === 'role') { if(!await need(m,PermissionFlagsBits.ManageRoles,'Manage Roles')) return true; const action=(a[0]||'').toLowerCase(), target=await member(m,a[1]), rid=(a[2]?.match(/^<@&(\d+)>$/)?.[1] || idOf(a[2])), role=rid?await m.guild.roles.fetch(rid).catch(()=>null):null; if(!['add','remove'].includes(action)||target.error||!role){await send(m,'Usage: s!role add @user @role OR s!role remove @user @role');return true;} if(!role.editable||!target.member.manageable){await send(m,'I cannot manage that member or role due to role hierarchy.');return true;} if(action==='add') await target.member.roles.add(role); else await target.member.roles.remove(role); await send(m,(action==='add'?'Added ':'Removed ')+'<@&'+role.id+'> '+(action==='add'?'to ':'from ')+'<@'+target.id+'>.'); return true; }
    if (cmd === 'ping') { await send(m, '🏓 Pong! Gateway latency: ' + client.ws.ping + 'ms'); return true; }
    if (['av', 'avatar'].includes(cmd)) { const id = idOf(a[0]), user = id ? await client.users.fetch(id).catch(() => null) : m.author; if (!user) { await send(m, 'User not found.'); return true; } const url = user.displayAvatarURL({ size: 1024 }); await send(m, { embeds: [e(user.tag + ' Avatar', '[Open full-size avatar](' + url + ')').setImage(url)] }); return true; }
  } catch (err) {
    console.error('s!' + cmd + ' error:', err);
    await send(m, 'Command failed. Check bot permissions and role hierarchy. ' + String(err.message).slice(0, 120)).catch(() => {});
    return true;
  }
  return false;
}
