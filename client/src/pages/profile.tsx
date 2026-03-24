import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  UserCircle,
  Pencil,
  Check,
  X,
  Phone,
  Mail,
  User,
  LogOut,
  Heart,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, logout, refetch } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [lastName, setLastName] = useState((user as any)?.lastName || "");
  const [phone, setPhone] = useState((user as any)?.phone || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/user/me", { name: name.trim(), lastName: lastName.trim(), phone: phone.trim() });
    },
    onSuccess: async () => {
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setEditing(false);
      toast({ description: "Perfil actualizado" });
    },
    onError: (err: any) => {
      toast({ description: err.message || "Error al guardar", variant: "destructive" });
    },
  });

  const handleCancel = () => {
    setName(user?.name || "");
    setLastName((user as any)?.lastName || "");
    setPhone((user as any)?.phone || "");
    setEditing(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <UserCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Inicia sesión</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Necesitas iniciar sesión para ver tu perfil.
            </p>
            <Button onClick={() => navigate("/")} data-testid="button-go-login">
              Ir a login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fullName = [user.name, (user as any).lastName].filter(Boolean).join(" ");
  const initials = [user.name?.charAt(0), ((user as any).lastName || "")?.charAt(0)]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 bg-background border-b border-border/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
          <button
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            onClick={() => navigate("/explore")}
            data-testid="button-profile-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-bold text-base flex-1" data-testid="text-profile-title">
            Mi Perfil
          </h1>
          {!editing && (
            <button
              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
              onClick={() => setEditing(true)}
              data-testid="button-edit-profile"
              title="Editar perfil"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Avatar + nombre */}
        <div className="flex flex-col items-center py-6 gap-3">
          <div className="h-20 w-20 rounded-full border-2 border-primary/20 overflow-hidden shrink-0" data-testid="avatar-container">
            {(user as any).avatarUrl ? (
              <img
                src={(user as any).avatarUrl}
                alt="Foto de perfil"
                className="w-full h-full object-cover"
                data-testid="avatar-image"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary" data-testid="avatar-initials">
                {initials}
              </div>
            )}
          </div>
          {!editing && (
            <>
              <h2 className="text-xl font-bold text-center leading-tight" data-testid="text-profile-fullname">
                {fullName || "Sin nombre"}
              </h2>
              <Badge variant="secondary" className="text-xs capitalize" data-testid="badge-profile-role">
                {user.role === "CUSTOMER" ? "Cliente" : user.role === "BRANCH_ADMIN" ? "Administrador" : "Super Admin"}
              </Badge>
            </>
          )}
        </div>

        {/* Formulario de edición */}
        {editing ? (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">Editar datos</p>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Nombre</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  data-testid="input-profile-name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Apellido</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Tu apellido"
                  data-testid="input-profile-lastname"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Teléfono</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="55 1234 5678"
                  type="tel"
                  data-testid="input-profile-phone"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  data-testid="button-cancel-edit"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !name.trim()}
                  data-testid="button-save-profile"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  {updateMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Datos del perfil (modo lectura) */
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 divide-y divide-border/50">
              <div className="py-3 flex items-center gap-3" data-testid="row-profile-name">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Nombre completo</p>
                  <p className="text-sm font-medium">{fullName || "—"}</p>
                </div>
              </div>
              <div className="py-3 flex items-center gap-3" data-testid="row-profile-email">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Correo electrónico</p>
                  <p className="text-sm font-medium truncate">{user.email}</p>
                </div>
              </div>
              <div className="py-3 flex items-center gap-3" data-testid="row-profile-phone">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">{(user as any).phone || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accesos rápidos */}
        {!editing && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground px-1">Accesos rápidos</p>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-0 divide-y divide-border/50">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => navigate("/favorites")}
                  data-testid="button-goto-favorites"
                >
                  <Heart className="h-4 w-4 text-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Mis favoritos</p>
                    <p className="text-[11px] text-muted-foreground">Sucursales que marcaste con ♥</p>
                  </div>
                </button>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => navigate("/favorites")}
                  data-testid="button-goto-memberships"
                >
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Mis sucursales</p>
                    <p className="text-[11px] text-muted-foreground">Lugares donde eres miembro</p>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cerrar sesión */}
        {!editing && (
          <button
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-destructive transition-colors rounded-xl hover:bg-destructive/5"
            onClick={async () => {
              await logout();
              navigate("/");
            }}
            data-testid="button-profile-logout"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        )}
      </main>
    </div>
  );
}
