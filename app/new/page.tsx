import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import NewEventForm from './NewEventForm';
import { currentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Create an event' };

export default async function NewEventPage() {
  if (!(await currentUser())) redirect('/login?next=/new');
  return (
    <>
      <h1>Create an event</h1>
      <p className="muted">Pick a sport to fill in the settings. You can change anything later.</p>
      <NewEventForm />
    </>
  );
}
