import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { invalidateBranchCommercialQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type ProjectStatus = "draft" | "active" | "completed" | "cancelled" | "archived";

type BranchClientOption = {
  userId: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

type ProjectSummary = {
  linkedSalesCount: number;
  linkedPurchasesCount: number;
  linkedDraftPurchasesCount: number;
  revenueBeforeTax: number;
  revenueHistoricalWithoutBreakdown: number;
  taxCollected: number;
  revenueGrossTotal: number;
  cashCollectedTotal: number;
  purchaseCommittedBeforeTax: number;
  purchaseCommittedHistoricalWithoutBreakdown: number;
  purchaseReceivedBeforeTax: number;
  purchaseReceivedHistoricalWithoutBreakdown: number;
  purchasePaidTotal: number;
  committedProfitEstimate: number;
  receivedProfitEstimate: number;
  cashFlowNet: number;
  marginPercent: number | null;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ProjectRow = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  customerUserId: string | null;
  customerDisplayName: string | null;
  status: ProjectStatus;
  startDate: string;
  expectedEndDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  summary: ProjectSummary;
};

type LinkedSale = {
  id: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  createdAt: string;
  cancelledAt: string | null;
};

type LinkedPurchase = {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  purchaseDate: string;
  paymentStatus: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode: string | null;
  taxRate: number | null;
  subtotalBeforeTax: number | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

type ProjectDetail = ProjectRow & {
  sales: LinkedSale[];
  purchases: LinkedPurchase[];
};

type LinkableSale = {
  id: string;
  folio: string;
  clientUserId: string | null;
  clientDisplayName: string | null;
  status: string;
  totalAmount: number;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  createdAt: string;
};

type LinkablePurchase = {
  id: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  status: string;
  totalAmount: number;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
  purchaseDate: string;
};

type ProjectListResponse = {
  items: ProjectRow[];
  pagination: PaginationMeta;
};

type LinkableSalesResponse = {
  items: LinkableSale[];
  pagination: PaginationMeta;
};

type LinkablePurchasesResponse = {
  items: LinkablePurchase[];
  pagination: PaginationMeta;
};

type ProjectFormState = {
  name: string;
  customerUserId: string;
  status: ProjectStatus;
  startDate: string;
  expectedEndDate: string;
  description: string;
  notes: string;
};

const BRANCH_CLIENTS_QUERY_KEY = ["/api/branch/clients?include_left=true"];
const NO_CLIENT_VALUE = "none";
const DEFAULT_STATUS_FILTER = "all";

function getTodayIsoDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function createInitialProjectFormState(): ProjectFormState {
  return {
    name: "",
    customerUserId: NO_CLIENT_VALUE,
    status: "draft",
    startDate: getTodayIsoDate(),
    expectedEndDate: "",
    description: "",
    notes: "",
  };
}

function formatCurrencyMx(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: ProjectStatus) {
  switch (status) {
    case "draft":
      return "Borrador";
    case "active":
      return "Activo";
    case "completed":
      return "Completado";
    case "cancelled":
      return "Cancelado";
    case "archived":
      return "Archivado";
    default:
      return status;
  }
}

function getStatusBadgeVariant(status: ProjectStatus) {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "archived") return "secondary";
  if (status === "active") return "outline";
  return "secondary";
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const rawMessage = error.message || fallback;
  const normalized = rawMessage.replace(/^\d+:\s*/, "").trim();
  try {
    const parsed = JSON.parse(normalized);
    if (parsed?.message && typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch {
    return normalized || fallback;
  }
  return normalized || fallback;
}

function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  isBusy = false,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isBusy?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 25 | 50 | 100) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {total === 0 ? "Sin resultados" : `${total} resultados · Página ${page} de ${totalPages}${isBusy ? " · actualizando..." : ""}`}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as 25 | 50 | 100)}>
          <SelectTrigger className="w-[118px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 por página</SelectItem>
            <SelectItem value="50">50 por página</SelectItem>
            <SelectItem value="100">100 por página</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Siguiente
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function buildProjectsQuery(search: string, status: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (search.trim()) params.set("search", search.trim());
  if (status && status !== DEFAULT_STATUS_FILTER) params.set("status", status);
  const query = params.toString();
  return query ? `/api/branch/commercial-projects?${query}` : "/api/branch/commercial-projects";
}

function buildLinkableSalesQuery(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (search.trim()) params.set("search", search.trim());
  const query = params.toString();
  return query ? `/api/branch/commercial-projects/linkable-sales?${query}` : "/api/branch/commercial-projects/linkable-sales";
}

function buildLinkablePurchasesQuery(search: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (search.trim()) params.set("search", search.trim());
  const query = params.toString();
  return query ? `/api/branch/commercial-projects/linkable-purchases?${query}` : "/api/branch/commercial-projects/linkable-purchases";
}

function hasHistoricalBreakdownGaps(summary: ProjectSummary) {
  return summary.revenueHistoricalWithoutBreakdown > 0
    || summary.purchaseCommittedHistoricalWithoutBreakdown > 0
    || summary.purchaseReceivedHistoricalWithoutBreakdown > 0;
}

function hasFiscalBreakdown(row: {
  taxMode?: string | null;
  taxableSubtotal: number | null;
  taxTotal: number | null;
  grandTotal: number | null;
}) {
  return row.taxMode != null
    || row.taxableSubtotal != null
    || row.taxTotal != null
    || row.grandTotal != null;
}

export default function ProyectosTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(createInitialProjectFormState());
  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [linkSaleProject, setLinkSaleProject] = useState<ProjectRow | null>(null);
  const [linkPurchaseProject, setLinkPurchaseProject] = useState<ProjectRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [createFromSaleOpen, setCreateFromSaleOpen] = useState(false);
  const [linkSaleSearch, setLinkSaleSearch] = useState("");
  const [linkSalePage, setLinkSalePage] = useState(1);
  const [linkSalePageSize, setLinkSalePageSize] = useState<25 | 50 | 100>(25);
  const [linkPurchaseSearch, setLinkPurchaseSearch] = useState("");
  const [linkPurchasePage, setLinkPurchasePage] = useState(1);
  const [linkPurchasePageSize, setLinkPurchasePageSize] = useState<25 | 50 | 100>(25);
  const [createFromSaleSearch, setCreateFromSaleSearch] = useState("");
  const [createFromSalePage, setCreateFromSalePage] = useState(1);
  const [createFromSalePageSize, setCreateFromSalePageSize] = useState<25 | 50 | 100>(25);
  const [createFromSaleSaleId, setCreateFromSaleSaleId] = useState<string>("");
  const [createFromSaleSaleSnapshot, setCreateFromSaleSaleSnapshot] = useState<LinkableSale | null>(null);
  const [createFromSaleName, setCreateFromSaleName] = useState("");
  const [createFromSaleDescription, setCreateFromSaleDescription] = useState("");
  const [createFromSaleNotes, setCreateFromSaleNotes] = useState("");
  const [createFromSaleExpectedEndDate, setCreateFromSaleExpectedEndDate] = useState("");

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    setLinkSalePage(1);
  }, [linkSaleSearch, linkSalePageSize, linkSaleProject?.id]);

  useEffect(() => {
    setLinkPurchasePage(1);
  }, [linkPurchaseSearch, linkPurchasePageSize, linkPurchaseProject?.id]);

  useEffect(() => {
    setCreateFromSalePage(1);
  }, [createFromSaleSearch, createFromSalePageSize, createFromSaleOpen]);

  const projectsUrl = useMemo(() => buildProjectsQuery(search, statusFilter, page, pageSize), [page, pageSize, search, statusFilter]);
  const detailUrl = detailProjectId ? `/api/branch/commercial-projects/${detailProjectId}` : "";
  const createFromSaleSalesUrl = useMemo(
    () => buildLinkableSalesQuery(createFromSaleSearch, createFromSalePage, createFromSalePageSize),
    [createFromSalePage, createFromSalePageSize, createFromSaleSearch],
  );
  const linkableSalesUrl = useMemo(
    () => buildLinkableSalesQuery(linkSaleSearch, linkSalePage, linkSalePageSize),
    [linkSalePage, linkSalePageSize, linkSaleSearch],
  );
  const linkablePurchasesUrl = useMemo(
    () => buildLinkablePurchasesQuery(linkPurchaseSearch, linkPurchasePage, linkPurchasePageSize),
    [linkPurchasePage, linkPurchasePageSize, linkPurchaseSearch],
  );

  const { data: projectsPage, isLoading: projectsLoading, isFetching: projectsFetching } = useQuery<ProjectListResponse>({
    queryKey: [projectsUrl],
    placeholderData: (previousData) => previousData,
  });

  const { data: detailProject, isLoading: detailLoading } = useQuery<ProjectDetail>({
    queryKey: [detailUrl],
    enabled: !!detailProjectId,
  });

  const { data: branchClients = [] } = useQuery<BranchClientOption[]>({
    queryKey: BRANCH_CLIENTS_QUERY_KEY,
    enabled: projectDialogOpen,
  });

  const { data: createFromSaleSalesPage, isLoading: createFromSaleSalesLoading, isFetching: createFromSaleSalesFetching } = useQuery<LinkableSalesResponse>({
    queryKey: [createFromSaleSalesUrl],
    enabled: createFromSaleOpen,
    placeholderData: (previousData) => previousData,
  });

  const { data: linkableSalesPage, isLoading: linkableSalesLoading, isFetching: linkableSalesFetching } = useQuery<LinkableSalesResponse>({
    queryKey: [linkableSalesUrl],
    enabled: !!linkSaleProject,
    placeholderData: (previousData) => previousData,
  });

  const { data: linkablePurchasesPage, isLoading: linkablePurchasesLoading, isFetching: linkablePurchasesFetching } = useQuery<LinkablePurchasesResponse>({
    queryKey: [linkablePurchasesUrl],
    enabled: !!linkPurchaseProject,
    placeholderData: (previousData) => previousData,
  });

  const projects = projectsPage?.items ?? [];
  const projectsPagination = projectsPage?.pagination ?? { page, pageSize, total: 0, totalPages: 1 };
  const linkableSales = linkableSalesPage?.items ?? [];
  const linkableSalesPagination = linkableSalesPage?.pagination ?? { page: linkSalePage, pageSize: linkSalePageSize, total: 0, totalPages: 1 };
  const createFromSaleSales = createFromSaleSalesPage?.items ?? [];
  const createFromSalePagination = createFromSaleSalesPage?.pagination ?? { page: createFromSalePage, pageSize: createFromSalePageSize, total: 0, totalPages: 1 };
  const linkablePurchases = linkablePurchasesPage?.items ?? [];
  const linkablePurchasesPagination = linkablePurchasesPage?.pagination ?? { page: linkPurchasePage, pageSize: linkPurchasePageSize, total: 0, totalPages: 1 };

  const selectedCreateFromSale = useMemo(
    () => createFromSaleSales.find((sale) => sale.id === createFromSaleSaleId) ?? createFromSaleSaleSnapshot,
    [createFromSaleSaleId, createFromSaleSaleSnapshot, createFromSaleSales],
  );

  const saveProjectMutation = useMutation({
    mutationFn: async (payload: ProjectFormState) => {
      const body = {
        name: payload.name.trim(),
        customerUserId: payload.customerUserId === NO_CLIENT_VALUE ? null : payload.customerUserId,
        status: payload.status,
        startDate: payload.startDate,
        expectedEndDate: payload.expectedEndDate || null,
        description: payload.description.trim() || null,
        notes: payload.notes.trim() || null,
      };
      const response = editingProject
        ? await apiRequest("PATCH", `/api/branch/commercial-projects/${editingProject.id}`, body)
        : await apiRequest("POST", "/api/branch/commercial-projects", body);
      return response.json() as Promise<ProjectRow>;
    },
    onSuccess: async (project) => {
      await invalidateBranchCommercialQueries({
        clientId: project.customerUserId,
        projectId: project.id,
      });
      setProjectDialogOpen(false);
      setEditingProject(null);
      setProjectForm(createInitialProjectFormState());
      toast({
        title: editingProject ? "Proyecto actualizado" : "Proyecto creado",
        description: `${project.code} - ${project.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "No se pudo guardar el proyecto",
        description: getApiErrorMessage(error, "Revisa los datos e intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const createFromSaleMutation = useMutation({
    mutationFn: async () => {
      if (!createFromSaleSaleId) {
        throw new Error("Selecciona una venta para crear el proyecto.");
      }
      const response = await apiRequest("POST", "/api/branch/commercial-projects/from-sale", {
        saleId: createFromSaleSaleId,
        name: createFromSaleName.trim() || undefined,
        description: createFromSaleDescription.trim() || undefined,
        notes: createFromSaleNotes.trim() || undefined,
        expectedEndDate: createFromSaleExpectedEndDate || undefined,
      });
      return response.json() as Promise<ProjectDetail>;
    },
    onSuccess: async (project) => {
      await invalidateBranchCommercialQueries({
        clientId: project.customerUserId,
        projectId: project.id,
      });
      setCreateFromSaleOpen(false);
      setCreateFromSaleSaleId("");
      setCreateFromSaleSaleSnapshot(null);
      setCreateFromSaleName("");
      setCreateFromSaleDescription("");
      setCreateFromSaleNotes("");
      setCreateFromSaleExpectedEndDate("");
      setCreateFromSaleSearch("");
      setCreateFromSalePage(1);
      setDetailProjectId(project.id);
      toast({
        title: "Proyecto creado desde la venta",
        description: `${project.code} - ${project.name}`,
      });
    },
    onError: (error) => {
      toast({
        title: "No se pudo crear el proyecto",
        description: getApiErrorMessage(error, "Intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const linkSaleMutation = useMutation({
    mutationFn: async ({ projectId, saleId }: { projectId: string; saleId: string }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-projects/${projectId}/link-sale`, { saleId });
      return response.json() as Promise<ProjectDetail>;
    },
    onSuccess: async (project) => {
      await invalidateBranchCommercialQueries({
        clientId: project.customerUserId,
        projectId: project.id,
      });
      setLinkSaleProject(null);
      setLinkSaleSearch("");
      setDetailProjectId(project.id);
      toast({ title: "Venta vinculada", description: "La venta ya forma parte del proyecto." });
    },
    onError: (error) => {
      toast({
        title: "No se pudo vincular la venta",
        description: getApiErrorMessage(error, "Intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const linkPurchaseMutation = useMutation({
    mutationFn: async ({ projectId, purchaseId }: { projectId: string; purchaseId: string }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-projects/${projectId}/link-purchase`, { purchaseId });
      return response.json() as Promise<ProjectDetail>;
    },
    onSuccess: async (project) => {
      await invalidateBranchCommercialQueries({
        clientId: project.customerUserId,
        projectId: project.id,
      });
      setLinkPurchaseProject(null);
      setLinkPurchaseSearch("");
      setDetailProjectId(project.id);
      toast({ title: "Compra vinculada", description: "La compra ya forma parte del proyecto." });
    },
    onError: (error) => {
      toast({
        title: "No se pudo vincular la compra",
        description: getApiErrorMessage(error, "Intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  function openCreateProject() {
    setEditingProject(null);
    setProjectForm(createInitialProjectFormState());
    setProjectDialogOpen(true);
  }

  function openEditProject(project: ProjectRow) {
    setEditingProject(project);
    setProjectForm({
      name: project.name,
      customerUserId: project.customerUserId ?? NO_CLIENT_VALUE,
      status: project.status,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate ?? "",
      description: project.description ?? "",
      notes: project.notes ?? "",
    });
    setProjectDialogOpen(true);
  }

  return (
    <div className="space-y-4" data-testid="commercial-projects-tab">
      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BriefcaseBusiness className="h-5 w-5 text-primary" />
                Proyectos comerciales
              </CardTitle>
              <CardDescription>
                Conecta ventas y compras para leer rentabilidad sin duplicar ingresos ni gastos.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setCreateFromSaleOpen(true)}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Crear desde venta
              </Button>
              <Button onClick={openCreateProject}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo proyecto
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre, folio o descripción"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estatus</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {projectsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed border-border/80">
          <CardContent className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <BriefcaseBusiness className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aún no hay proyectos comerciales</p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Crea un proyecto vacío o genera uno desde una venta existente para empezar a leer ingresos, IVA y costos directos sin tocar Caja.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="border-border/70">
              <CardHeader className="gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{project.code}</Badge>
                      <Badge variant={getStatusBadgeVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                    </div>
                    <CardTitle className="mt-2 break-words text-lg">{project.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {project.customerDisplayName || "Sin cliente asociado"} · Inicio {formatShortDate(project.startDate)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailProjectId(project.id)}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Ver detalle
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditProject(project)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  </div>
                </div>
                {project.description ? (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ingresos con desglose fiscal</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.revenueBeforeTax)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Costos comprometidos</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.purchaseCommittedBeforeTax)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Costos recibidos</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.purchaseReceivedBeforeTax)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagos a proveedores</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.purchasePaidTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rentabilidad estimada comprometida</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.committedProfitEstimate)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-muted/20">
                    <CardContent className="p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flujo cobrado/pagado</p>
                      <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(project.summary.cashFlowNet)}</p>
                    </CardContent>
                  </Card>
                </div>

                {hasHistoricalBreakdownGaps(project.summary) ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                      <div className="space-y-2">
                        <p className="font-medium">Rentabilidad sin IVA parcialmente estimada</p>
                        <p className="text-muted-foreground">
                          Algunas operaciones antiguas no cuentan con desglose fiscal. Se muestran por separado y no se suman a las métricas estrictas sin IVA.
                        </p>
                        <div className="grid gap-2 md:grid-cols-3">
                          <p><span className="text-muted-foreground">Ingresos históricos:</span> {formatCurrencyMx(project.summary.revenueHistoricalWithoutBreakdown)}</p>
                          <p><span className="text-muted-foreground">Costos comprometidos históricos:</span> {formatCurrencyMx(project.summary.purchaseCommittedHistoricalWithoutBreakdown)}</p>
                          <p><span className="text-muted-foreground">Costos recibidos históricos:</span> {formatCurrencyMx(project.summary.purchaseReceivedHistoricalWithoutBreakdown)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ventas</p>
                    <p className="mt-1 font-semibold">{project.summary.linkedSalesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compras</p>
                    <p className="mt-1 font-semibold">{project.summary.linkedPurchasesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compras borrador</p>
                    <p className="mt-1 font-semibold">{project.summary.linkedDraftPurchasesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rentabilidad sobre recibido</p>
                    <p className="mt-1 font-semibold">
                      {formatCurrencyMx(project.summary.receivedProfitEstimate)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setLinkSaleProject(project)} disabled={!["draft", "active"].includes(project.status)}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular venta
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLinkPurchaseProject(project)} disabled={!["draft", "active"].includes(project.status)}>
                    <Truck className="mr-2 h-4 w-4" />
                    Vincular compra
                  </Button>
                </div>
                {!["draft", "active"].includes(project.status) ? (
                  <p className="text-xs text-muted-foreground">
                    Este proyecto ya no acepta nuevas ventas ni compras mientras este {getStatusLabel(project.status).toLowerCase()}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!projectsLoading ? (
        <PaginationControls
          page={projectsPagination.page}
          pageSize={projectsPagination.pageSize as 25 | 50 | 100}
          total={projectsPagination.total}
          totalPages={projectsPagination.totalPages}
          isBusy={projectsFetching}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}

      <Dialog open={projectDialogOpen} onOpenChange={(open) => {
        setProjectDialogOpen(open);
        if (!open) {
          setEditingProject(null);
          setProjectForm(createInitialProjectFormState());
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
            <DialogDescription>Esta capa solo agrupa ventas y compras para leer rentabilidad sin duplicar movimientos monetarios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Cliente relacionado</Label>
                <Select value={projectForm.customerUserId} onValueChange={(value) => setProjectForm((current) => ({ ...current, customerUserId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLIENT_VALUE}>Sin cliente</SelectItem>
                    {branchClients.map((client) => (
                      <SelectItem key={client.userId} value={client.userId}>
                        {[client.name, client.lastName].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estatus</Label>
                <Select value={projectForm.status} onValueChange={(value: ProjectStatus) => setProjectForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((current) => ({ ...current, startDate: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Fin esperado</Label>
                <Input type="date" value={projectForm.expectedEndDate} onChange={(event) => setProjectForm((current) => ({ ...current, expectedEndDate: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea value={projectForm.notes} onChange={(event) => setProjectForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveProjectMutation.mutate(projectForm)}
              disabled={saveProjectMutation.isPending || !projectForm.name.trim() || !projectForm.startDate}
            >
              {saveProjectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar proyecto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createFromSaleOpen} onOpenChange={(open) => {
        setCreateFromSaleOpen(open);
        if (!open) {
          setCreateFromSaleSaleId("");
          setCreateFromSaleSaleSnapshot(null);
          setCreateFromSaleName("");
          setCreateFromSaleDescription("");
          setCreateFromSaleNotes("");
          setCreateFromSaleExpectedEndDate("");
          setCreateFromSaleSearch("");
          setCreateFromSalePage(1);
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crear proyecto desde una venta</DialogTitle>
            <DialogDescription>La venta se vincula al proyecto y la rentabilidad se leerá desde ese mismo registro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Buscar venta</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={createFromSaleSearch} onChange={(event) => setCreateFromSaleSearch(event.target.value)} className="pl-9" placeholder="Folio o cliente" />
              </div>
            </div>
            <div className="space-y-3">
              {createFromSaleSalesLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : createFromSaleSales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  No hay ventas libres para crear proyecto.
                </div>
              ) : (
                createFromSaleSales.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    className={`w-full rounded-2xl border p-4 text-left transition ${createFromSaleSaleId === sale.id ? "border-primary bg-primary/5" : "border-border/70 bg-card"}`}
                    onClick={() => {
                      setCreateFromSaleSaleId(sale.id);
                      setCreateFromSaleSaleSnapshot(sale);
                    }}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{sale.folio}</p>
                        <p className="text-sm text-muted-foreground">{sale.clientDisplayName || "Sin cliente"} · {formatDateTime(sale.createdAt)}</p>
                      </div>
                      <p className="font-semibold">{formatCurrencyMx(sale.grandTotal ?? sale.totalAmount)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <PaginationControls
              page={createFromSalePagination.page}
              pageSize={createFromSalePagination.pageSize as 25 | 50 | 100}
              total={createFromSalePagination.total}
              totalPages={createFromSalePagination.totalPages}
              isBusy={createFromSaleSalesFetching}
              onPageChange={setCreateFromSalePage}
              onPageSizeChange={setCreateFromSalePageSize}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre del proyecto (opcional)</Label>
                <Input value={createFromSaleName} onChange={(event) => setCreateFromSaleName(event.target.value)} placeholder={selectedCreateFromSale ? `Proyecto ${selectedCreateFromSale.folio}` : ""} />
              </div>
              <div className="space-y-2">
                <Label>Fin esperado</Label>
                <Input type="date" value={createFromSaleExpectedEndDate} onChange={(event) => setCreateFromSaleExpectedEndDate(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripcion</Label>
              <Textarea value={createFromSaleDescription} onChange={(event) => setCreateFromSaleDescription(event.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Notas internas</Label>
              <Textarea value={createFromSaleNotes} onChange={(event) => setCreateFromSaleNotes(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFromSaleOpen(false)}>Cancelar</Button>
            <Button onClick={() => createFromSaleMutation.mutate()} disabled={createFromSaleMutation.isPending || !createFromSaleSaleId}>
              {createFromSaleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear proyecto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailProjectId} onOpenChange={(open) => !open && setDetailProjectId(null)}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Rentabilidad del proyecto</DialogTitle>
            <DialogDescription>Lectura separada entre rentabilidad e impacto de flujo sin tocar Caja.</DialogDescription>
          </DialogHeader>
          {detailLoading || !detailProject ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Card className="border-border/70">
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proyecto</p>
                    <p className="mt-1 font-semibold">{detailProject.code} - {detailProject.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cliente</p>
                    <p className="mt-1 font-semibold">{detailProject.customerDisplayName || "Sin cliente"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estatus</p>
                    <div className="mt-1"><Badge variant={getStatusBadgeVariant(detailProject.status)}>{getStatusLabel(detailProject.status)}</Badge></div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inicio</p>
                    <p className="mt-1 font-semibold">{formatShortDate(detailProject.startDate)}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ingresos con desglose fiscal</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.revenueBeforeTax)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">IVA cobrado</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.taxCollected)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total cobrado</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.revenueGrossTotal)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Costos comprometidos sin IVA</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.purchaseCommittedBeforeTax)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Costos recibidos sin IVA</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.purchaseReceivedBeforeTax)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pagos a proveedores</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.purchasePaidTotal)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rentabilidad estimada comprometida</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.committedProfitEstimate)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rentabilidad sobre recibido</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.receivedProfitEstimate)}</p></CardContent></Card>
                <Card className="border-border/60 bg-muted/20"><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Flujo cobrado/pagado</p><p className="mt-2 text-lg font-semibold">{formatCurrencyMx(detailProject.summary.cashFlowNet)}</p></CardContent></Card>
              </div>

              {hasHistoricalBreakdownGaps(detailProject.summary) ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div className="space-y-2">
                      <p className="font-medium">Algunas operaciones antiguas no cuentan con desglose fiscal</p>
                      <p className="text-muted-foreground">
                        La rentabilidad sin IVA puede ser aproximada. Estos importes se muestran por separado y no se consideran dentro de las métricas estrictas sin IVA.
                      </p>
                      <div className="grid gap-2 md:grid-cols-3">
                        <p><span className="text-muted-foreground">Ingresos historicos sin desglose:</span> {formatCurrencyMx(detailProject.summary.revenueHistoricalWithoutBreakdown)}</p>
                        <p><span className="text-muted-foreground">Costos comprometidos historicos:</span> {formatCurrencyMx(detailProject.summary.purchaseCommittedHistoricalWithoutBreakdown)}</p>
                        <p><span className="text-muted-foreground">Costos recibidos historicos:</span> {formatCurrencyMx(detailProject.summary.purchaseReceivedHistoricalWithoutBreakdown)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" />Ventas vinculadas</CardTitle>
                    <CardDescription>Se leen sin duplicar el ingreso que ya existe en Caja.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detailProject.sales.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aún no hay ventas vinculadas.</p>
                    ) : detailProject.sales.map((sale) => (
                      <div key={sale.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{sale.folio}</p>
                            <p className="text-sm text-muted-foreground">{sale.clientDisplayName || "Sin cliente"} · {formatDateTime(sale.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrencyMx(sale.grandTotal ?? sale.totalAmount)}</p>
                            {hasFiscalBreakdown(sale) ? (
                              <p className="text-xs text-muted-foreground">Base {formatCurrencyMx(sale.taxableSubtotal ?? sale.totalAmount)} · IVA {formatCurrencyMx(sale.taxTotal ?? 0)}</p>
                            ) : (
                              <p className="text-xs text-amber-700 dark:text-amber-300">Sin desglose fiscal histórico</p>
                            )}
                          </div>
                        </div>
                        {sale.cancelledAt ? (
                          <Badge variant="destructive" className="mt-3">Venta cancelada</Badge>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" />Compras vinculadas</CardTitle>
                    <CardDescription>Las compras borrador se muestran, pero no cuentan como costo directo activo.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detailProject.purchases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aún no hay compras vinculadas.</p>
                    ) : detailProject.purchases.map((purchase) => (
                      <div key={purchase.id} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">{purchase.folio}</p>
                            <p className="text-sm text-muted-foreground">{purchase.supplierName || "Sin proveedor"} · {formatShortDate(purchase.purchaseDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrencyMx(purchase.grandTotal ?? purchase.totalAmount)}</p>
                            {hasFiscalBreakdown(purchase) ? (
                              <p className="text-xs text-muted-foreground">Base {formatCurrencyMx(purchase.taxableSubtotal ?? purchase.totalAmount)} · IVA {formatCurrencyMx(purchase.taxTotal ?? 0)}</p>
                            ) : (
                              <p className="text-xs text-amber-700 dark:text-amber-300">Sin desglose fiscal histórico</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{purchase.status}</Badge>
                          <Badge variant="secondary">{purchase.paymentStatus}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkSaleProject} onOpenChange={(open) => {
        if (!open) {
          setLinkSaleProject(null);
          setLinkSaleSearch("");
          setLinkSalePage(1);
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vincular venta</DialogTitle>
            <DialogDescription>{linkSaleProject ? `${linkSaleProject.code} - ${linkSaleProject.name}` : "Selecciona una venta libre"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={linkSaleSearch} onChange={(event) => setLinkSaleSearch(event.target.value)} className="pl-9" placeholder="Folio o cliente" />
            </div>
            <div className="space-y-3">
              {linkableSalesLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : linkableSales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  No hay ventas disponibles para vincular.
                </div>
              ) : (
                linkableSales.map((sale) => (
                  <Card key={sale.id} className="border-border/70">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{sale.folio}</p>
                        <p className="text-sm text-muted-foreground">{sale.clientDisplayName || "Sin cliente"} · {formatDateTime(sale.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrencyMx(sale.grandTotal ?? sale.totalAmount)}</p>
                          {hasFiscalBreakdown(sale) ? (
                            <p className="text-xs text-muted-foreground">Base {formatCurrencyMx(sale.taxableSubtotal ?? sale.totalAmount)}</p>
                          ) : (
                            <p className="text-xs text-amber-700 dark:text-amber-300">Sin desglose fiscal histórico</p>
                          )}
                        </div>
                        <Button
                          onClick={() => linkSaleProject && linkSaleMutation.mutate({ projectId: linkSaleProject.id, saleId: sale.id })}
                          disabled={linkSaleMutation.isPending}
                        >
                          {linkSaleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                          Vincular
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            <PaginationControls
              page={linkableSalesPagination.page}
              pageSize={linkableSalesPagination.pageSize as 25 | 50 | 100}
              total={linkableSalesPagination.total}
              totalPages={linkableSalesPagination.totalPages}
              isBusy={linkableSalesFetching}
              onPageChange={setLinkSalePage}
              onPageSizeChange={setLinkSalePageSize}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkPurchaseProject} onOpenChange={(open) => {
        if (!open) {
          setLinkPurchaseProject(null);
          setLinkPurchaseSearch("");
          setLinkPurchasePage(1);
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vincular compra</DialogTitle>
            <DialogDescription>{linkPurchaseProject ? `${linkPurchaseProject.code} - ${linkPurchaseProject.name}` : "Selecciona una compra libre"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={linkPurchaseSearch} onChange={(event) => setLinkPurchaseSearch(event.target.value)} className="pl-9" placeholder="Folio o proveedor" />
            </div>
            <div className="space-y-3">
              {linkablePurchasesLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : linkablePurchases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  No hay compras disponibles para vincular.
                </div>
              ) : (
                linkablePurchases.map((purchase) => (
                  <Card key={purchase.id} className="border-border/70">
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{purchase.folio}</p>
                        <p className="text-sm text-muted-foreground">{purchase.supplierName || "Sin proveedor"} · {formatShortDate(purchase.purchaseDate)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrencyMx(purchase.grandTotal ?? purchase.totalAmount)}</p>
                          {hasFiscalBreakdown(purchase) ? (
                            <p className="text-xs text-muted-foreground">Base {formatCurrencyMx(purchase.taxableSubtotal ?? purchase.totalAmount)}</p>
                          ) : (
                            <p className="text-xs text-amber-700 dark:text-amber-300">Sin desglose fiscal histórico</p>
                          )}
                        </div>
                        <Button
                          onClick={() => linkPurchaseProject && linkPurchaseMutation.mutate({ projectId: linkPurchaseProject.id, purchaseId: purchase.id })}
                          disabled={linkPurchaseMutation.isPending}
                        >
                          {linkPurchaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                          Vincular
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            <PaginationControls
              page={linkablePurchasesPagination.page}
              pageSize={linkablePurchasesPagination.pageSize as 25 | 50 | 100}
              total={linkablePurchasesPagination.total}
              totalPages={linkablePurchasesPagination.totalPages}
              isBusy={linkablePurchasesFetching}
              onPageChange={setLinkPurchasePage}
              onPageSizeChange={setLinkPurchasePageSize}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
