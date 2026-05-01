import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Printer, Mail, Send, Loader2, Plus, Trash2 } from "lucide-react";
import { useAutentique } from "@/hooks/useAutentique";
import { toast } from "sonner";

interface Signer {
  email: string;
  name: string;
}

interface ContratoViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato?: any;
}

export function ContratoViewModal({
  open,
  onOpenChange,
  contrato
}: ContratoViewModalProps) {
  const { createDocument, fileToBase64, isCreating } = useAutentique();
  const [showSignerForm, setShowSignerForm] = useState(false);
  const [signers, setSigners] = useState<Signer[]>([{ email: "", name: "" }]);

  if (!contrato) return null;

  const handleDownload = () => {
    toast.info("Funcionalidade de download em desenvolvimento");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    toast.info("Funcionalidade de e-mail em desenvolvimento");
  };

  const handleAddSigner = () => {
    setSigners([...signers, { email: "", name: "" }]);
  };

  const handleRemoveSigner = (index: number) => {
    if (signers.length > 1) {
      setSigners(signers.filter((_, i) => i !== index));
    }
  };

  const handleSignerChange = (index: number, field: keyof Signer, value: string) => {
    const newSigners = [...signers];
    newSigners[index][field] = value;
    setSigners(newSigners);
  };

  const handleAutentique = async () => {
    // Validar signatários
    const validSigners = signers.filter(s => s.email && s.name);
    if (validSigners.length === 0) {
      toast.error("Adicione pelo menos um signatário com nome e email");
      return;
    }

    // Gerar conteúdo HTML do contrato
    const contratoHtml = generateContratoHtml();
    
    // Converter HTML para base64 (simulando PDF por enquanto)
    const base64Content = btoa(unescape(encodeURIComponent(contratoHtml)));

    try {
      await createDocument.mutateAsync({
        name: contrato.titulo || "Contrato de Agenciamento",
        content: base64Content,
        signers: validSigners.map(s => ({
          email: s.email,
          name: s.name,
          action: 'SIGN' as const
        })),
        message: `Você foi convidado a assinar o contrato: ${contrato.titulo || "Contrato de Agenciamento"}`
      });
      
      setShowSignerForm(false);
      setSigners([{ email: "", name: "" }]);
    } catch (error) {
      // Error handled by hook
    }
  };

  const generateContratoHtml = () => {
    const nomeContratante = contrato.artistas?.nome_artistico || contrato.artist || "Não informado";
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1 style="text-align: center;">CONTRATO DE AGENCIAMENTO, REPRESENTAÇÃO E EXCLUSIVIDADE</h1>
          <p><strong>REPRESENTANTE:</strong> Lander Produtora, pessoa jurídica de direito privado, inscrita no CNPJ nº 50.056.858/0001-46...</p>
          <p><strong>ARTISTA:</strong> ${nomeContratante}</p>
          <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
        </body>
      </html>
    `;
  };

  const nomeContratante = contrato.artistas?.nome_artistico || contrato.artist || contrato.contratante || "Não informado";
  const cpfCnpj = contrato.cpfCnpj || "000.000.000-00";
  const endereco = contrato.endereco || "Endereço não informado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-red-500" />
            Prévia do Contrato
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-180px)]">
          <div className="p-6">
            {/* Formulário de Signatários */}
            {showSignerForm && (
              <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Adicionar Signatários
                </h3>
                <div className="space-y-3">
                  {signers.map((signer, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          placeholder="Nome completo"
                          value={signer.name}
                          onChange={(e) => handleSignerChange(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          placeholder="email@exemplo.com"
                          value={signer.email}
                          onChange={(e) => handleSignerChange(index, "email", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSigner(index)}
                        disabled={signers.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={handleAddSigner}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Signatário
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAutentique}
                    disabled={isCreating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Enviar para Assinatura
                      </>
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSignerForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Documento do Contrato */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
              {/* Header decorativo */}
              <div className="relative h-48 bg-gradient-to-r from-black via-black to-red-900 overflow-hidden">
                <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ height: '100px' }}>
                  <path d="M0,0 C150,90 350,90 600,45 C850,0 1050,60 1200,30 L1200,120 L0,120 Z" fill="#dc2626" opacity="0.8" />
                  <path d="M0,30 C200,90 400,60 600,60 C800,60 1000,90 1200,45 L1200,120 L0,120 Z" fill="#b91c1c" opacity="0.6" />
                </svg>
              </div>

              {/* Conteúdo do contrato */}
              <div className="p-8 space-y-6 text-gray-900">
                <div className="text-center">
                  <h1 className="text-xl font-bold uppercase tracking-wide">
                    CONTRATO DE AGENCIAMENTO, REPRESENTAÇÃO E EXCLUSIVIDADE
                  </h1>
                </div>

                <div className="text-justify leading-relaxed">
                  <p>
                    <strong>REPRESENTANTE:</strong> Lander Produtora, pessoa jurídica de direito privado, 
                    inscrita no CNPJ nº 50.056.858/0001-46, com sede na Rua A, nº 58, Bairro Vila Império, 
                    Governador Valadares/MG, CEP 35050-560, representada por Deyvisson Lander Andrade, 
                    brasileiro, solteiro, empresário, portador do RG 0000000 e CPF 000.000.000-00, 
                    doravante denominada simplesmente <strong>REPRESENTANTE</strong>.
                  </p>
                </div>

                <div className="text-justify leading-relaxed">
                  <p>
                    <strong>ARTISTA:</strong> {nomeContratante}, pessoa física, portador(a) do 
                    CPF/CNPJ nº {cpfCnpj}, residente e domiciliado(a) em {endereco}, 
                    doravante denominado(a) simplesmente <strong>ARTISTA</strong>.
                  </p>
                </div>

                <div className="text-justify leading-relaxed">
                  <p>
                    <strong>CONSIDERANDO</strong> que o REPRESENTANTE atua no ramo de agenciamento artístico, 
                    produção musical e gestão de carreiras;
                  </p>
                  <p className="mt-2">
                    <strong>CONSIDERANDO</strong> que o ARTISTA deseja ser representado profissionalmente 
                    para desenvolvimento de sua carreira artística;
                  </p>
                  <p className="mt-2">
                    As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de 
                    Agenciamento, Representação e Exclusividade, que se regerá pelas cláusulas seguintes 
                    e pelas condições descritas no presente.
                  </p>
                </div>

                <div className="text-justify leading-relaxed">
                  <h3 className="font-bold mb-2">CLÁUSULA PRIMEIRA - DO OBJETO</h3>
                  <p>
                    1.1. O presente contrato tem por objeto a prestação de serviços de agenciamento, 
                    representação e exclusividade do ARTISTA pelo REPRESENTANTE, para fins de 
                    desenvolvimento de carreira artística, incluindo, mas não se limitando a: 
                    negociação de shows, eventos, participações em mídias, contratos publicitários, 
                    licenciamento de imagem e voz, produção musical e gestão de carreira.
                  </p>
                </div>

                <div className="text-justify leading-relaxed">
                  <h3 className="font-bold mb-2">CLÁUSULA SEGUNDA - DA EXCLUSIVIDADE</h3>
                  <p>
                    2.1. O ARTISTA concede ao REPRESENTANTE exclusividade total na representação 
                    de sua carreira artística durante toda a vigência deste contrato, ficando vedado 
                    ao ARTISTA firmar qualquer tipo de acordo, contrato ou compromisso profissional 
                    sem a prévia e expressa autorização do REPRESENTANTE.
                  </p>
                </div>

                <div className="text-center text-gray-500 py-4">
                  <p className="text-sm italic">[Continuação das cláusulas contratuais...]</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            Fechar
          </Button>
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
          <Button variant="outline" onClick={handleEmail} className="gap-2">
            <Mail className="h-4 w-4" />
            E-mail
          </Button>
          <Button 
            onClick={() => setShowSignerForm(true)} 
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
            disabled={showSignerForm}
          >
            <Send className="h-4 w-4" />
            Enviar para Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}