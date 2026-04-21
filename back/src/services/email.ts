import nodemailer from 'nodemailer'

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false'

// Set LOGO_URL env var to replace the text logo with an image in all emails.
const LOGO_URL = process.env.LOGO_URL ?? ''
const logoHtml = (accentColor = '#44aaff') => LOGO_URL
	? `<img src="${LOGO_URL}" alt="MindFlow" style="height:40px;margin-bottom:24px;display:block;">`
	: `<p style="margin:0 0 24px;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:1px;">Mind<span style="color:${accentColor};">Flow</span></p>`

function createTransport() {
	return nodemailer.createTransport({
		host:   process.env.SMTP_HOST || 'smtp.gmail.com',
		port:   Number(process.env.SMTP_PORT) || 587,
		secure: false,
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	})
}

interface GameInfo {
	title: string
	creatorName: string
	minPlayers: number
	maxPlayers: number
	description?: string
	useCoins: boolean
	coinsPerPlayer: number
	useInfluence: boolean
	influencePerPlayer: number
	scheduledAt?: Date
	gameCode: string
}

function formatDate(d: Date): string {
	return (
		d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) +
		' · ' +
		d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
	)
}

function buildGameHtml(playerName: string, game: GameInfo, siteUrl: string): string {
	const statsRows: string[] = []

	statsRows.push(`<tr><td style="padding:6px 0;color:#64b4dc;font-size:13px;">
		👥 Гравців: <span style="color:#e0eeff;">${game.minPlayers}–${game.maxPlayers}</span>
	</td></tr>`)

	if (game.useCoins) {
		statsRows.push(`<tr><td style="padding:6px 0;color:#ffb728;font-size:13px;">
			🪙 Монет на вхід: <span style="color:#ffe0a0;">${game.coinsPerPlayer}</span>
		</td></tr>`)
	}

	if (game.useInfluence) {
		statsRows.push(`<tr><td style="padding:6px 0;color:#bf7fff;font-size:13px;">
			⚡ Балів впливу: <span style="color:#dfc0ff;">${game.influencePerPlayer}</span>
		</td></tr>`)
	}

	if (game.scheduledAt) {
		statsRows.push(`<tr><td style="padding:6px 0;color:#0fffc8;font-size:13px;">
			📅 Дата: <span style="color:#b0ffe8;">${formatDate(game.scheduledAt)}</span>
		</td></tr>`)
	}

	return `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Реєстрацію підтверджено — MindFlow</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml('#44aaff')}

        <p style="margin:0 0 20px;font-size:15px;color:rgba(180,200,255,0.75);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${playerName}</strong>!<br>
          Вашу реєстрацію на гру підтверджено.
        </p>

        <p style="margin:0 0 4px;font-size:10px;color:rgba(100,140,220,0.45);text-transform:uppercase;letter-spacing:0.6px;">Назва гри</p>
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${game.title}</p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(100,140,220,0.5);">Ігромайстер — ${game.creatorName}</p>

        ${game.description ? `<p style="margin:0 0 20px;font-size:13px;color:rgba(180,200,255,0.55);line-height:1.6;border-left:2px solid rgba(68,170,255,0.25);padding-left:12px;">${game.description}</p>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          ${statsRows.join('')}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr><td style="border-top:1px solid rgba(68,170,255,0.12);"></td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(15,255,200,0.05);border:1px solid rgba(15,255,200,0.2);border-radius:14px;margin-bottom:28px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;color:rgba(15,255,200,0.55);text-transform:uppercase;letter-spacing:0.8px;">Ваш код для входу в гру</p>
            <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:8px;color:#0fffc8;font-family:monospace;">${game.gameCode}</p>
          </td></tr>
        </table>

        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr><td style="background:linear-gradient(135deg,#2255dd,#7744cc);border-radius:12px;">
            <a href="${siteUrl}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              Перейти на MindFlow →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:12px;color:rgba(180,200,255,0.3);line-height:1.6;">
          Якщо ви не реєструвались на цю гру — проігноруйте цей лист.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 MindFlow · Ігри для мислення</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

export async function sendRegistrationEmail(
	to: string,
	playerName: string,
	game: GameInfo,
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'
	const from    = process.env.SMTP_USER || ''

	const transporter = createTransport()
	await transporter.sendMail({
		from:    `"MindFlow" <${from}>`,
		to,
		subject: `🎮 Реєстрацію підтверджено — ${game.title} | Код: ${game.gameCode}`,
		html:    buildGameHtml(playerName, game, siteUrl),
	})
}

export async function sendSpectatorRegistrationEmail(
	to: string,
	spectatorName: string,
	game: { title: string; creatorName: string; spectatorCode: string; scheduledAt?: Date },
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'
	const from    = process.env.SMTP_USER || ''

	const joinLink = `${siteUrl}/game?code=${game.spectatorCode}`
	const dateRow = game.scheduledAt
		? `<tr><td style="padding:6px 0;color:#0fffc8;font-size:13px;">📅 Дата: <span style="color:#b0ffe8;">${formatDate(game.scheduledAt)}</span></td></tr>`
		: ''

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Реєстрацію глядача підтверджено — MindFlow</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(180,130,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#5511aa,#9922cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml('#c07fff')}

        <p style="margin:0 0 20px;font-size:15px;color:rgba(200,180,255,0.75);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${spectatorName}</strong>!<br>
          Ви зареєстровані як <strong style="color:#c07fff;">глядач</strong> гри.
        </p>

        <p style="margin:0 0 4px;font-size:10px;color:rgba(180,130,255,0.45);text-transform:uppercase;letter-spacing:0.6px;">Назва гри</p>
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${game.title}</p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(180,130,255,0.5);">Ігромайстер — ${game.creatorName}</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          ${dateRow}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="border-top:1px solid rgba(180,130,255,0.12);"></td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:11px;color:rgba(180,130,255,0.4);">
          Як глядач, ви можете спостерігати за грою, писати в чат та ставити лайки — але не беретесь участі у голосуваннях гравців.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="border-top:1px solid rgba(180,130,255,0.12);"></td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(180,130,255,0.06);border:1px solid rgba(180,130,255,0.25);border-radius:14px;margin-bottom:10px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;color:rgba(180,130,255,0.55);text-transform:uppercase;letter-spacing:0.8px;">Ваш код глядача</p>
            <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:8px;color:#c07fff;font-family:monospace;">${game.spectatorCode}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 20px;font-size:11px;color:rgba(180,130,255,0.35);text-align:center;">
          Введіть цей код на сторінці гри або скористайтесь кнопкою нижче
        </p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;width:100%;">
          <tr><td style="background:linear-gradient(135deg,#5511aa,#9922cc);border-radius:12px;text-align:center;">
            <a href="${joinLink}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              👁 Приєднатися як глядач →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:12px;color:rgba(180,200,255,0.3);line-height:1.6;">
          Якщо ви не реєструвались на цю гру — проігноруйте цей лист.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(180,130,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 MindFlow · Ігри для мислення</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	const transporter = createTransport()
	await transporter.sendMail({
		from:    `"MindFlow" <${from}>`,
		to,
		subject: `👁 Реєстрацію глядача підтверджено — ${game.title} | Код: ${game.spectatorCode}`,
		html,
	})
}

export async function sendNotesEmail(
	to: string,
	gmName: string,
	gameTitle: string,
	gameCode: string,
	notes: string,
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const from = process.env.SMTP_USER || ''
	const notesHtml = notes
		.split('\n')
		.map(line =>
			`<p style="margin:0 0 10px;font-size:13px;color:rgba(220,230,255,0.85);line-height:1.65;">${
				line.trim() ? line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '&nbsp;'
			}</p>`,
		)
		.join('')

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Нотатки гри — MindFlow</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:560px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml('#44aaff')}

        <p style="margin:0 0 6px;font-size:14px;color:rgba(180,200,255,0.7);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${gmName}</strong>!
        </p>
        <p style="margin:0 0 22px;font-size:13px;color:rgba(100,140,220,0.5);">
          Нотатки завершеної гри <strong style="color:rgba(180,200,255,0.7);">«${gameTitle}»</strong> · Код: <span style="font-family:monospace;color:#0fffc8;">${gameCode}</span>
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(15,255,200,0.03);border:1px solid rgba(15,255,200,0.12);border-radius:14px;margin-bottom:28px;">
          <tr><td style="padding:20px 24px;">
            ${notesHtml}
          </td></tr>
        </table>

        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.25);line-height:1.6;">
          Цей лист надіслано автоматично після завершення гри.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 MindFlow · Ігри для мислення</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	const transporter = createTransport()
	await transporter.sendMail({
		from:    `"MindFlow" <${from}>`,
		to,
		subject: `📝 Нотатки гри «${gameTitle}» (${gameCode}) — MindFlow`,
		html,
	})
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
	if (!EMAIL_ENABLED) {
		console.log(`[email] Welcome email skipped for ${to} (EMAIL_ENABLED=false)`)
		return
	}

	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'
	const from    = process.env.SMTP_USER || ''

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ласкаво просимо — MindFlow</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:36px 32px 28px;">

        ${logoHtml('#44aaff')}

        <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.4;">
          Привіт, друже!
        </p>

        <p style="margin:0 0 16px;font-size:14px;color:rgba(180,200,255,0.8);line-height:1.8;">
          Наше співтовариство вітає нового мешканця світу ігор.
        </p>

        <p style="margin:0 0 16px;font-size:14px;color:rgba(180,200,255,0.75);line-height:1.8;">
          Тут гра — це не втеча від реальності.<br>
          Це спосіб бачити глибше, мислити ширше і зустрічатися з іншими на рівні сенсів.
        </p>

        <p style="margin:0 0 16px;font-size:14px;color:rgba(180,200,255,0.75);line-height:1.8;">
          Ми збираємо людей, яким цікаво досліджувати:<br>
          через діалог, через роль, через живу взаємодію.
        </p>

        <p style="margin:0 0 28px;font-size:14px;color:rgba(180,200,255,0.75);line-height:1.8;">
          Без сценаріїв, де все вже вирішено — зате з простором, де народжується нове.<br>
          Якщо тобі відгукується — приєднуйся.
        </p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr><td style="background:linear-gradient(135deg,#2255dd,#7744cc);border-radius:12px;">
            <a href="${siteUrl}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              👉 Перейти до платформи
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:rgba(180,200,255,0.6);line-height:1.6;">
          До зустрічі в грі.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 MindFlow · Ігри для мислення</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	const transporter = createTransport()
	await transporter.sendMail({
		from:    `"MindFlow" <${from}>`,
		to,
		subject: '👾 Ласкаво просимо до MindFlow!',
		html,
	})
}
