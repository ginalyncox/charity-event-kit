import type { Metadata } from 'next';
import NewEventForm from './NewEventForm';

export const metadata: Metadata = { title: 'Create an event' };

export default function NewEventPage() {
  return (
    <>
      <h1>Create an event</h1>
      <p className="muted">Pick a sport to fill in the settings. You can change anything later.</p>
      <NewEventForm />
    </>
  );
}
