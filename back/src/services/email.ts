import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'
import logger from '../config/logger'

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false'

function escHtml(s: string | undefined | null): string {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
	logger.info('[email.sendEmail] Called', { to, subject })
	logger.info('[email.sendEmail] EMAIL_ENABLED =', { EMAIL_ENABLED })

	const fromEmail = process.env.SENDGRID_FROM || process.env.SMTP_USER || ''
	const from = { email: fromEmail, name: 'Games of Senses' }

	try {
		logger.info('[email.sendEmail] Checking email providers', {
			hasSendgridKey: !!process.env.SENDGRID_API_KEY,
			hasSmtpUser: !!process.env.SMTP_USER,
			hasSmtpPass: !!process.env.SMTP_PASS,
			smtpHost: process.env.SMTP_HOST,
			smtpPort: process.env.SMTP_PORT,
			fromEmail
		})

		if (process.env.SENDGRID_API_KEY) {
			logger.info('[email.sendEmail] Using SendGrid')
			sgMail.setApiKey(process.env.SENDGRID_API_KEY)
			await sgMail.send({ from, to, subject, html })
			logger.info('[email] SendGrid email sent', { to, subject })
		} else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
			logger.info('[email.sendEmail] Using SMTP Brevo')
			const transporter = nodemailer.createTransport({
				host:   process.env.SMTP_HOST || 'smtp.gmail.com',
				port:   Number(process.env.SMTP_PORT) || 587,
				secure: false,
				auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
			})
			logger.info('[email.sendEmail] Transporter created, sending email...')
			await transporter.sendMail({ from: `"Games of Senses" <${fromEmail}>`, to, subject, html })
			logger.info('[email] SMTP email sent', { to, subject })
		} else {
			logger.warn('[email] No email provider configured (SENDGRID_API_KEY or SMTP_USER/SMTP_PASS missing)', { to })
		}
	} catch (err) {
		logger.error('[email] Failed to send email', { to, subject, error: err instanceof Error ? err.message : String(err) })
		throw err
	}
}

