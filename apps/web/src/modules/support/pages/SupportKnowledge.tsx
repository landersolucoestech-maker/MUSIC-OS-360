import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { MainLayout } from "@/shared/components/MainLayout";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/shared/ui/dialog";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/shared/ui/command";
import { cn } from "@/shared/lib/utils";
import { useKnowledgeArticles, useKnowledgeCategories } from "../hooks/useSupport";
import type { KnowledgeArticle } from "../types";
import {
  Search, BookOpen, Eye, ThumbsUp,
  Clock, FileText, Zap,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function ArticleCard({ article, onClick }: { article: KnowledgeArticle; onClick: () => void }) {
  return (
    <button
      className={cn(
        "w-full text-left rounded-xl border border-border/60 bg-card p-4",
        "hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200 group",
      )}
      onClick={onClick}
      data-testid={`card-article-${article.id}`}
    >
      <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-2">
        {article.title}
      </p>
      <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">{article.summary}</p>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views}</span>
        <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpful_count}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.read_time} min</span>
        <span className="ml-auto">{formatDate(article.updated_at)}</span>
      </div>
    </button>
  );
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-[13px] font-bold text-foreground mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-[14px] font-bold text-foreground mt-5 mb-1.5">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-[15px] font-bold text-foreground mt-5 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    .replace(/`(.+?)`/g, '<code class="font-sans text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="flex gap-2 text-[12px] text-foreground/80 leading-relaxed"><span class="text-primary mt-1">•</span><span>$1</span></li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex gap-2 text-[12px] text-foreground/80 leading-relaxed"><span class="text-primary font-sans text-[11px] mt-0.5">$1.</span><span>$2</span></li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-primary/40 pl-3 text-[12px] text-muted-foreground italic my-2">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="border-border/60 my-3" />')
    .replace(/\n\n/g, '</p><p class="text-[12px] text-foreground/80 leading-relaxed">')
    .replace(/\n/g, '<br />');
}

function ArticleModal({ article, onClose }: { article: KnowledgeArticle; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 text-[11px] text-muted-foreground">
            <span>{article.category_name}</span>
            <span>·</span>
            <span>{article.read_time} min de leitura</span>
          </div>
          <DialogTitle className="text-base leading-snug text-left">{article.title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">{article.summary}</p>
          <div
            className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-1"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                `<p class="text-[12px] text-foreground/80 leading-relaxed">${renderMarkdown(article.content)}</p>`,
                { USE_PROFILES: { html: true } }
              ),
            }}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60 pt-3">
            <span>Atualizado em {formatDate(article.updated_at)}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{article.views} visualizações</span>
              <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{article.helpful_count} úteis</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SupportKnowledge() {
  const { articles, isLoading: loadingArticles, incrementViews } = useKnowledgeArticles();
  const { categories: knowledgeCategories, isLoading: loadingCategories } = useKnowledgeCategories();
  const isLoading = loadingArticles || loadingCategories;
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArticle, setSelectedArticle]   = useState<KnowledgeArticle | null>(null);
  const [commandOpen, setCommandOpen]           = useState(false);
  const [categoryFilter, setCategoryFilter]     = useState<string>("all");

  /* Ctrl+K / Cmd+K shortcut opens command menu */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openArticle = useCallback((a: KnowledgeArticle) => {
    incrementViews(a.id);
    setSelectedArticle(a);
    setCommandOpen(false);
  }, [incrementViews]);

  const filtered = articles.filter((a) => {
    if (a.published === false) return false; // hide unpublished content
    if (selectedCategory !== "all" && a.category_id !== selectedCategory) return false;
    return true;
  });

  const totalArticles = articles.length;
  const totalViews    = articles.reduce((s, a) => s + a.views, 0);

  return (
    <MainLayout
      title="Base de Conhecimento"
      description="Artigos, tutoriais e guias"
    >
      <div className="space-y-6 animate-fade-in">

        {/* Hero banner */}
        <div className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-card p-7",
        )}>
          <div className="relative max-w-xl mx-auto text-center">
            <BookOpen className="h-8 w-8 text-primary mx-auto mb-3" />
            <h2 className="text-xl font-bold text-foreground mb-1">Como podemos ajudar?</h2>
            <p className="text-[13px] text-muted-foreground mb-4">
              {totalArticles} artigos disponíveis · {totalViews.toLocaleString()} visualizações
            </p>
            <button
              className={cn(
                "w-full max-w-md mx-auto flex items-center gap-3 px-4 h-10 rounded-lg",
                "border border-border/60 bg-background text-muted-foreground text-sm",
                "hover:border-primary/50 hover:bg-card transition-colors cursor-pointer",
              )}
              onClick={() => setCommandOpen(true)}
              data-testid="button-hero-search"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Buscar artigos, guias, tutoriais...</span>
              <kbd className="text-[10px] font-sans bg-muted px-1.5 py-0.5 rounded border border-border/60 shrink-0">
                Ctrl+K
              </kbd>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] text-muted-foreground">Carregando artigos...</p>
          </div>
        ) : (
        <>
        {/* Category quick-filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedCategory("all"); setCategoryFilter("all"); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border transition-colors",
              selectedCategory === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
            data-testid="category-all"
          >
            <FileText className="h-3 w-3" />
            Todos ({totalArticles})
          </button>
          {knowledgeCategories.map((cat) => {
            const count = articles.filter((a) => a.category_id === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setCategoryFilter(cat.id); }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12px] border transition-colors",
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                )}
                data-testid={`category-${cat.id}`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Featured articles */}
        {selectedCategory === "all" && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-semibold text-foreground">Em destaque</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {articles.filter((a) => a.featured && a.published !== false).map((article) => (
                <ArticleCard key={article.id} article={article} onClick={() => openArticle(article)} />
              ))}
            </div>
          </div>
        )}

        {/* Filtered articles */}
        <div>
          {selectedCategory !== "all" && (
            <h3 className="text-[13px] font-semibold text-foreground mb-3">
              {knowledgeCategories.find((c) => c.id === selectedCategory)?.name}
              {" "}· {filtered.length} artigo{filtered.length !== 1 ? "s" : ""}
            </h3>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">Nenhum artigo nesta categoria</p>
            </div>
          ) : selectedCategory !== "all" ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {filtered.map((article) => (
                <ArticleCard key={article.id} article={article} onClick={() => openArticle(article)} />
              ))}
            </div>
          ) : (
            <div>
              <h3 className="text-[13px] font-semibold text-foreground mb-3">Todos os artigos</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} onClick={() => openArticle(article)} />
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Command menu — quick search */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Buscar artigo..." data-testid="input-command-search" />
        <CommandList>
          <CommandEmpty>Nenhum artigo encontrado.</CommandEmpty>
          {knowledgeCategories.map((cat) => {
            const catArticles = articles.filter((a) => a.category_id === cat.id);
            if (catArticles.length === 0) return null;
            return (
              <CommandGroup key={cat.id} heading={cat.name}>
                {catArticles.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.title} ${a.summary} ${cat.name}`}
                    onSelect={() => openArticle(a)}
                    data-testid={`cmd-article-${a.id}`}
                  >
                    <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.summary}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {a.read_time} min
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>

      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </MainLayout>
  );
}
