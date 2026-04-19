import sgMail from '@sendgrid/mail'

const apiKey = process.env.SENDGRID_API_KEY
if (!apiKey) {
	console.error('❌ SENDGRID_API_KEY не знайдено в .env')
} else {
	sgMail.setApiKey(apiKey)
	console.log('✅ SendGrid ініціалізовано')
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

function buildHtml(playerName: string, game: GameInfo, siteUrl: string): string {
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

        <p style="margin:0 0 24px;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:1px;">
          Mind<span style="color:#44aaff;">Flow</span>
        </p>

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
	const siteUrl = process.env.CLIENT_URL || 'http://localhost:5173'
	const from    = process.env.SENDGRID_FROM || process.env.SENDGRID_USER || ''

	await sgMail.send({
		from:    { email: from, name: 'MindFlow' },
		to,
		subject: `🎮 Реєстрацію підтверджено — ${game.title} | Код: ${game.gameCode}`,
		html:    buildHtml(playerName, game, siteUrl),
	})
}
