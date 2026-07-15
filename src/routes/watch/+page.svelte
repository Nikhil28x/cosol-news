<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · COSOL Customer Watch</title></svelte:head>

<div class="login">
	<div class="login__panel">
		<div class="login__brand">
			<span class="login__logobox">
				<img src="/cosol-logo.svg" alt="COSOL" width="609" height="203" />
			</span>
			<small>Customer Watch</small>
		</div>

		<h1>Sign in</h1>
		<p class="login__sub">Live intelligence on the accounts assigned to you.</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if form?.error}
				<p class="login__error" role="alert">{form.error}</p>
			{/if}

			<div class="field">
				<label for="email">Work email</label>
				<input
					class="input"
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
					placeholder="you@cosol.in"
				/>
			</div>

			<div class="field">
				<label for="password">Password</label>
				<input
					class="input"
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					placeholder="••••••••"
				/>
			</div>

			<button class="btn btn--primary login__submit" type="submit" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="login__foot">Access is provisioned by your COSOL administrator.</p>
	</div>

	<footer class="login__copy">COSOL Customer Watch · Enterprise Secure</footer>
</div>

<style>
	.login {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
		padding: 24px;
		background:
			radial-gradient(1200px 600px at 50% -10%, rgba(14, 165, 183, 0.1), transparent 60%), var(--bg);
	}
	.login__panel {
		width: 100%;
		max-width: 400px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: 30px 30px 26px;
	}
	.login__brand {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 22px;
	}
	.login__logobox {
		display: inline-flex;
		background: var(--brand);
		border-radius: 10px;
		padding: 12px 16px;
	}
	.login__logobox img {
		height: 28px;
		width: auto;
		display: block;
	}
	.login__brand small {
		color: var(--text-3);
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.login h1 {
		font-size: 22px;
		font-weight: 700;
	}
	.login__sub {
		color: var(--text-2);
		margin: 4px 0 20px;
		font-size: 13.5px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}
	.login__error {
		background: var(--neg-bg);
		color: var(--neg);
		padding: 9px 12px;
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-weight: 500;
	}
	.login__submit {
		height: 44px;
		margin-top: 4px;
	}
	.login__foot {
		margin-top: 18px;
		font-size: 12px;
		color: var(--text-3);
		text-align: center;
	}
	.login__copy {
		font-size: 12px;
		color: var(--text-3);
	}
</style>
