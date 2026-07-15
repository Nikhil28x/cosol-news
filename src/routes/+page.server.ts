import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The product lives under /watch; send the root there.
export const load: PageServerLoad = () => {
	redirect(307, '/watch');
};
