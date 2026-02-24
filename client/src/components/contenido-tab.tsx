import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Camera,
  ImagePlus,
  FileText,
  ShoppingBag,
  Video,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BranchPhoto, BranchPost, BranchProduct, BranchVideo } from "@shared/schema";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch("/api/branch/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.message || "Error al subir archivo");
  }
  const data = await resp.json();
  return data.url;
}

function FileUploadButton({
  accept,
  onUpload,
  uploading,
  label,
  testId,
}: {
  accept: string;
  onUpload: (file: File) => void;
  uploading: boolean;
  label: string;
  testId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
        data-testid={`${testId}-input`}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        data-testid={testId}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
        {label}
      </Button>
    </>
  );
}

function ProfilePhotoSection() {
  const { toast } = useToast();
  const { data: photos, isLoading } = useQuery<BranchPhoto[]>({
    queryKey: ["/api/branch/photos"],
  });
  const [uploading, setUploading] = useState(false);

  const profilePhoto = photos?.find((p) => p.type === "profile");

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto de perfil eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      if (profilePhoto) {
        await apiRequest("DELETE", `/api/branch/photos/${profilePhoto.id}`);
      }
      const url = await uploadFile(file);
      await apiRequest("POST", "/api/branch/photos", { type: "profile", url });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto de perfil actualizada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <Skeleton className="h-32 w-full" data-testid="skeleton-profile-photo" />;

  return (
    <Card data-testid="card-profile-photo">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Foto de Perfil
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profilePhoto ? (
          <div className="flex items-center gap-4">
            <img
              src={profilePhoto.url}
              alt="Perfil"
              className="h-24 w-24 rounded-lg object-cover border"
              data-testid="img-profile-photo"
            />
            <div className="flex flex-col gap-2">
              <FileUploadButton
                accept="image/jpeg,image/png,image/webp"
                onUpload={handleUpload}
                uploading={uploading}
                label="Cambiar"
                testId="button-change-profile-photo"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => deleteMutation.mutate(profilePhoto.id)}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-profile-photo"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center" data-testid="placeholder-profile-photo">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <FileUploadButton
              accept="image/jpeg,image/png,image/webp"
              onUpload={handleUpload}
              uploading={uploading}
              label="Subir foto de perfil"
              testId="button-upload-profile-photo"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FacilityPhotosSection() {
  const { toast } = useToast();
  const { data: photos, isLoading } = useQuery<BranchPhoto[]>({
    queryKey: ["/api/branch/photos"],
  });
  const [uploading, setUploading] = useState(false);

  const facilityPhotos = (photos || [])
    .filter((p) => p.type === "facility")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto eliminada" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/photos/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      await apiRequest("POST", "/api/branch/photos", { type: "facility", url });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/photos"] });
      toast({ title: "Foto agregada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const movePhoto = (index: number, direction: "up" | "down") => {
    const ids = facilityPhotos.map((p) => p.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-facility-photos" />;

  return (
    <Card data-testid="card-facility-photos">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ImagePlus className="h-4 w-4" />
            Fotos de Instalaciones
            <Badge variant="secondary" className="text-xs" data-testid="badge-facility-count">
              {facilityPhotos.length}/5
            </Badge>
          </CardTitle>
          {facilityPhotos.length < 5 && (
            <FileUploadButton
              accept="image/jpeg,image/png,image/webp"
              onUpload={handleUpload}
              uploading={uploading}
              label="Agregar"
              testId="button-add-facility-photo"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {facilityPhotos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-facility-photos">
            No hay fotos de instalaciones. Sube hasta 5 fotos.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {facilityPhotos.map((photo, idx) => (
              <div key={photo.id} className="relative group" data-testid={`facility-photo-${photo.id}`}>
                <img
                  src={photo.url}
                  alt={`Instalación ${idx + 1}`}
                  className="h-28 w-full rounded-lg object-cover border"
                />
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => movePhoto(idx, "up")} data-testid={`button-move-up-photo-${photo.id}`}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                  )}
                  {idx < facilityPhotos.length - 1 && (
                    <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => movePhoto(idx, "down")} data-testid={`button-move-down-photo-${photo.id}`}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => deleteMutation.mutate(photo.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-photo-${photo.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostsSection() {
  const { toast } = useToast();
  const { data: posts, isLoading } = useQuery<BranchPost[]>({
    queryKey: ["/api/branch/posts"],
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchPost | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const sortedPosts = (posts || []).sort((a, b) => a.displayOrder - b.displayOrder);

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; mediaUrl?: string; mediaType?: string }) => {
      await apiRequest("POST", "/api/branch/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/posts"] });
      toast({ title: "Post creado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/branch/posts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/posts"] });
      toast({ title: "Post actualizado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/posts"] });
      toast({ title: "Post eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/posts/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/posts"] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setTitle("");
    setContent("");
    setMediaUrl("");
    setMediaType("");
  };

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setMediaUrl("");
    setMediaType("");
    setDialogOpen(true);
  };

  const openEdit = (post: BranchPost) => {
    setEditing(post);
    setTitle(post.title);
    setContent(post.content);
    setMediaUrl(post.mediaUrl || "");
    setMediaType((post.mediaType as "image" | "video") || "");
    setDialogOpen(true);
  };

  const handleMediaUpload = async (file: File) => {
    setUploadingMedia(true);
    try {
      const url = await uploadFile(file);
      setMediaUrl(url);
      setMediaType(file.type.startsWith("video/") ? "video" : "image");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = () => {
    const data: any = { title, content };
    if (mediaUrl && mediaType) {
      data.mediaUrl = mediaUrl;
      data.mediaType = mediaType;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const movePost = (index: number, direction: "up" | "down") => {
    const ids = sortedPosts.map((p) => p.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-posts" />;

  return (
    <Card data-testid="card-posts">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Posts Fijos
            <Badge variant="secondary" className="text-xs" data-testid="badge-posts-count">
              {sortedPosts.length}/3
            </Badge>
          </CardTitle>
          {sortedPosts.length < 3 && (
            <Button variant="outline" size="sm" onClick={openCreate} data-testid="button-create-post">
              <Plus className="h-4 w-4 mr-1" /> Nuevo
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-posts">
            No hay posts. Crea hasta 3 posts fijos para tu perfil público.
          </p>
        ) : (
          <div className="space-y-3">
            {sortedPosts.map((post, idx) => (
              <div key={post.id} className="border rounded-lg p-3 space-y-2" data-testid={`post-card-${post.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate" data-testid={`text-post-title-${post.id}`}>{post.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-post-content-${post.id}`}>{post.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {idx > 0 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => movePost(idx, "up")} data-testid={`button-move-up-post-${post.id}`}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                    )}
                    {idx < sortedPosts.length - 1 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => movePost(idx, "down")} data-testid={`button-move-down-post-${post.id}`}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(post)} data-testid={`button-edit-post-${post.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(post.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-post-${post.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {post.mediaUrl && (
                  <div className="rounded overflow-hidden">
                    {post.mediaType === "video" ? (
                      <video src={post.mediaUrl} controls className="w-full max-h-40 rounded" data-testid={`video-post-${post.id}`} />
                    ) : (
                      <img src={post.mediaUrl} alt={post.title} className="w-full max-h-40 object-cover rounded" data-testid={`img-post-${post.id}`} />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent data-testid="dialog-post">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Post" : "Nuevo Post"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del post" data-testid="input-post-title" />
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Texto del post" rows={3} data-testid="input-post-content" />
            </div>
            <div>
              <Label>Media (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <FileUploadButton
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                  onUpload={handleMediaUpload}
                  uploading={uploadingMedia}
                  label="Subir imagen/video"
                  testId="button-upload-post-media"
                />
                {mediaUrl && (
                  <Button variant="ghost" size="sm" onClick={() => { setMediaUrl(""); setMediaType(""); }} data-testid="button-remove-post-media">
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                )}
              </div>
              {mediaUrl && (
                <div className="mt-2 rounded overflow-hidden">
                  {mediaType === "video" ? (
                    <video src={mediaUrl} controls className="w-full max-h-32 rounded" data-testid="preview-post-video" />
                  ) : (
                    <img src={mediaUrl} alt="Preview" className="w-full max-h-32 object-cover rounded" data-testid="preview-post-image" />
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-post">Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim() || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-post"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ProductsSection() {
  const { toast } = useToast();
  const { data: products, isLoading } = useQuery<BranchProduct[]>({
    queryKey: ["/api/branch/products"],
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchProduct | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const sortedProducts = (products || []).sort((a, b) => a.displayOrder - b.displayOrder);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/branch/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Producto creado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/branch/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Producto actualizado" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
      toast({ title: "Producto eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/products/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/products"] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setPrice("");
    setImageUrl("");
    setDialogOpen(true);
  };

  const openEdit = (product: BranchProduct) => {
    setEditing(product);
    setName(product.name);
    setDescription(product.description || "");
    setPrice((product.price / 100).toFixed(2));
    setImageUrl(product.imageUrl || "");
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadFile(file);
      setImageUrl(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = () => {
    const priceInCents = Math.round(parseFloat(price) * 100);
    const data: any = { name, price: priceInCents };
    if (description) data.description = description;
    if (imageUrl) data.imageUrl = imageUrl;
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const moveProduct = (index: number, direction: "up" | "down") => {
    const ids = sortedProducts.map((p) => p.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-products" />;

  return (
    <Card data-testid="card-products">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Productos
            {sortedProducts.length > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-products-count">
                {sortedProducts.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openCreate} data-testid="button-create-product">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {sortedProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-products">
            No hay productos. Agrega productos a tu catálogo.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedProducts.map((product, idx) => (
              <div key={product.id} className="border rounded-lg overflow-hidden" data-testid={`product-card-${product.id}`}>
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-28 w-full object-cover" data-testid={`img-product-${product.id}`} />
                ) : (
                  <div className="h-28 w-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate" data-testid={`text-product-name-${product.id}`}>{product.name}</h4>
                      <p className="text-sm font-semibold text-primary" data-testid={`text-product-price-${product.id}`}>
                        ${(product.price / 100).toFixed(2)} MXN
                      </p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {idx > 0 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveProduct(idx, "up")} data-testid={`button-move-up-product-${product.id}`}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      )}
                      {idx < sortedProducts.length - 1 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveProduct(idx, "down")} data-testid={`button-move-down-product-${product.id}`}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(product)} data-testid={`button-edit-product-${product.id}`}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(product.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-product-${product.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent data-testid="dialog-product">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del producto" data-testid="input-product-name" />
            </div>
            <div>
              <Label>Precio (MXN)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" step="0.01" min="0" data-testid="input-product-price" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del producto" rows={2} data-testid="input-product-description" />
            </div>
            <div>
              <Label>Imagen (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <FileUploadButton
                  accept="image/jpeg,image/png,image/webp"
                  onUpload={handleImageUpload}
                  uploading={uploadingImage}
                  label="Subir imagen"
                  testId="button-upload-product-image"
                />
                {imageUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setImageUrl("")} data-testid="button-remove-product-image">
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                )}
              </div>
              {imageUrl && (
                <img src={imageUrl} alt="Preview" className="mt-2 w-full max-h-32 object-cover rounded" data-testid="preview-product-image" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-product">Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim() || !price || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-product"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function VideosSection() {
  const { toast } = useToast();
  const { data: videos, isLoading } = useQuery<BranchVideo[]>({
    queryKey: ["/api/branch/videos"],
  });
  const [uploading, setUploading] = useState(false);

  const sortedVideos = (videos || []).sort((a, b) => a.displayOrder - b.displayOrder);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/branch/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/videos"] });
      toast({ title: "Video eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("POST", "/api/branch/videos/reorder", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branch/videos"] });
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadFile(file);
      await apiRequest("POST", "/api/branch/videos", { url, title: file.name.replace(/\.[^.]+$/, "") });
      queryClient.invalidateQueries({ queryKey: ["/api/branch/videos"] });
      toast({ title: "Video agregado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const moveVideo = (index: number, direction: "up" | "down") => {
    const ids = sortedVideos.map((v) => v.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" data-testid="skeleton-videos" />;

  return (
    <Card data-testid="card-videos">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4" />
            Videos de Entrenamiento
            {sortedVideos.length > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-videos-count">
                {sortedVideos.length}
              </Badge>
            )}
          </CardTitle>
          <FileUploadButton
            accept="video/mp4,video/webm"
            onUpload={handleUpload}
            uploading={uploading}
            label="Agregar"
            testId="button-add-video"
          />
        </div>
      </CardHeader>
      <CardContent>
        {sortedVideos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-videos">
            No hay videos. Sube videos cortos de entrenamientos o servicios.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sortedVideos.map((video, idx) => (
              <div key={video.id} className="border rounded-lg overflow-hidden" data-testid={`video-card-${video.id}`}>
                <video src={video.url} controls className="w-full h-36 object-cover bg-black" data-testid={`video-player-${video.id}`} />
                <div className="p-2 flex items-center justify-between">
                  <span className="text-xs font-medium truncate flex-1" data-testid={`text-video-title-${video.id}`}>
                    {video.title || "Sin título"}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {idx > 0 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveVideo(idx, "up")} data-testid={`button-move-up-video-${video.id}`}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                    )}
                    {idx < sortedVideos.length - 1 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveVideo(idx, "down")} data-testid={`button-move-down-video-${video.id}`}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(video.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-video-${video.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ContenidoTab() {
  return (
    <div className="space-y-4" data-testid="contenido-tab">
      <ProfilePhotoSection />
      <FacilityPhotosSection />
      <PostsSection />
      <ProductsSection />
      <VideosSection />
    </div>
  );
}
