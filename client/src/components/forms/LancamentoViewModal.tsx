import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Music, Calendar } from "lucide-react";

interface LancamentoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento?: any;
}

export function LancamentoViewModal({ open, onOpenChange, lancamento }: LancamentoViewModalProps) {
  if (!lancamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Music className="h-5 w-5" />
            Detalhes do Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title and Artist */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{lancamento.title}</h2>
            <p className="text-muted-foreground">{lancamento.artist}</p>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
              {lancamento.type || "Single"}
            </Badge>
            <Badge className="bg-blue-500 hover:bg-blue-500 text-white">
              Em Análise
            </Badge>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium text-foreground">{lancamento.status?.replace("_", " ") || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Lançamento</p>
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">{lancamento.releaseDate || "-"}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gênero</p>
              <p className="font-medium text-foreground">{lancamento.genre || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Idioma</p>
              <p className="font-medium text-foreground">{lancamento.language || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gravadora</p>
              <p className="font-medium text-foreground">{lancamento.label || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Copyright</p>
              <p className="font-medium text-foreground">{lancamento.copyright || "-"}</p>
            </div>
          </div>

          {/* Streaming Metrics */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
              <span className="text-sm font-medium text-foreground">Métricas de Streaming</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {/* Spotify */}
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                <span className="text-sm text-muted-foreground">Spotify</span>
                <span className="text-lg font-bold text-foreground">{lancamento.platforms?.spotify || "-"}</span>
              </div>
              {/* Apple Music */}
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                <svg className="h-6 w-6 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81.84-.553 1.472-1.287 1.88-2.208.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.6-1.943-1.536a1.97 1.97 0 011.562-2.283c.42-.104.853-.148 1.27-.244.187-.043.377-.09.517-.22.112-.104.162-.24.155-.395V9.075c0-.237-.082-.34-.314-.298-.573.1-1.145.21-1.72.315l-3.638.67c-.02.003-.04.01-.08.022v6.62c0 .385-.047.766-.2 1.124-.295.69-.82 1.09-1.547 1.267-.35.085-.71.14-1.065.158-.95.047-1.806-.592-1.97-1.524-.157-.898.423-1.88 1.352-2.18.39-.125.797-.176 1.2-.244.24-.04.484-.09.715-.169.28-.097.415-.29.407-.586l-.007-.343V6.063c0-.458.12-.632.57-.73l5.75-1.12c.65-.127 1.3-.254 1.952-.38.166-.033.338-.052.506-.08.272-.046.39.078.39.35v6.01z"/>
                </svg>
                <span className="text-sm text-muted-foreground">Apple Music</span>
                <span className="text-lg font-bold text-foreground">{lancamento.platforms?.apple || "-"}</span>
              </div>
              {/* YouTube */}
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                <svg className="h-6 w-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span className="text-sm text-muted-foreground">YouTube</span>
                <span className="text-lg font-bold text-foreground">{lancamento.platforms?.youtube || "-"}</span>
              </div>
              {/* Deezer */}
              <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                <svg className="h-6 w-6 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.81 4.16v3.03H24V4.16h-5.19zM6.27 8.38v3.027h5.189V8.38h-5.19zm12.54 0v3.027H24V8.38h-5.19zM6.27 12.594v3.027h5.189v-3.027h-5.19zm6.271 0v3.027h5.19v-3.027h-5.19zm6.27 0v3.027H24v-3.027h-5.19zM0 16.81v3.029h5.19v-3.03H0zm6.27 0v3.029h5.189v-3.03h-5.19zm6.271 0v3.029h5.19v-3.03h-5.19zm6.27 0v3.029H24v-3.03h-5.19z"/>
                </svg>
                <span className="text-sm text-muted-foreground">Deezer</span>
                <span className="text-lg font-bold text-foreground">{lancamento.platforms?.deezer || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
