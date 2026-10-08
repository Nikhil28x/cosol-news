const slides = [...document.querySelectorAll('.slide')];
const progress = document.getElementById('progressBar');
const currentLabel = document.getElementById('currentSlide');
const totalLabel = document.getElementById('totalSlides');
const previous = document.getElementById('prev');
const next = document.getElementById('next');
const overview = document.getElementById('overviewPanel');
const overviewGrid = document.getElementById('overviewGrid');
let current = Math.max(
	0,
	Math.min(slides.length - 1, Number(location.hash.replace('#slide-', '')) - 1 || 0)
);
let touchStartX = 0;

totalLabel.textContent = String(slides.length).padStart(2, '0');

function show(index, updateHash = true) {
	current = Math.max(0, Math.min(slides.length - 1, index));
	slides.forEach((slide, i) => {
		slide.classList.toggle('is-active', i === current);
		slide.setAttribute('aria-hidden', String(i !== current));
	});
	currentLabel.textContent = String(current + 1).padStart(2, '0');
	progress.style.width = `${((current + 1) / slides.length) * 100}%`;
	previous.disabled = current === 0;
	next.disabled = current === slides.length - 1;
	document.title = `${slides[current].dataset.title} · Account Intel`;
	if (updateHash) history.replaceState(null, '', `#slide-${current + 1}`);
}

function toggleOverview(force) {
	const open = typeof force === 'boolean' ? force : !overview.classList.contains('is-open');
	overview.classList.toggle('is-open', open);
	overview.setAttribute('aria-hidden', String(!open));
	if (open) document.getElementById('closeOverview').focus();
}

slides.forEach((slide, index) => {
	const button = document.createElement('button');
	button.type = 'button';
	button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><b>${slide.dataset.title}</b>`;
	button.addEventListener('click', () => {
		show(index);
		toggleOverview(false);
	});
	overviewGrid.appendChild(button);
});

previous.addEventListener('click', () => show(current - 1));
next.addEventListener('click', () => show(current + 1));
document.getElementById('overview').addEventListener('click', () => toggleOverview());
document.getElementById('closeOverview').addEventListener('click', () => toggleOverview(false));
document.getElementById('print').addEventListener('click', () => window.print());
document.getElementById('fullscreen').addEventListener('click', async () => {
	if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
	else await document.exitFullscreen?.();
});

document.addEventListener('keydown', (event) => {
	if (overview.classList.contains('is-open') && event.key === 'Escape')
		return toggleOverview(false);
	if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
		event.preventDefault();
		show(current + 1);
	}
	if (['ArrowLeft', 'PageUp'].includes(event.key)) {
		event.preventDefault();
		show(current - 1);
	}
	if (event.key === 'Home') show(0);
	if (event.key === 'End') show(slides.length - 1);
	if (event.key.toLowerCase() === 'o') toggleOverview();
	if (event.key.toLowerCase() === 'f') document.getElementById('fullscreen').click();
});

document.addEventListener(
	'touchstart',
	(event) => (touchStartX = event.changedTouches[0].screenX),
	{ passive: true }
);
document.addEventListener(
	'touchend',
	(event) => {
		const distance = event.changedTouches[0].screenX - touchStartX;
		if (Math.abs(distance) > 60) show(current + (distance < 0 ? 1 : -1));
	},
	{ passive: true }
);

window.addEventListener('hashchange', () => {
	const target = Number(location.hash.replace('#slide-', '')) - 1;
	if (Number.isFinite(target)) show(target, false);
});

show(current, false);
