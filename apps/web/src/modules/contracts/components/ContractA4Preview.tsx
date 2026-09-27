import { FileText } from "lucide-react";

// ── Highlighted preview with # title + **bold** syntax ────────────────────

export function HighlightedPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <p className="text-muted-foreground/50 text-xs italic select-none">
        A pré-visualização aparece aqui enquanto você escreve…
      </p>
    );
  }

  function renderSegment(segment: string, key: string) {
    const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, bi) => {
      if (/^\*\*[^*]+\*\*$/.test(bp)) {
        return <strong key={`${key}-b${bi}`}>{bp.slice(2, -2)}</strong>;
      }
      return <span key={`${key}-b${bi}`}>{bp}</span>;
    });
  }

  function renderLineParts(line: string, baseKey: string) {
    const parts = line.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) =>
      /^\{\{[^}]+\}\}$/.test(part) ? (
        <span
          key={`${baseKey}-${i}`}
          className="text-primary bg-primary/10 rounded px-0.5 font-semibold font-sans"
        >
          {part}
        </span>
      ) : (
        <span key={`${baseKey}-${i}`}>{renderSegment(part, `${baseKey}-${i}`)}</span>
      ),
    );
  }

  const lines = text.split("\n");

  return (
    <div className="text-sm leading-relaxed">
      {lines.map((line, idx) => {
        if (line.startsWith("# ")) {
          return (
            <p key={idx} className="font-bold text-center my-1">
              {renderLineParts(line.slice(2), String(idx))}
            </p>
          );
        }
        if (line.trim() === "") return <br key={idx} />;
        return (
          <p key={idx} className="my-0.5 text-left">
            {renderLineParts(line, String(idx))}
          </p>
        );
      })}
    </div>
  );
}

// ── A4 document shell ──────────────────────────────────────────────────────

interface A4PreviewProps {
  headerImage: string | null;
  content: string;
  footerImage: string | null;
}

export function A4Preview({ headerImage, content, footerImage }: A4PreviewProps) {
  const isEmpty = !headerImage && !content.trim() && !footerImage;

  if (isEmpty) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <FileText className="h-12 w-12 opacity-20" />
        <div>
          <p className="text-sm font-medium">Pré-visualização do documento</p>
          <p className="text-xs mt-1 text-muted-foreground/70">
            Preencha o conteúdo na aba Template para visualizar aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/30 py-8 px-4 flex justify-center min-h-full">
      <div
        className="bg-white text-gray-900 rounded flex flex-col w-full overflow-hidden"
        style={{ maxWidth: "794px", minHeight: "1123px" }}
      >
        {/* ── Header image — full page width ── */}
        {headerImage ? (
          <img
            src={headerImage}
            alt="Cabeçalho"
            className="w-full h-auto shrink-0 block"
          />
        ) : (
          <div className="px-[72px] pt-[48px]">
            <div className="border-b border-gray-200 pb-3 flex items-center justify-center">
              <span className="text-muted-foreground text-xs italic">
                Sem imagem de cabeçalho
              </span>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 pl-[40px] pr-[40px] pt-[10px] pb-[10px]">
          {content.trim() ? (
            <HighlightedPreview text={content} />
          ) : (
            <p className="text-muted-foreground text-sm italic text-center pt-8">
              Sem conteúdo ainda…
            </p>
          )}
        </div>

        {/* ── Footer image — full page width ── */}
        {footerImage ? (
          <img
            src={footerImage}
            alt="Rodapé"
            className="w-full h-auto shrink-0 block"
          />
        ) : (
          <div className="px-[72px] pb-[48px]">
            <div className="border-t border-gray-200 pt-3 flex items-center justify-center">
              <span className="text-muted-foreground text-xs italic">
                Sem imagem de rodapé
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