const logoHtml = () => `
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr valign="middle">
    <td valign="middle" style="padding-right:16px;">
      <table cellpadding="0" cellspacing="0" border="0"
        style="width:58px;height:58px;border-radius:29px;border:1.5px solid #00ffe1;background:#0a0d20;text-align:center;
               box-shadow:0 0 8px rgba(0,255,225,0.3),0 0 0 3px rgba(204,68,255,0.18);">
        <tr>
          <td align="center" valign="middle" height="58"
            style="text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:900;color:#00ffe1;">
            G
          </td>
        </tr>
      </table>
    </td>
    <td valign="middle" style="vertical-align:middle;">
      <p style="margin:0 0 2px;font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#00ffe1;letter-spacing:4px;text-transform:uppercase;">КЛУБ</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;line-height:1.2;">ІГРИ</p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#cc44ff;letter-spacing:0.5px;line-height:1.2;">СЕНСІВ</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin-top:5px;">
        <tr><td style="width:155px;height:1px;background:#cc44ff;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
</table>`

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
<title>Реєстрацію підтверджено — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml()}

        <p style="margin:0 0 20px;font-size:15px;color:rgba(180,200,255,0.75);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${escHtml(playerName)}</strong>!<br>
          Вашу реєстрацію на гру підтверджено.
        </p>

        <p style="margin:0 0 4px;font-size:10px;color:rgba(100,140,220,0.45);text-transform:uppercase;letter-spacing:0.6px;">Назва гри</p>
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${escHtml(game.title)}</p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(100,140,220,0.5);">Ігромайстер — ${escHtml(game.creatorName)}</p>

        ${game.description ? `<p style="margin:0 0 20px;font-size:13px;color:rgba(180,200,255,0.55);line-height:1.6;border-left:2px solid rgba(68,170,255,0.25);padding-left:12px;">${escHtml(game.description)}</p>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          ${statsRows.join('')}
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr><td style="border-top:1px solid rgba(68,170,255,0.12);"></td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(15,255,200,0.05);border:1px solid rgba(15,255,200,0.2);border-radius:14px;margin-bottom:10px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:11px;color:rgba(15,255,200,0.55);text-transform:uppercase;letter-spacing:0.8px;">Ваш код для входу в гру</p>
            <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:8px;color:#0fffc8;font-family:monospace;">${game.gameCode}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 20px;font-size:11px;color:rgba(15,255,200,0.35);text-align:center;">
          Введіть цей код на сторінці гри або скористайтесь кнопкою нижче
        </p>

        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;width:100%;">
          <tr><td style="background:linear-gradient(135deg,#2255dd,#7744cc);border-radius:12px;text-align:center;">
            <a href="${siteUrl}/game?code=${game.gameCode}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              🎮 Приєднатися до гри →
            </a>
          </td></tr>
        </table>

        <p style="margin:0;font-size:12px;color:rgba(180,200,255,0.3);line-height:1.6;">
          Якщо ви не реєструвались на цю гру — проігноруйте цей лист.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
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

	await sendEmail(
		to,
		`🎮 Реєстрацію підтверджено — ${game.title} | Код: ${game.gameCode}`,
		buildGameHtml(playerName, game, siteUrl),
	)
}

export async function sendSpectatorRegistrationEmail(
	to: string,
	spectatorName: string,
	game: { title: string; creatorName: string; spectatorCode: string; scheduledAt?: Date },
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'
	const joinLink = `${siteUrl}/game?code=${game.spectatorCode}`
	const dateRow = game.scheduledAt
		? `<tr><td style="padding:6px 0;color:#0fffc8;font-size:13px;">📅 Дата: <span style="color:#b0ffe8;">${formatDate(game.scheduledAt)}</span></td></tr>`
		: ''

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Реєстрацію глядача підтверджено — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(180,130,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#5511aa,#9922cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml()}

        <p style="margin:0 0 20px;font-size:15px;color:rgba(200,180,255,0.75);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${escHtml(spectatorName)}</strong>!<br>
          Ви зареєстровані як <strong style="color:#c07fff;">глядач</strong> гри.
        </p>

        <p style="margin:0 0 4px;font-size:10px;color:rgba(180,130,255,0.45);text-transform:uppercase;letter-spacing:0.6px;">Назва гри</p>
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${escHtml(game.title)}</p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(180,130,255,0.5);">Ігромайстер — ${escHtml(game.creatorName)}</p>

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
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	await sendEmail(
		to,
		`👁 Реєстрацію глядача підтверджено — ${game.title} | Код: ${game.spectatorCode}`,
		html,
	)
}

export async function sendNotesEmail(
	to: string,
	gmName: string,
	gameTitle: string,
	gameCode: string,
	notes: string,
): Promise<void> {
	if (!EMAIL_ENABLED) return
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
<title>Нотатки гри — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:560px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml()}

        <p style="margin:0 0 6px;font-size:14px;color:rgba(180,200,255,0.7);line-height:1.6;">
          Вітаємо, <strong style="color:#ffffff;">${escHtml(gmName)}</strong>!
        </p>
        <p style="margin:0 0 22px;font-size:13px;color:rgba(100,140,220,0.5);">
          Нотатки завершеної гри <strong style="color:rgba(180,200,255,0.7);">«${escHtml(gameTitle)}»</strong> · Код: <span style="font-family:monospace;color:#0fffc8;">${escHtml(gameCode)}</span>
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
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	await sendEmail(
		to,
		`📝 Нотатки гри «${gameTitle}» (${gameCode}) — Games of Senses`,
		html,
	)
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
	logger.info('[sendWelcomeEmail] Called', { to, name, EMAIL_ENABLED })
	if (!EMAIL_ENABLED) {
		logger.warn(`[sendWelcomeEmail] Skipped (EMAIL_ENABLED=false)`, { to })
		return
	}

	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ласкаво просимо — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:36px 32px 28px;">

        ${logoHtml()}

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
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	await sendEmail(to, '👾 Ласкаво просимо до Games of Senses!', html)
}

export async function sendGameStartReminder(
	to: string,
	participantName: string,
	game: { title: string; gameCode: string; scheduledAt?: Date },
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const siteUrl = process.env.CLIENT_URL || 'http://localhost:3000'

	const scheduledStr = game.scheduledAt
		? formatDate(game.scheduledAt)
		: 'невизначена'

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Гра починається за 30 хвилин — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#ff6b35,#f7931e);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml()}

        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#ffffff;line-height:1.4;">
          🚨 Гра починається за 30 хвилин!
        </p>

        <p style="margin:0 0 6px;font-size:13px;color:rgba(180,200,255,0.6);line-height:1.6;">
          Привіт, <strong style="color:#ffffff;">${escHtml(participantName)}</strong>!
        </p>

        <p style="margin:0 0 20px;font-size:13px;color:rgba(180,200,255,0.6);line-height:1.6;">
          Підготуйтеся до участі в грі:
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.25);border-radius:14px;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:11px;color:rgba(255,107,53,0.55);text-transform:uppercase;letter-spacing:0.6px;">Назва гри</p>
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#ffffff;">${escHtml(game.title)}</p>
            <p style="margin:0 0 4px;font-size:10px;color:rgba(100,140,220,0.45);text-transform:uppercase;letter-spacing:0.6px;">Час початку</p>
            <p style="margin:0;font-size:13px;color:#ffa500;">${escHtml(scheduledStr)}</p>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr><td style="padding:12px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:rgba(180,200,255,0.6);line-height:1.6;">
              ✅ Перевірте мікрофон та камеру
            </p>
            <p style="margin:0 0 4px;font-size:12px;color:rgba(180,200,255,0.6);line-height:1.6;">
              ✅ Завантажте сторінку гри
            </p>
            <p style="margin:0;font-size:12px;color:rgba(180,200,255,0.6);line-height:1.6;">
              ✅ Будьте готові 30 секунд до часу початку
            </p>
          </td></tr>
        </table>

        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;width:100%;">
          <tr><td style="background:linear-gradient(135deg,#2255dd,#7744cc);border-radius:12px;text-align:center;">
            <a href="${siteUrl}/game?code=${game.gameCode}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              🎮 Перейти до гри →
            </a>
          </td></tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="border-top:1px solid rgba(68,170,255,0.12);"></td></tr>
        </table>

        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.25);line-height:1.6;">
          Це автоматичне напоминання. Якщо у вас виникли проблеми, зверніться до організатора.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	await sendEmail(
		to,
		`🚨 Гра починається за 30 хвилин — ${game.title} (${game.gameCode})`,
		html,
	)
}

export async function sendGMRegistrationNotification(
	gmEmail: string,
	gmName: string,
	playerName: string,
	role: 'player' | 'spectator',
	game: { title: string; description?: string; gameCode: string },
): Promise<void> {
	if (!EMAIL_ENABLED) return

	const roleLabel = role === 'player' ? '🎮 Гравець' : '👁 Глядач'
	const roleColor = role === 'player' ? '#0fffc8' : '#c07fff'
	const gradientStart = role === 'player' ? '#1133aa' : '#5511aa'
	const gradientEnd = role === 'player' ? '#7722cc' : '#9922cc'

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Нова реєстрація на вашу гру — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,${gradientStart},${gradientEnd});padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">

        ${logoHtml()}

        <p style="margin:0 0 20px;font-size:15px;color:rgba(180,200,255,0.75);line-height:1.6;">
          Привіт, <strong style="color:#ffffff;">${escHtml(gmName)}</strong>!<br>
          На вашу гру зареєструвався новий учасник.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(68,170,255,0.06);border:1px solid rgba(68,170,255,0.2);border-radius:14px;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:11px;color:rgba(100,140,220,0.5);text-transform:uppercase;letter-spacing:0.6px;">Регістрація</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#ffffff;">${escHtml(playerName)}</p>
            <p style="margin:4px 0 0;font-size:12px;color:${roleColor};font-weight:600;">${roleLabel}</p>
          </td></tr>
        </table>

        <p style="margin:0 0 4px;font-size:10px;color:rgba(100,140,220,0.45);text-transform:uppercase;letter-spacing:0.6px;">Ваша гра</p>
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">${escHtml(game.title)}</p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(100,140,220,0.5);">Код: <span style="font-family:monospace;color:#0fffc8;">${game.gameCode}</span></p>

        ${game.description ? `<p style="margin:0 0 20px;font-size:13px;color:rgba(180,200,255,0.55);line-height:1.6;border-left:2px solid rgba(68,170,255,0.25);padding-left:12px;">${escHtml(game.description)}</p>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
          <tr><td style="border-top:1px solid rgba(68,170,255,0.12);"></td></tr>
        </table>
        <p style="margin:0 0 20px;font-size:12px;color:rgba(180,200,255,0.35);">
          Перейдіть на сторінку гри, щоб переглянути повний список учасників.
        </p>

      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	const roleText = role === 'player' ? 'Гравець' : 'Глядач'
	await sendEmail(
		gmEmail,
		`${roleLabel} Нова реєстрація — ${game.title} (${game.gameCode})`,
		html,
	)
}

