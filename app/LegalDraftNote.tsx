export default function LegalDraftNote({ updated }: { updated: string }) {
  return (
    <div className="notice warn small">
      <b>Draft.</b> This page is a working draft and has not yet been reviewed by an attorney. Last updated {updated}.
    </div>
  );
}
