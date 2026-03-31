function parseLocalDateTimeInput(value: string): Date | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const match = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
	);

	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = Number(match[6] ?? '0');

	const date = new Date(year, month - 1, day, hour, minute, second, 0);
	return Number.isNaN(date.getTime()) ? null : date;
}

const BENIN_TIME_ZONE = 'Africa/Porto-Novo';

function toDateTimeLocalStringInTimeZone(date: Date, timeZone: string): string {
	const formatter = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	const parts = formatter.formatToParts(date);

	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? '';

	const year = get('year');
	const month = get('month');
	const day = get('day');
	const hour = get('hour');
	const minute = get('minute');
	const second = get('second');

	if (!year || !month || !day || !hour || !minute || !second) {
		return '';
	}

	return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function toUtcIsoFromLocalDateTimeInput(value: string): string | null {
	const parsed = parseLocalDateTimeInput(value);
	if (!parsed) return null;
	return parsed.toISOString();
}

export function getNowDateTimeInputValue(): string {
	return toDateTimeLocalStringInTimeZone(new Date(), BENIN_TIME_ZONE);
}

export function toDateTimeLocalInputValue(value: string): string {
	const normalized = value.trim().replace(' ', 'T');

	// For values without timezone information, keep the wall-clock as-is.
	const direct = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
	if (direct) {
		const seconds = direct[3] ?? '00';
		return `${direct[1]}T${direct[2]}:${seconds}`;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return toDateTimeLocalStringInTimeZone(date, BENIN_TIME_ZONE);
}
