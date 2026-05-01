import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation shortcuts
  const shortcuts: ShortcutConfig[] = [
    // Navigation
    { key: "h", altKey: true, action: () => navigate("/"), description: "Ir para Dashboard" },
    { key: "a", altKey: true, action: () => navigate("/artistas"), description: "Ir para Artistas" },
    { key: "f", altKey: true, action: () => navigate("/financeiro"), description: "Ir para Financeiro" },
    { key: "c", altKey: true, action: () => navigate("/contratos"), description: "Ir para Contratos" },
    { key: "m", altKey: true, action: () => navigate("/marketing/visao-geral"), description: "Ir para Marketing" },
    
    // Global actions
    { key: "Escape", action: () => {
      // Close any open modal by dispatching custom event
      window.dispatchEvent(new CustomEvent("close-modals"));
    }, description: "Fechar modal" },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      // Only allow Escape in inputs
      if (e.key !== "Escape") return;
    }

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrlKey ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
      const altMatch = shortcut.altKey ? e.altKey : !e.altKey;
      const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
      
      if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && altMatch && shiftMatch) {
        e.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [navigate, shortcuts]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
}

// Hook for page-specific shortcuts
export function usePageShortcuts(config: {
  onNew?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSearch?: () => void;
  onExport?: () => void;
}) {
  const { onNew, onEdit, onDelete, onSearch, onExport } = config;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // N for New
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onNew?.();
        return;
      }

      // E for Edit (when item selected)
      if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onEdit?.();
        return;
      }

      // Delete/Backspace for Delete
      if ((e.key === "Delete" || e.key === "Backspace") && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onDelete?.();
        return;
      }

      // / for Search
      if (e.key === "/" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onSearch?.();
        return;
      }

      // Ctrl+E for Export
      if (e.key.toLowerCase() === "e" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onExport?.();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onNew, onEdit, onDelete, onSearch, onExport]);
}

// Shortcut help component data
export const shortcutGroups = [
  {
    name: "Navegação",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Busca global" },
      { keys: ["Alt", "H"], description: "Dashboard" },
      { keys: ["Alt", "A"], description: "Artistas" },
      { keys: ["Alt", "F"], description: "Financeiro" },
      { keys: ["Alt", "C"], description: "Contratos" },
      { keys: ["Alt", "M"], description: "Marketing" },
    ],
  },
  {
    name: "Ações",
    shortcuts: [
      { keys: ["N"], description: "Novo item" },
      { keys: ["E"], description: "Editar selecionado" },
      { keys: ["Del"], description: "Excluir selecionado" },
      { keys: ["/"], description: "Focar busca" },
      { keys: ["⌘", "E"], description: "Exportar" },
      { keys: ["Esc"], description: "Fechar modal" },
    ],
  },
];
