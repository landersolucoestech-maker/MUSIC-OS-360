/**
 * shared/components/StoredFileLink.tsx
 *
 * Link to a file stored by the app. Upload links open through the
 * tenant-checked signed download (see shared/lib/stored-file.ts); the raw
 * stored URL is never used as the href of an upload, so opening a document
 * does not depend on the bucket being public (find-df79ea88).
 */
import { forwardRef, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { openStoredFile, uploadFileIdFromUrl } from "@/shared/lib/stored-file";
import { safeLinkHref } from "@/shared/lib/safe-url";

interface StoredFileLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  url: string | null | undefined;
  children: ReactNode;
}

export const StoredFileLink = forwardRef<HTMLAnchorElement, StoredFileLinkProps>(
  function StoredFileLink({ url, children, target: _target, rel: _rel, onClick, ...rest }, ref) {
    const isUpload = uploadFileIdFromUrl(url) !== null;
    const href = isUpload ? "#" : safeLinkHref(url);

    function handleClick(e: MouseEvent<HTMLAnchorElement>) {
      onClick?.(e);
      if (!isUpload) return;
      e.preventDefault();
      openStoredFile(url).catch(() => {
        toast.error("Não foi possível abrir o arquivo. Verifique sua conexão e permissões.");
      });
    }

    return (
      <a {...rest} ref={ref} href={href || undefined} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {children}
      </a>
    );
  },
);
