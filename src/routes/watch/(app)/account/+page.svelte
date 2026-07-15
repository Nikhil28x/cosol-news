<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>My Account · COSOL Customer Watch</title></svelte:head>

<div class="wrap">
	<section class="card">
		<div class="card__head"><span class="card__title">👤 Profile</span></div>
		<div class="card__body">
			<dl class="profile">
				<dt>Name</dt>
				<dd>{data.me.fullName}</dd>
				<dt>Email</dt>
				<dd>{data.me.email}</dd>
				<dt>Role</dt>
				<dd>{data.me.role === 'admin' ? 'Administrator' : 'Member'}</dd>
				{#if data.me.pod}<dt>POD</dt>
					<dd>{data.me.pod}</dd>{/if}
			</dl>
		</div>
	</section>

	<section class="card">
		<div class="card__head"><span class="card__title">🔒 Change password</span></div>
		<div class="card__body">
			<form method="POST" use:enhance class="pw-form">
				{#if form?.success}
					<p class="ok" role="status">Password updated.</p>
				{:else if form?.error}
					<p class="err" role="alert">{form.error}</p>
				{/if}
				<div class="field">
					<label for="current">Current password</label>
					<input
						class="input"
						id="current"
						name="current"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				<div class="field">
					<label for="next">New password</label>
					<input
						class="input"
						id="next"
						name="next"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>
				<div class="field">
					<label for="confirm">Confirm new password</label>
					<input
						class="input"
						id="confirm"
						name="confirm"
						type="password"
						autocomplete="new-password"
						minlength="8"
						required
					/>
				</div>
				<button class="btn btn--primary" type="submit">Update password</button>
			</form>
		</div>
	</section>
</div>

<style>
	.wrap {
		display: grid;
		gap: 16px;
		max-width: 560px;
	}
	.profile {
		display: grid;
		grid-template-columns: 120px 1fr;
		row-gap: 10px;
		font-size: 13.5px;
	}
	.profile dt {
		color: var(--text-3);
		font-weight: 600;
	}
	.profile dd {
		color: var(--text);
	}
	.pw-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 380px;
	}
	.ok {
		background: var(--pos-bg);
		color: var(--pos);
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
	}
	.err {
		background: var(--neg-bg);
		color: var(--neg);
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
	}
</style>