export async function sendRecordingEmail(
	to: string,
	gameTitle: string,
	gameCode: string,
	shareLink: string,
): Promise<void> {
	if (!EMAIL_ENABLED) return
	const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })

	const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Запис гри — Games of Senses</title>
</head>
<body style="margin:0;padding:0;background:#030619;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030619;min-height:100vh;">
  <tr><td align="center" style="padding:40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:520px;background:#060d2a;border:1px solid rgba(68,170,255,0.22);border-radius:20px;overflow:hidden;">
      <tr><td style="background:linear-gradient(90deg,#1133aa,#7722cc);padding:4px 0;"></td></tr>
      <tr><td style="padding:32px 32px 28px;">
        ${logoHtml()}
        <p style="margin:0 0 6px;font-size:15px;color:rgba(180,200,255,0.8);line-height:1.6;">
          🎬 Запис гри готовий!
        </p>
        <p style="margin:0 0 20px;font-size:13px;color:rgba(100,140,220,0.5);">
          Гра: <strong style="color:rgba(180,200,255,0.7);">«${gameTitle}»</strong> · Код: <span style="font-family:monospace;color:#0fffc8;">${gameCode}</span>
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:rgba(15,255,200,0.05);border:1px solid rgba(15,255,200,0.2);border-radius:14px;margin-bottom:20px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 8px;font-size:11px;color:rgba(15,255,200,0.55);text-transform:uppercase;letter-spacing:0.8px;">Посилання на запис</p>
            <a href="${shareLink}" target="_blank" style="font-size:13px;color:#0fffc8;word-break:break-all;">${shareLink}</a>
          </td></tr>
        </table>
        <p style="margin:0 0 20px;font-size:12px;color:rgba(180,200,255,0.4);line-height:1.6;">
          ⚠️ Запис буде автоматично видалено <strong style="color:rgba(200,160,60,0.8);">${expiryDate}</strong> (через 7 днів).
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;width:100%;">
          <tr><td style="background:linear-gradient(135deg,#2255dd,#7744cc);border-radius:12px;text-align:center;">
            <a href="${shareLink}" target="_blank"
              style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              ▶ Переглянути запис →
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 32px;border-top:1px solid rgba(68,170,255,0.1);">
        <p style="margin:0;font-size:11px;color:rgba(180,200,255,0.2);">© 2025 Games of Senses</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

	await sendEmail(to, `🎬 Запис гри «${gameTitle}» (${gameCode}) — Games of Senses`, html)
}
