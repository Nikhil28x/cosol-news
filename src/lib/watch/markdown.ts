/**
 * Tiny, safe Markdown → HTML for AI answers. HTML is escaped FIRST, then only a known
 * set of tags is introduced, so the output is safe to use with {@html} (no XSS even if
 * the model echoes markup). Supports: headings, **bold**, *italic*, `code`, bullet and
 * numbered lists, and paragraphs.
 */
function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Operates on already-escaped text.
function inline(s: string): string {
	return s
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function renderMarkdown(md: string): string {
	const lines = md.replace(/\r/g, '').split('\n');
	const out: string[] = [];
	let list: 'ul' | 'ol' | null = null;
	let para: string[] = [];

	const flushPara = () => {
		if (para.length) {
			out.push(`<p>${inline(para.join(' '))}</p>`);
			para = [];
		}
	};
	const closeList = () => {
		if (list) {
			out.push(`</${list}>`);
			list = null;
		}
	};

	for (const raw of lines) {
		const line = raw.trim();
		if (!line) {
			flushPara();
			closeList();
			continue;
		}
		const esc = escapeHtml(line);

		const heading = esc.match(/^(#{1,4})\s+(.*)$/);
		if (heading) {
			flushPara();
			closeList();
			const level = Math.min(6, heading[1].length + 2);
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			continue;
		}

		const bullet = esc.match(/^[-*•]\s+(.*)$/);
		if (bullet) {
			flushPara();
			if (list !== 'ul') {
				closeList();
				out.push('<ul>');
				list = 'ul';
			}
			out.push(`<li>${inline(bullet[1])}</li>`);
			continue;
		}

		const ordered = esc.match(/^\d+[.)]\s+(.*)$/);
		if (ordered) {
			flushPara();
			if (list !== 'ol') {
				closeList();
				out.push('<ol>');
				list = 'ol';
			}
			out.push(`<li>${inline(ordered[1])}</li>`);
			continue;
		}

		closeList();
		para.push(esc);
	}
	flushPara();
	closeList();
	return out.join('\n');
}
