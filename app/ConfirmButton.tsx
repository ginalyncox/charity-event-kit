'use client';

/** A submit button that asks "Are you sure?" before the form goes through. */
export default function ConfirmButton({
  message,
  className = 'btn',
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
