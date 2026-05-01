import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Pencil, User, Mail, Phone, Shield, Smartphone, History, Save, X } from "lucide-react";
import { toast } from "sonner";

export default function Perfil() {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nome: "Deyvisson Lander Andrade",
    email: "deyvisson.lander@gmail.com",
    telefone: "(33)99917-9552",
    setor: "Administrativo",
    nivelAcesso: "Administrador",
  });

  const handleSave = () => {
    // Modo standalone: persistência real virá quando um backend for plugado.
    toast.success("Perfil atualizado com sucesso!");
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <MainLayout title="Meu Perfil" description="Gerencie suas informações pessoais">
      <div className="space-y-6">
        <div className="flex justify-end">
          {isEditing ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </div>
          ) : (
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Perfil
            </Button>
          )}
        </div>

        {/* Profile Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback className="bg-red-600 text-white text-2xl">
                    <img src="/placeholder.svg" alt="Lander logo" className="h-full w-full object-cover" />
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold">{formData.nome}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{formData.email}</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Função:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {formData.nivelAcesso}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Setor:</span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {formData.setor}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">{formData.telefone}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Info Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>Seus dados cadastrados no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input 
                    value={formData.nome} 
                    readOnly={!isEditing} 
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input 
                    value={formData.email} 
                    readOnly={!isEditing} 
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input 
                    value={formData.telefone} 
                    readOnly={!isEditing} 
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input 
                    value={formData.setor} 
                    readOnly={!isEditing} 
                    className={!isEditing ? "bg-muted" : ""}
                    onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nível de Acesso</Label>
                <Input value={formData.nivelAcesso} readOnly className="bg-muted" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>Gerencie suas configurações de segurança</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <span>Alterar Senha</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <span>Ativar 2FA</span>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors">
                <History className="h-5 w-5 text-muted-foreground" />
                <span>Histórico de Login</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}