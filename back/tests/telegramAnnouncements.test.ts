import { announcementText, formatGameDate } from '../src/services/telegramBot'

/**
 * The new-game announcement goes to every member linked to the bot, with
 * parse_mode HTML — so it must carry everything asked for (title, full
 * description, date and time, paid or free, gamemaster) and never let a
 * game's own text break the markup.
 */
describe('new game announcement', () => {
	const game = {
		title: 'Тіні <Сенсів> & Co',
		description: 'Детективна гра на 2 години.\nПотрібна камера.',
		scheduledAt: new Date('2026-10-03T16:00:00Z'),   // 19:00 in Kyiv (summer time)
		participationCost: 150,
		creatorName: 'Олена Клементьєва',
	}

	it('carries title, description, date, price and gamemaster', () => {
		const text = announcementText(game, 'uk')
		expect(text).toContain('Нова гра')
		expect(text).toContain('Тіні &lt;Сенсів&gt; &amp; Co')
		expect(text).toContain('Детективна гра на 2 години.')
		expect(text).toContain('3 жовтня 2026')
		expect(text).toContain('19:00')
		expect(text).toContain('Платна: 150 грн')
		expect(text).toContain('Ігромастер: Олена Клементьєва')
		expect(text).toContain('/stop')
	})

	it('says free when there is no cost', () => {
		expect(announcementText({ ...game, participationCost: 0 }, 'uk')).toContain('Безкоштовна')
		expect(announcementText({ ...game, participationCost: undefined }, 'en')).toContain('Free')
	})

	it('says the date is to be announced when there is none', () => {
		expect(announcementText({ ...game, scheduledAt: null }, 'uk')).toContain('дату буде оголошено')
	})

	it('shows the time in Kyiv, whatever the server clock says', () => {
		expect(formatGameDate(new Date('2026-12-20T17:30:00Z'), 'uk')).toContain('19:30')   // winter: UTC+2
		expect(formatGameDate(new Date('2026-12-20T17:30:00Z'), 'en')).toContain('Kyiv time')
	})

	it('fits a photo caption for a full-length description', () => {
		const long = announcementText({ ...game, title: 'x'.repeat(100), description: 'y'.repeat(500) }, 'uk')
		expect(long.length).toBeLessThanOrEqual(1024)
	})

	it('names a gamemaster without a name by the alias, never the email', () => {
		const text = announcementText({ ...game, creatorName: '', creatorAlias: 'olena79' }, 'uk')
		expect(text).toContain('Немає імені (olena79)')
		expect(announcementText({ ...game, creatorName: '', creatorAlias: 'olena79' }, 'en')).toContain('No name (olena79)')
	})
})
