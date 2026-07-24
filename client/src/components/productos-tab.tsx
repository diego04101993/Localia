import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  MoreHorizontal,
  Package2,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchCommercialQueries, invalidateBranchFinanceQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { useHorizontalScrollNav } from "@/hooks/use-horizontal-scroll-nav";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type CommercialProduct = {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description: string | null;
  photoUrl: string | null;
  sku: string | null;
  barcode: string | null;
  costAmount: number;
  salePriceAmount: number;
  isActive: boolean;
  isPublicVisible: boolean;
  usesInventory: boolean;
  displayOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryQuantityOnHand?: number | null;
  inventoryMinimumStock?: number | null;
  inventoryStatus?: InventoryStatus | null;
  inventoryUpdatedAt?: string | null;
};

type CommercialProductPageResponse = {
  items: CommercialProduct[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    categories: string[];
  };
  summary: {
    total: number;
    active: number;
    publicVisible: number;
    inventoryReady: number;
  };
};

type InventoryStatus = "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock";

type InventoryBalance = {
  id: string;
  branchId: string;
  commercialProductId: string;
  quantityOnHand: number;
  minimumStock: number;
  status: InventoryStatus;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type InventoryMovement = {
  id: string;
  branchId: string;
  commercialProductId: string;
  movementType: "initial" | "manual_entry" | "positive_adjustment" | "negative_adjustment" | "purchase" | "sale" | "sale_cancellation" | "return" | "waste" | "damaged";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCostSnapshot: number | null;
  reason: string;
  notes: string | null;
  saleId: string | null;
  saleItemId: string | null;
  createdBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type InventorySummary = {
  productId: string;
  usesInventory: boolean;
  balance: InventoryBalance | null;
  status: InventoryStatus;
  movementCount: number;
  recentMovements: InventoryMovement[];
};

type ProductFormState = {
  name: string;
  category: string;
  description: string;
  photoUrl: string;
  sku: string;
  barcode: string;
  costAmount: string;
  salePriceAmount: string;
  isActive: boolean;
  isPublicVisible: boolean;
  usesInventory: boolean;
  displayOrder: string;
};

type BranchClientOption = {
  userId: string;
  membershipId: string;
  membershipStatus: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
};

type BranchSalespersonOption = {
  id: string;
  name: string;
  lastName: string | null;
  employeeCode: string | null;
  roleLabel: string | null;
  isActive: boolean;
};

type CommercialProjectOption = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type SaleFormState = {
  quantity: string;
  clientUserId: string;
  sellerId: string;
  projectId: string;
  paymentMethod: "efectivo" | "tarjeta" | "transferencia" | "mercado_pago" | "otro";
  discountAmount: string;
  taxMode: "tax_included" | "tax_added" | "tax_exempt";
  taxRate: string;
  notes: string;
  paymentReference: string;
};

type BranchSaleResponse = {
  id: string;
  folio: string;
  totalAmount: number;
  clientUserId: string | null;
};

type InventoryAction = "initial" | "entry" | "adjust" | "waste" | "movements" | null;

type InventoryInitialFormState = {
  quantity: string;
  minimumStock: string;
  unitCost: string;
  notes: string;
};

type InventoryEntryFormState = {
  quantity: string;
  minimumStock: string;
  unitCost: string;
  reason: string;
  notes: string;
};

type InventoryAdjustFormState = {
  mode: "set" | "delta";
  newQuantity: string;
  quantityDelta: string;
  minimumStock: string;
  unitCost: string;
  reason: string;
  notes: string;
};

type InventoryWasteFormState = {
  quantity: string;
  movementType: "waste" | "damaged";
  reason: string;
  notes: string;
};

type ProductFocusRequest = {
  productId: string;
  action: "performance" | "inventory";
  nonce: number;
};

type ProductPerformanceRangePreset = "current_month" | "previous_month" | "ninety_days";

type ProductPerformanceRow = {
  productId: string;
  productName: string;
  category: string;
  from: string | null;
  to: string | null;
  salesCount: number;
  unitsSold: number;
  revenueAmount: number;
  costAmountSold: number;
  grossProfitAmount: number;
  grossMarginPercent: number | null;
  lastSaleAt: string | null;
  quantityOnHand: number | null;
  minimumStock: number | null;
  inventoryStatus: InventoryStatus;
  recentSales: Array<{
    saleId: string;
    folio: string;
    saleDate: string;
    clientUserId: string | null;
    clientDisplayName: string | null;
    sellerName: string | null;
    quantitySold: number;
    revenueAmount: number;
    grossProfitAmount: number;
    paymentMethods: string[];
  }>;
};

type StatusFilter = "all" | "active" | "inactive";
type PublicFilter = "all" | "public" | "private";
type InventoryFilter = "all" | "inventory" | "no_inventory";
type SortOption = "updated_desc" | "name_asc" | "price_desc" | "price_asc" | "category_asc";

const BRANCH_CLIENTS_QUERY_KEY = ["/api/branch/clients?include_left=true"];
const BRANCH_SALESPEOPLE_QUERY_KEY = ["/api/branch/salespeople?status=active"];
const COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY = ["/api/branch/commercial-projects/options"];
const WALK_IN_CLIENT_VALUE = "walk-in";
const NO_SALESPERSON_VALUE = "none";
const NO_PROJECT_VALUE = "none";
const INVENTORY_MOVEMENT_LIMIT = 50;

const inventorySummaryQueryKey = (productId: string) => [`/api/branch/commercial-products/${productId}/inventory`];
const inventoryMovementsQueryKey = (productId: string) => [
  `/api/branch/commercial-products/${productId}/inventory/movements?limit=${INVENTORY_MOVEMENT_LIMIT}`,
];
const performanceQueryKey = (productId: string, from: string, to: string) => [`/api/branch/commercial-products/${productId}/performance?from=${from}&to=${to}`];

const PAYMENT_METHOD_OPTIONS: Array<{ value: SaleFormState["paymentMethod"]; label: string }> = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "otro", label: "Otro" },
];

function createInitialFormState(): ProductFormState {
  return {
    name: "",
    category: "",
    description: "",
    photoUrl: "",
    sku: "",
    barcode: "",
    costAmount: "",
    salePriceAmount: "",
    isActive: true,
    isPublicVisible: false,
    usesInventory: false,
    displayOrder: "",
  };
}

function getTodayDateString() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function getPerformanceRange(preset: ProductPerformanceRangePreset) {
  const today = new Date(`${getTodayDateString()}T12:00:00`);
  if (preset === "previous_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      from: start.toLocaleDateString("en-CA"),
      to: end.toLocaleDateString("en-CA"),
    };
  }

  if (preset === "ninety_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 89);
    return {
      from: start.toLocaleDateString("en-CA"),
      to: today.toLocaleDateString("en-CA"),
    };
  }

  return {
    from: `${getTodayDateString().slice(0, 7)}-01`,
    to: getTodayDateString(),
  };
}

function createInitialSaleFormState(): SaleFormState {
  return {
    quantity: "1",
    clientUserId: WALK_IN_CLIENT_VALUE,
    sellerId: NO_SALESPERSON_VALUE,
    projectId: NO_PROJECT_VALUE,
    paymentMethod: "efectivo",
    discountAmount: "0",
    taxMode: "tax_exempt",
    taxRate: "16",
    notes: "",
    paymentReference: "",
  };
}

function createInitialInventoryInitialFormState(): InventoryInitialFormState {
  return {
    quantity: "",
    minimumStock: "0",
    unitCost: "",
    notes: "",
  };
}

function createInitialInventoryEntryFormState(): InventoryEntryFormState {
  return {
    quantity: "",
    minimumStock: "",
    unitCost: "",
    reason: "",
    notes: "",
  };
}

function createInitialInventoryAdjustFormState(): InventoryAdjustFormState {
  return {
    mode: "set",
    newQuantity: "",
    quantityDelta: "",
    minimumStock: "",
    unitCost: "",
    reason: "",
    notes: "",
  };
}

function createInitialInventoryWasteFormState(): InventoryWasteFormState {
  return {
    quantity: "",
    movementType: "waste",
    reason: "",
    notes: "",
  };
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/branch/commercial-products/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Error al subir la fotografía");
  }

  const data = await response.json();
  return data.url;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentMethodLabel(value: string) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label || value;
}

function formatQuantity(value: number | null | undefined) {
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function computeSaleTaxPreview(params: {
  subtotalAmount: number;
  discountAmount: number;
  taxMode: "tax_included" | "tax_added" | "tax_exempt";
  taxRate: number;
}) {
  const subtotalAmount = Number(Math.max(0, params.subtotalAmount || 0).toFixed(2));
  const discountAmount = Number(Math.max(0, params.discountAmount || 0).toFixed(2));
  const discountedSubtotal = Number(Math.max(0, subtotalAmount - discountAmount).toFixed(2));
  const taxRate = params.taxMode === "tax_exempt" ? 0 : Number(Math.max(0, params.taxRate || 0).toFixed(2));
  const taxFactor = taxRate > 0 ? taxRate / 100 : 0;

  if (params.taxMode === "tax_included" && taxFactor > 0) {
    const subtotalBeforeTax = Number((subtotalAmount / (1 + taxFactor)).toFixed(2));
    const taxableSubtotal = Number((discountedSubtotal / (1 + taxFactor)).toFixed(2));
    const taxTotal = Number((discountedSubtotal - taxableSubtotal).toFixed(2));
    return {
      subtotalBeforeTax,
      taxableSubtotal,
      taxTotal,
      grandTotal: discountedSubtotal,
      appliedTaxRate: taxRate,
    };
  }

  if (params.taxMode === "tax_added" && taxFactor > 0) {
    const taxableSubtotal = discountedSubtotal;
    const taxTotal = Number((taxableSubtotal * taxFactor).toFixed(2));
    return {
      subtotalBeforeTax: subtotalAmount,
      taxableSubtotal,
      taxTotal,
      grandTotal: Number((taxableSubtotal + taxTotal).toFixed(2)),
      appliedTaxRate: taxRate,
    };
  }

  return {
    subtotalBeforeTax: subtotalAmount,
    taxableSubtotal: discountedSubtotal,
    taxTotal: 0,
    grandTotal: discountedSubtotal,
    appliedTaxRate: 0,
  };
}

function ProductStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
      {isActive ? "Activo" : "Inactivo"}
    </Badge>
  );
}

function ProductVisibilityBadge({ isPublicVisible }: { isPublicVisible: boolean }) {
  return (
    <Badge variant="outline" className="gap-1">
      {isPublicVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {isPublicVisible ? "Bandera futura" : "Interno"}
    </Badge>
  );
}

function ProductInventoryBadge({ usesInventory }: { usesInventory: boolean }) {
  return (
    <Badge variant="outline" className="gap-1">
      {usesInventory ? <Warehouse className="h-3 w-3" /> : <Store className="h-3 w-3" />}
      {usesInventory ? "Controla existencias" : "Sin control de existencias"}
    </Badge>
  );
}

function getInventoryStatusMeta(status: InventoryStatus) {
  switch (status) {
    case "available":
      return {
        label: "Disponible",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
      };
    case "low_stock":
      return {
        label: "Poco inventario",
        className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
      };
    case "out_of_stock":
      return {
        label: "Agotado",
        className: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-200",
      };
    case "uninitialized":
      return {
        label: "Sin inventario inicial",
        className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
      };
    case "not_tracked":
    default:
      return {
        label: "Sin seguimiento",
        className: "border-border bg-muted text-muted-foreground",
      };
  }
}

function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  const meta = getInventoryStatusMeta(status);
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

function getInventoryMovementLabel(movementType: InventoryMovement["movementType"]) {
  switch (movementType) {
    case "initial":
      return "Inventario inicial";
    case "manual_entry":
      return "Entrada manual";
    case "positive_adjustment":
      return "Ajuste positivo";
    case "negative_adjustment":
      return "Ajuste negativo";
    case "purchase":
      return "Compra recibida";
    case "sale":
      return "Venta";
    case "sale_cancellation":
      return "Cancelacion de venta";
    case "return":
      return "Devolución";
    case "waste":
      return "Merma";
    case "damaged":
      return "Dañado";
    default:
      return movementType;
  }
}

export default function ProductosTab({ focusRequest }: { focusRequest?: ProductFocusRequest | null } = {}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [publicFilter, setPublicFilter] = useState<PublicFilter>("all");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CommercialProduct | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleProduct, setSaleProduct] = useState<CommercialProduct | null>(null);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventoryProduct, setInventoryProduct] = useState<CommercialProduct | null>(null);
  const [inventoryAction, setInventoryAction] = useState<InventoryAction>(null);
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [performanceProduct, setPerformanceProduct] = useState<CommercialProduct | null>(null);
  const [performancePreset, setPerformancePreset] = useState<ProductPerformanceRangePreset>("current_month");
  const [deleteTarget, setDeleteTarget] = useState<CommercialProduct | null>(null);
  const [form, setForm] = useState<ProductFormState>(createInitialFormState());
  const [saleForm, setSaleForm] = useState<SaleFormState>(createInitialSaleFormState());
  const [inventoryInitialForm, setInventoryInitialForm] = useState<InventoryInitialFormState>(createInitialInventoryInitialFormState());
  const [inventoryEntryForm, setInventoryEntryForm] = useState<InventoryEntryFormState>(createInitialInventoryEntryFormState());
  const [inventoryAdjustForm, setInventoryAdjustForm] = useState<InventoryAdjustFormState>(createInitialInventoryAdjustFormState());
  const [inventoryWasteForm, setInventoryWasteForm] = useState<InventoryWasteFormState>(createInitialInventoryWasteFormState());
  const [saleSellerSearch, setSaleSellerSearch] = useState("");
  const [saleRequestId, setSaleRequestId] = useState(() => crypto.randomUUID());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const productsTableScroll = useHorizontalScrollNav();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, publicFilter, inventoryFilter, categoryFilter, sortBy, pageSize]);

  const { data: productsPage, isLoading, isFetching } = useQuery<CommercialProductPageResponse>({
    queryKey: [
      "/api/branch/commercial-products/page",
      page,
      pageSize,
      debouncedSearch,
      statusFilter,
      publicFilter,
      inventoryFilter,
      categoryFilter,
      sortBy,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter,
        category: categoryFilter,
        inventoryMode: inventoryFilter,
        publicMode: publicFilter,
        sort: sortBy,
      });
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const response = await fetch(`/api/branch/commercial-products/page?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo cargar el catalogo de productos");
      }
      return response.json() as Promise<CommercialProductPageResponse>;
    },
    placeholderData: (previousData) => previousData,
  });
  const products = productsPage?.items ?? [];
  const totalProducts = productsPage?.pagination.total ?? 0;
  const totalPages = productsPage?.pagination.totalPages ?? 1;

  const { data: branchClients = [], isLoading: isLoadingBranchClients } = useQuery<BranchClientOption[]>({
    queryKey: BRANCH_CLIENTS_QUERY_KEY,
    enabled: saleDialogOpen,
  });

  const { data: branchSalespeople = [], isLoading: isLoadingBranchSalespeople } = useQuery<BranchSalespersonOption[]>({
    queryKey: BRANCH_SALESPEOPLE_QUERY_KEY,
    enabled: saleDialogOpen,
  });

  const { data: commercialProjectOptions = [] } = useQuery<CommercialProjectOption[]>({
    queryKey: COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY,
    enabled: saleDialogOpen,
  });

  const inventorySummaryKey = inventoryProduct ? inventorySummaryQueryKey(inventoryProduct.id) : ["/api/branch/commercial-products/inventory/idle"];
  const inventoryMovementsKey = inventoryProduct ? inventoryMovementsQueryKey(inventoryProduct.id) : ["/api/branch/commercial-products/inventory/movements/idle"];
  const performanceRange = getPerformanceRange(performancePreset);
  const performanceKey = performanceProduct
    ? performanceQueryKey(performanceProduct.id, performanceRange.from, performanceRange.to)
    : ["/api/branch/commercial-products/performance/idle"];

  const {
    data: inventorySummary,
    isLoading: isLoadingInventorySummary,
    isFetching: isFetchingInventorySummary,
  } = useQuery<InventorySummary>({
    queryKey: inventorySummaryKey,
    enabled: inventoryDialogOpen && !!inventoryProduct,
  });

  const {
    data: inventoryMovements = [],
    isLoading: isLoadingInventoryMovements,
    isFetching: isFetchingInventoryMovements,
  } = useQuery<InventoryMovement[]>({
    queryKey: inventoryMovementsKey,
    enabled: inventoryDialogOpen && !!inventoryProduct,
  });

  const {
    data: performance,
    isLoading: isLoadingPerformance,
  } = useQuery<ProductPerformanceRow>({
    queryKey: performanceKey,
    enabled: performanceDialogOpen && !!performanceProduct,
  });

  useEffect(() => {
    if (!focusRequest?.productId || !products.length) return;
    const target = products.find((product) => product.id === focusRequest.productId);
    if (!target) return;

    if (focusRequest.action === "inventory") {
      openInventoryDialog(target);
      return;
    }

    openPerformanceDialog(target);
  }, [focusRequest, products]);

  const categories = useMemo(() => {
    return productsPage?.filterOptions.categories ?? [];
  }, [productsPage]);

  const stats = useMemo(() => {
    if (productsPage?.summary) {
      return productsPage.summary;
    }
    return {
      total: products.length,
      active: products.filter((product) => product.isActive).length,
      publicVisible: products.filter((product) => product.isPublicVisible).length,
      inventoryReady: products.filter((product) => product.usesInventory).length,
    };
  }, [products, productsPage]);

  const invalidateProducts = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string"
        && (query.queryKey[0] as string).startsWith("/api/branch/commercial-products"),
    });
  };

  const invalidateInventory = async (productId: string) => {
    await Promise.all([
      invalidateProducts(),
      queryClient.invalidateQueries({ queryKey: inventorySummaryQueryKey(productId) }),
      queryClient.invalidateQueries({ queryKey: inventoryMovementsQueryKey(productId) }),
      invalidateBranchCommercialQueries({ productId }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiRequest("POST", "/api/branch/commercial-products", payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateProducts();
      closeDialog();
      toast({ title: "Producto creado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo crear el producto"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/branch/commercial-products/${id}`, payload);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateProducts();
      closeDialog();
      toast({ title: "Producto actualizado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo actualizar el producto"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/branch/commercial-products/${productId}`);
    },
    onSuccess: async () => {
      await invalidateProducts();
      setDeleteTarget(null);
      toast({ title: "Producto archivado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo eliminar el producto"),
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/branch/commercial-products/${productId}`, { isActive });
      return response.json();
    },
    onSuccess: async (_, variables) => {
      await invalidateProducts();
      toast({ title: variables.isActive ? "Producto activado" : "Producto inactivado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo actualizar el estado del producto"),
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: CommercialProduct) => {
      const response = await apiRequest("POST", "/api/branch/commercial-products", {
        name: `${product.name} copia`,
        category: product.category,
        description: product.description || undefined,
        photoUrl: product.photoUrl || undefined,
        costAmount: product.costAmount,
        salePriceAmount: product.salePriceAmount,
        isActive: product.isActive,
        isPublicVisible: product.isPublicVisible,
        usesInventory: product.usesInventory,
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateProducts();
      toast({ title: "Producto duplicado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo duplicar el producto"),
        variant: "destructive",
      });
    },
  });

  const saleMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-products/${productId}/sale`, payload);
      return response.json() as Promise<BranchSaleResponse>;
    },
    onSuccess: async (sale, variables) => {
      await Promise.all([
        invalidateInventory(variables.productId),
        invalidateBranchFinanceQueries(),
        invalidateBranchCommercialQueries({
          productId: variables.productId,
          saleId: sale.id,
          clientId: sale.clientUserId,
          projectId: saleForm.projectId === NO_PROJECT_VALUE ? null : saleForm.projectId,
          salespersonId: saleForm.sellerId === NO_SALESPERSON_VALUE ? null : saleForm.sellerId,
        }),
      ]);
      closeSaleDialog();
      setSaleRequestId(crypto.randomUUID());
      toast({
        title: "Venta registrada",
        description: `${sale.folio} · ${formatCurrency(sale.totalAmount)}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo registrar la venta"),
        variant: "destructive",
      });
    },
  });

  const inventoryInitialMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-products/${productId}/inventory/initial`, payload);
      return response.json() as Promise<InventorySummary>;
    },
    onSuccess: async (_, variables) => {
      await invalidateInventory(variables.productId);
      setInventoryAction("movements");
      setInventoryInitialForm(createInitialInventoryInitialFormState());
      toast({ title: "Inventario inicial configurado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo configurar el inventario inicial"),
        variant: "destructive",
      });
    },
  });

  const inventoryEntryMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-products/${productId}/inventory/entry`, payload);
      return response.json() as Promise<InventorySummary>;
    },
    onSuccess: async (_, variables) => {
      await invalidateInventory(variables.productId);
      setInventoryAction("movements");
      setInventoryEntryForm(createInitialInventoryEntryFormState());
      toast({ title: "Entrada registrada" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo registrar la entrada de inventario"),
        variant: "destructive",
      });
    },
  });

  const inventoryAdjustMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-products/${productId}/inventory/adjust`, payload);
      return response.json() as Promise<InventorySummary>;
    },
    onSuccess: async (_, variables) => {
      await invalidateInventory(variables.productId);
      setInventoryAction("movements");
      setInventoryAdjustForm(createInitialInventoryAdjustFormState());
      toast({ title: "Inventario ajustado" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo ajustar el inventario"),
        variant: "destructive",
      });
    },
  });

  const inventoryWasteMutation = useMutation({
    mutationFn: async ({ productId, payload }: { productId: string; payload: Record<string, unknown> }) => {
      const response = await apiRequest("POST", `/api/branch/commercial-products/${productId}/inventory/waste`, payload);
      return response.json() as Promise<InventorySummary>;
    },
    onSuccess: async (_, variables) => {
      await invalidateInventory(variables.productId);
      setInventoryAction("movements");
      setInventoryWasteForm(createInitialInventoryWasteFormState());
      toast({ title: "Salida registrada" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo registrar la salida de inventario"),
        variant: "destructive",
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isSubmittingSale = saleMutation.isPending;
  const isSubmittingInventory =
    inventoryInitialMutation.isPending ||
    inventoryEntryMutation.isPending ||
    inventoryAdjustMutation.isPending ||
    inventoryWasteMutation.isPending;

  function setField<K extends keyof ProductFormState>(field: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setSaleField<K extends keyof SaleFormState>(field: K, value: SaleFormState[K]) {
    setSaleForm((current) => ({ ...current, [field]: value }));
  }

  function setInventoryInitialField<K extends keyof InventoryInitialFormState>(field: K, value: InventoryInitialFormState[K]) {
    setInventoryInitialForm((current) => ({ ...current, [field]: value }));
  }

  function setInventoryEntryField<K extends keyof InventoryEntryFormState>(field: K, value: InventoryEntryFormState[K]) {
    setInventoryEntryForm((current) => ({ ...current, [field]: value }));
  }

  function setInventoryAdjustField<K extends keyof InventoryAdjustFormState>(field: K, value: InventoryAdjustFormState[K]) {
    setInventoryAdjustForm((current) => ({ ...current, [field]: value }));
  }

  function setInventoryWasteField<K extends keyof InventoryWasteFormState>(field: K, value: InventoryWasteFormState[K]) {
    setInventoryWasteForm((current) => ({ ...current, [field]: value }));
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingProduct(null);
    setForm(createInitialFormState());
    setUploadingPhoto(false);
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setForm(createInitialFormState());
    setDialogOpen(true);
  }

  function openEditDialog(product: CommercialProduct) {
    setEditingProduct(product);
    setForm({
      name: product.name,
      category: product.category,
      description: product.description || "",
      photoUrl: product.photoUrl || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      costAmount: product.costAmount ? product.costAmount.toFixed(2) : "",
      salePriceAmount: product.salePriceAmount ? product.salePriceAmount.toFixed(2) : "",
      isActive: product.isActive,
      isPublicVisible: product.isPublicVisible,
      usesInventory: product.usesInventory,
      displayOrder: String(product.displayOrder ?? ""),
    });
    setDialogOpen(true);
  }

  function closeSaleDialog() {
    setSaleDialogOpen(false);
    setSaleProduct(null);
    setSaleForm(createInitialSaleFormState());
    setSaleSellerSearch("");
    setSaleRequestId(crypto.randomUUID());
  }

  function openSaleDialog(product: CommercialProduct) {
    setSaleProduct(product);
    setSaleForm(createInitialSaleFormState());
    setSaleSellerSearch("");
    setSaleRequestId(crypto.randomUUID());
    setSaleDialogOpen(true);
  }

  function closeInventoryDialog() {
    setInventoryDialogOpen(false);
    setInventoryProduct(null);
    setInventoryAction(null);
    setInventoryInitialForm(createInitialInventoryInitialFormState());
    setInventoryEntryForm(createInitialInventoryEntryFormState());
    setInventoryAdjustForm(createInitialInventoryAdjustFormState());
    setInventoryWasteForm(createInitialInventoryWasteFormState());
  }

  function closePerformanceDialog() {
    setPerformanceDialogOpen(false);
    setPerformanceProduct(null);
    setPerformancePreset("current_month");
  }

  function openInventoryDialog(product: CommercialProduct, action: InventoryAction = null) {
    setInventoryProduct(product);
    setInventoryAction(action ?? (product.inventoryStatus === "uninitialized" ? "initial" : "movements"));
    setInventoryInitialForm({
      ...createInitialInventoryInitialFormState(),
      unitCost: product.costAmount > 0 ? product.costAmount.toFixed(2) : "",
    });
    setInventoryEntryForm(createInitialInventoryEntryFormState());
    setInventoryAdjustForm(createInitialInventoryAdjustFormState());
    setInventoryWasteForm(createInitialInventoryWasteFormState());
    setInventoryDialogOpen(true);
  }

  function openPerformanceDialog(product: CommercialProduct) {
    setPerformanceProduct(product);
    setPerformancePreset("current_month");
    setPerformanceDialogOpen(true);
  }

  async function handlePhotoUpload(file: File) {
    setUploadingPhoto(true);
    try {
      const url = await uploadFile(file);
      setField("photoUrl", url);
      toast({ title: "Fotografía subida" });
    } catch (error) {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo subir la fotografía"),
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  function buildPayload() {
    const parseAmount = (value: string) => {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const parseInteger = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim() || undefined,
      photoUrl: form.photoUrl.trim() || undefined,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      costAmount: parseAmount(form.costAmount),
      salePriceAmount: parseAmount(form.salePriceAmount),
      isActive: form.isActive,
      isPublicVisible: form.isPublicVisible,
      usesInventory: form.usesInventory,
      displayOrder: parseInteger(form.displayOrder),
    };
  }

  function handleSubmit() {
    const payload = buildPayload();
    if (!payload.name || !payload.category) {
      toast({
        title: "Completa los campos obligatorios",
        description: "Nombre y categoría son necesarios para guardar el producto.",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, payload });
      return;
    }

    createMutation.mutate(payload);
  }

  const saleSummary = useMemo(() => {
    const quantity = Math.max(1, Number.parseInt(saleForm.quantity, 10) || 1);
    const unitPrice = saleProduct?.salePriceAmount ?? 0;
    const subtotal = Number((quantity * unitPrice).toFixed(2));
    const discount = Math.max(0, Number.parseFloat(saleForm.discountAmount) || 0);
    const taxRate = Math.max(0, Number.parseFloat(saleForm.taxRate) || 0);
    const taxPreview = computeSaleTaxPreview({
      subtotalAmount: subtotal,
      discountAmount: discount,
      taxMode: saleForm.taxMode,
      taxRate,
    });
    return {
      quantity,
      unitPrice,
      subtotal,
      discount,
      taxRate,
      ...taxPreview,
      total: taxPreview.grandTotal,
    };
  }, [saleForm.discountAmount, saleForm.quantity, saleForm.taxMode, saleForm.taxRate, saleProduct]);

  const selectedSaleClient = useMemo(() => {
    if (!saleForm.clientUserId || saleForm.clientUserId === WALK_IN_CLIENT_VALUE) return null;
    return branchClients.find((client) => client.userId === saleForm.clientUserId) ?? null;
  }, [branchClients, saleForm.clientUserId]);

  const filteredSalespeople = useMemo(() => {
    const term = normalizeSearchText(saleSellerSearch);
    if (!term) return branchSalespeople;
    return branchSalespeople.filter((person) =>
      normalizeSearchText([person.name, person.lastName || "", person.employeeCode || "", person.roleLabel || ""].join(" ")).includes(term),
    );
  }, [branchSalespeople, saleSellerSearch]);

  const selectedSalesperson = useMemo(() => {
    if (!saleForm.sellerId || saleForm.sellerId === NO_SALESPERSON_VALUE) return null;
    return branchSalespeople.find((person) => person.id === saleForm.sellerId) ?? null;
  }, [branchSalespeople, saleForm.sellerId]);

  const saleAutomationLines = useMemo(() => {
    const lines = saleProduct?.usesInventory
      ? ["Al confirmar, se registrará la venta, se descontarán las existencias y se creará el ingreso correspondiente en Caja."]
      : ["Al confirmar, se registrará la venta y se creará el ingreso correspondiente en Caja."];

    if (selectedSalesperson) {
      lines.push("Si existen reglas activas para este vendedor, también se calculará la comisión correspondiente.");
    }

    return lines;
  }, [saleProduct?.usesInventory, selectedSalesperson]);

  function handleSubmitSale() {
    if (!saleProduct) return;
    if (!saleProduct.isActive) {
      toast({
        title: "Producto inactivo",
        description: "Activa el producto antes de registrarlo en una venta.",
        variant: "destructive",
      });
      return;
    }

    if (saleSummary.discount > saleSummary.subtotal) {
      toast({
        title: "Descuento inválido",
        description: "El descuento no puede ser mayor al subtotal.",
        variant: "destructive",
      });
      return;
    }

    saleMutation.mutate({
      productId: saleProduct.id,
      payload: {
        quantity: saleSummary.quantity,
        clientUserId: saleForm.clientUserId === WALK_IN_CLIENT_VALUE ? null : saleForm.clientUserId,
        sellerId: saleForm.sellerId === NO_SALESPERSON_VALUE ? null : saleForm.sellerId,
        projectId: saleForm.projectId === NO_PROJECT_VALUE ? null : saleForm.projectId,
        paymentMethod: saleForm.paymentMethod,
        idempotencyKey: saleRequestId,
        discountAmount: saleSummary.discount,
        taxMode: saleForm.taxMode,
        taxRate: saleSummary.taxRate,
        notes: saleForm.notes.trim() || undefined,
        paymentReference: saleForm.paymentReference.trim() || undefined,
      },
    });
  }

  function getProductInventoryStatus(product: CommercialProduct): InventoryStatus {
    if (!product.usesInventory) return "not_tracked";
    return product.inventoryStatus ?? "uninitialized";
  }

  function getProductInventoryQuantity(product: CommercialProduct) {
    return product.inventoryQuantityOnHand ?? 0;
  }

  function getProductInventoryMinimum(product: CommercialProduct) {
    return product.inventoryMinimumStock ?? 0;
  }

  function parsePositiveInteger(value: string) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function parseOptionalInteger(value: string) {
    if (!value.trim()) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function parseOptionalAmount(value: string) {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function handleSubmitInventoryInitial() {
    if (!inventoryProduct) return;

    const quantity = parsePositiveInteger(inventoryInitialForm.quantity);
    const minimumStock = parseOptionalInteger(inventoryInitialForm.minimumStock) ?? 0;
    if (quantity == null) {
      toast({
        title: "Cantidad invalida",
        description: "Ingresa una cantidad inicial mayor a cero.",
        variant: "destructive",
      });
      return;
    }

    inventoryInitialMutation.mutate({
      productId: inventoryProduct.id,
      payload: {
        quantity,
        minimumStock: Math.max(0, minimumStock),
        unitCost: parseOptionalAmount(inventoryInitialForm.unitCost),
        notes: inventoryInitialForm.notes.trim() || undefined,
      },
    });
  }

  function handleSubmitInventoryEntry() {
    if (!inventoryProduct) return;

    const quantity = parsePositiveInteger(inventoryEntryForm.quantity);
    if (quantity == null || !inventoryEntryForm.reason.trim()) {
      toast({
        title: "Completa la entrada",
        description: "Cantidad y razon son obligatorias para registrar una entrada.",
        variant: "destructive",
      });
      return;
    }

    inventoryEntryMutation.mutate({
      productId: inventoryProduct.id,
      payload: {
        quantity,
        minimumStock: parseOptionalInteger(inventoryEntryForm.minimumStock),
        unitCost: parseOptionalAmount(inventoryEntryForm.unitCost),
        reason: inventoryEntryForm.reason.trim(),
        notes: inventoryEntryForm.notes.trim() || undefined,
      },
    });
  }

  function handleSubmitInventoryAdjust() {
    if (!inventoryProduct) return;

    const payload: Record<string, unknown> = {
      minimumStock: parseOptionalInteger(inventoryAdjustForm.minimumStock),
      unitCost: parseOptionalAmount(inventoryAdjustForm.unitCost),
      reason: inventoryAdjustForm.reason.trim(),
      notes: inventoryAdjustForm.notes.trim() || undefined,
    };

    if (!inventoryAdjustForm.reason.trim()) {
      toast({
        title: "Motivo requerido",
        description: "Indica el motivo del ajuste antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    if (inventoryAdjustForm.mode === "set") {
      const newQuantity = parseOptionalInteger(inventoryAdjustForm.newQuantity);
      if (newQuantity == null || newQuantity < 0) {
        toast({
          title: "Cantidad invalida",
          description: "Ingresa la nueva existencia con un numero cero o mayor.",
          variant: "destructive",
        });
        return;
      }
      payload.newQuantity = newQuantity;
    } else {
      const quantityDelta = parseOptionalInteger(inventoryAdjustForm.quantityDelta);
      if (quantityDelta == null || quantityDelta === 0) {
        toast({
          title: "Ajuste invalido",
          description: "Ingresa una diferencia positiva o negativa distinta de cero.",
          variant: "destructive",
        });
        return;
      }
      payload.quantityDelta = quantityDelta;
    }

    inventoryAdjustMutation.mutate({
      productId: inventoryProduct.id,
      payload,
    });
  }

  function handleSubmitInventoryWaste() {
    if (!inventoryProduct) return;

    const quantity = parsePositiveInteger(inventoryWasteForm.quantity);
    if (quantity == null || !inventoryWasteForm.reason.trim()) {
      toast({
        title: "Completa la salida",
        description: "Cantidad y motivo son obligatorios para registrar la salida.",
        variant: "destructive",
      });
      return;
    }

    inventoryWasteMutation.mutate({
      productId: inventoryProduct.id,
      payload: {
        quantity,
        movementType: inventoryWasteForm.movementType,
        reason: inventoryWasteForm.reason.trim(),
        notes: inventoryWasteForm.notes.trim() || undefined,
      },
    });
  }

  const inventoryHasBalance = !!inventorySummary?.balance;
  const inventoryStatus = inventorySummary?.status ?? (inventoryProduct ? getProductInventoryStatus(inventoryProduct) : "not_tracked");
  const inventoryBalance = inventorySummary?.balance ?? null;
  const displayedInventoryMovements = inventoryMovements.length ? inventoryMovements : inventorySummary?.recentMovements ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="commercial-products-loading">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="commercial-products-tab">
      <Card className="rounded-[28px] border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package2 className="h-5 w-5 text-primary" />
              Productos
            </CardTitle>
            <CardDescription>
              Administra tu catálogo comercial sin afectar el contenido público actual ni los módulos existentes.
            </CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={openCreateDialog} data-testid="button-create-commercial-product">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Totales</p>
            <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Productos registrados</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Activos</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-100">{stats.active}</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-200/80">Listos para administrarse</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/20">
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">Bandera futura</p>
            <p className="mt-2 text-2xl font-semibold text-sky-800 dark:text-sky-100">{stats.publicVisible}</p>
            <p className="text-sm text-sky-700/80 dark:text-sky-200/80">Marcados para una vitrina futura</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">Inventario</p>
            <p className="mt-2 text-2xl font-semibold text-violet-800 dark:text-violet-100">{stats.inventoryReady}</p>
            <p className="text-sm text-violet-700/80 dark:text-violet-200/80">Con seguimiento real habilitado</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Buscar, filtrar y ordenar</CardTitle>
          <CardDescription>Encuentra rápido tus productos comerciales por nombre, categoría o estado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, categoría, SKU o código"
                className="pl-9"
                data-testid="input-commercial-products-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger data-testid="select-commercial-products-status">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={publicFilter} onValueChange={(value) => setPublicFilter(value as PublicFilter)}>
              <SelectTrigger data-testid="select-commercial-products-public">
                <SelectValue placeholder="Bandera futura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                <SelectItem value="public">Con bandera futura</SelectItem>
                <SelectItem value="private">Solo internos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={inventoryFilter} onValueChange={(value) => setInventoryFilter(value as InventoryFilter)}>
              <SelectTrigger data-testid="select-commercial-products-inventory">
                <SelectValue placeholder="Inventario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Con y sin inventario</SelectItem>
                <SelectItem value="inventory">Controla existencias</SelectItem>
                <SelectItem value="no_inventory">Sin control de existencias</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-commercial-products-category">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger data-testid="select-commercial-products-sort">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_desc">Más recientes</SelectItem>
                <SelectItem value="name_asc">Nombre A-Z</SelectItem>
                <SelectItem value="price_desc">Precio mayor</SelectItem>
                <SelectItem value="price_asc">Precio menor</SelectItem>
                <SelectItem value="category_asc">Categoría</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {products.length === 0 ? (
        <Card className="rounded-[28px] border-dashed border-border/70 shadow-sm" data-testid="empty-commercial-products">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package2 className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">
                {totalProducts === 0 ? "Todavía no tienes productos comerciales" : "No encontramos productos con esos filtros"}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalProducts === 0
                  ? "Crea tu primer producto para empezar a organizar tu catálogo administrativo."
                  : "Prueba con otra búsqueda, categoría o estado."}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {totalProducts === 0 ? (
                <Button onClick={openCreateDialog} data-testid="button-empty-commercial-products-create">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primer producto
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPublicFilter("all");
                    setInventoryFilter("all");
                    setCategoryFilter("all");
                    setSortBy("updated_desc");
                  }}
                  data-testid="button-commercial-products-clear-filters"
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden rounded-[28px] border-border/70 shadow-sm" data-testid={`commercial-product-card-${product.id}`}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
                      {product.photoUrl ? (
                        <img
                          src={product.photoUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          data-testid={`commercial-product-image-${product.id}`}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package2 className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-commercial-product-actions-${product.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openPerformanceDialog(product)}>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Desempeño
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSaleDialog(product)} disabled={!product.isActive}>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Vender
                            </DropdownMenuItem>
                            {product.usesInventory ? (
                              <DropdownMenuItem onClick={() => openInventoryDialog(product)}>
                                <Warehouse className="mr-2 h-4 w-4" />
                                Inventario
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => openEditDialog(product)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateMutation.mutate(product)} disabled={duplicateMutation.isPending}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleMutation.mutate({ productId: product.id, isActive: !product.isActive })}>
                              {product.isActive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                              {product.isActive ? "Inactivar" : "Activar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(product)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ProductStatusBadge isActive={product.isActive} />
                        <ProductVisibilityBadge isPublicVisible={product.isPublicVisible} />
                        <ProductInventoryBadge usesInventory={product.usesInventory} />
                      </div>
                    </div>
                  </div>

                  {product.description ? (
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Costo</p>
                      <p className="mt-1 text-sm font-semibold">{formatCurrency(product.costAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Venta</p>
                      <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(product.salePriceAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">SKU</p>
                      <p className="mt-1 break-words text-sm">{product.sku || "Sin SKU"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Código</p>
                      <p className="mt-1 break-words text-sm">{product.barcode || "Sin código"}</p>
                    </div>
                  </div>
                  {product.usesInventory ? (
                    <div className="rounded-2xl border border-violet-200/70 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Inventario</p>
                        <InventoryStatusBadge status={getProductInventoryStatus(product)} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Existencia</p>
                          <p className="font-semibold">{formatQuantity(getProductInventoryQuantity(product))} pzas</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Minima</p>
                          <p className="font-semibold">{formatQuantity(getProductInventoryMinimum(product))} pzas</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className={`grid gap-2 ${product.usesInventory ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-3"}`}>
                    <Button
                      variant="outline"
                      onClick={() => openPerformanceDialog(product)}
                      data-testid={`button-commercial-product-performance-mobile-${product.id}`}
                    >
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Desempeño
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openEditDialog(product)}
                      data-testid={`button-commercial-product-edit-mobile-${product.id}`}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      onClick={() => openSaleDialog(product)}
                      disabled={!product.isActive}
                      data-testid={`button-commercial-product-sell-mobile-${product.id}`}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Vender
                    </Button>
                    {product.usesInventory ? (
                      <Button
                        variant="outline"
                        onClick={() => openInventoryDialog(product)}
                        data-testid={`button-commercial-product-inventory-mobile-${product.id}`}
                      >
                        <Warehouse className="mr-2 h-4 w-4" />
                        Inventario
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden rounded-[28px] border-border/70 shadow-sm md:block">
            <CardContent className="p-0">
              {productsTableScroll.isOverflowing ? (
                <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
                  <span className="text-xs text-muted-foreground">Desliza para ver más columnas</span>
                  <div ref={productsTableScroll.mirrorScrollRef} className="h-4 flex-1 overflow-x-auto rounded-full border border-border/60 bg-muted/40">
                    <div style={{ width: productsTableScroll.contentWidth, height: 1 }} />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => productsTableScroll.scrollByDirection("left")}
                    disabled={!productsTableScroll.canScrollLeft}
                    title="Ver columnas anteriores"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => productsTableScroll.scrollByDirection("right")}
                    disabled={!productsTableScroll.canScrollRight}
                    title="Ver más columnas"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
              <div className="relative">
                {productsTableScroll.isOverflowing ? (
                  <>
                    <div className={`pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity ${productsTableScroll.canScrollLeft ? "opacity-100" : "opacity-0"}`} />
                    <div className={`pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity ${productsTableScroll.canScrollRight ? "opacity-100" : "opacity-0"}`} />
                  </>
                ) : null}
                <div ref={productsTableScroll.containerRef} className="overflow-x-auto rounded-b-[28px]">
              <table className="w-full min-w-[1480px] caption-bottom text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-[16] min-w-[340px] bg-background shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)]">Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>SKU / código</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead>Inventario</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última edición</TableHead>
                    <TableHead className="sticky right-0 z-[16] w-[320px] bg-background text-right shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="group" data-testid={`commercial-product-row-${product.id}`}>
                      <TableCell className="sticky left-0 z-[14] min-w-[340px] bg-background shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)] group-hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-muted">
                            {product.photoUrl ? (
                              <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                <Package2 className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="break-words font-medium">{product.name}</p>
                            {product.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{product.sku || "Sin SKU"}</p>
                          <p className="text-muted-foreground">{product.barcode || "Sin código"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(product.costAmount)}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{formatCurrency(product.salePriceAmount)}</TableCell>
                      <TableCell>
                        {product.usesInventory ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <InventoryStatusBadge status={getProductInventoryStatus(product)} />
                            </div>
                            <div className="space-y-1 text-muted-foreground">
                              <p>{formatQuantity(getProductInventoryQuantity(product))} pzas disponibles</p>
                              <p>Minima: {formatQuantity(getProductInventoryMinimum(product))} pzas</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No aplica</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <ProductStatusBadge isActive={product.isActive} />
                          <ProductVisibilityBadge isPublicVisible={product.isPublicVisible} />
                          <ProductInventoryBadge usesInventory={product.usesInventory} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(product.updatedAt)}</TableCell>
                      <TableCell className="sticky right-0 z-[14] bg-background text-right shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)] group-hover:bg-muted/50">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPerformanceDialog(product)}
                            data-testid={`button-commercial-product-performance-desktop-${product.id}`}
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Desempeño
                          </Button>
                          {product.usesInventory ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInventoryDialog(product)}
                              data-testid={`button-commercial-product-inventory-desktop-${product.id}`}
                            >
                              <Warehouse className="mr-2 h-4 w-4" />
                              Inventario
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            onClick={() => openSaleDialog(product)}
                            disabled={!product.isActive}
                            data-testid={`button-commercial-product-sell-desktop-${product.id}`}
                          >
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            Vender
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-commercial-product-row-actions-${product.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openPerformanceDialog(product)}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Desempeño
                              </DropdownMenuItem>
                              {product.usesInventory ? (
                                <DropdownMenuItem onClick={() => openInventoryDialog(product)}>
                                  <Warehouse className="mr-2 h-4 w-4" />
                                  Inventario
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateMutation.mutate(product)} disabled={duplicateMutation.isPending}>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleMutation.mutate({ productId: product.id, isActive: !product.isActive })}>
                                {product.isActive ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                {product.isActive ? "Inactivar" : "Activar"}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(product)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {totalProducts === 1 ? "1 producto encontrado" : `${totalProducts} productos encontrados`}
              </p>
              <p className="text-muted-foreground">
                Página {page} de {totalPages}{isFetching ? " · actualizando..." : ""}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Label htmlFor="commercial-products-page-size" className="text-xs text-muted-foreground">Mostrar</Label>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value) as 25 | 50 | 100)}>
                  <SelectTrigger id="commercial-products-page-size" className="w-[110px]" data-testid="select-commercial-products-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl" data-testid="dialog-commercial-product">
          <div className="flex h-full max-h-[100dvh] flex-col bg-background">
            <DialogHeader className="border-b px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] pr-12 text-left sm:px-6 sm:pt-6">
              <DialogTitle className="text-xl">
                {editingProduct ? "Editar producto" : "Nuevo producto"}
              </DialogTitle>
              <DialogDescription>
                Completa la información comercial base del producto. Ventas e inventario se gestionan desde sus acciones correspondientes.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="commercial-product-name">Nombre</Label>
                      <Input
                        id="commercial-product-name"
                        value={form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        placeholder="Ej. Shampoo nutritivo"
                        data-testid="input-commercial-product-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-category">Categoría</Label>
                      <Input
                        id="commercial-product-category"
                        value={form.category}
                        onChange={(event) => setField("category", event.target.value)}
                        placeholder="Ej. Belleza"
                        data-testid="input-commercial-product-category"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-display-order">Orden</Label>
                      <Input
                        id="commercial-product-display-order"
                        type="number"
                        min="0"
                        value={form.displayOrder}
                        onChange={(event) => setField("displayOrder", event.target.value)}
                        placeholder="Opcional"
                        data-testid="input-commercial-product-order"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sku">SKU</Label>
                      <Input
                        id="commercial-product-sku"
                        value={form.sku}
                        onChange={(event) => setField("sku", event.target.value)}
                        placeholder="Opcional"
                        data-testid="input-commercial-product-sku"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-barcode">Código de barras</Label>
                      <Input
                        id="commercial-product-barcode"
                        value={form.barcode}
                        onChange={(event) => setField("barcode", event.target.value)}
                        placeholder="Opcional"
                        data-testid="input-commercial-product-barcode"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-cost">Costo</Label>
                      <Input
                        id="commercial-product-cost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.costAmount}
                        onChange={(event) => setField("costAmount", event.target.value)}
                        placeholder="0.00"
                        data-testid="input-commercial-product-cost"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sale-price">Precio de venta</Label>
                      <Input
                        id="commercial-product-sale-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.salePriceAmount}
                        onChange={(event) => setField("salePriceAmount", event.target.value)}
                        placeholder="0.00"
                        data-testid="input-commercial-product-sale-price"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commercial-product-description">Descripción</Label>
                    <Textarea
                      id="commercial-product-description"
                      value={form.description}
                      onChange={(event) => setField("description", event.target.value)}
                      placeholder="Describe el producto para tu operación comercial."
                      rows={4}
                      data-testid="input-commercial-product-description"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">Fotografía</p>
                        <p className="text-sm text-muted-foreground">Usa el sistema de uploads existente.</p>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handlePhotoUpload(file);
                            }
                            event.target.value = "";
                          }}
                          data-testid="input-commercial-product-photo"
                        />
                        <Button type="button" variant="outline" asChild disabled={uploadingPhoto}>
                          <span>
                            {uploadingPhoto ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="mr-2 h-4 w-4" />
                            )}
                            Subir foto
                          </span>
                        </Button>
                      </label>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border bg-background">
                      {form.photoUrl ? (
                        <img
                          src={form.photoUrl}
                          alt="Vista previa del producto"
                          className="h-48 w-full object-cover"
                          data-testid="preview-commercial-product-photo"
                        />
                      ) : (
                        <div className="flex h-48 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Package2 className="h-8 w-8" />
                          <p className="text-sm">Sin fotografía</p>
                        </div>
                      )}
                    </div>

                    {form.photoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-3 w-full"
                        onClick={() => setField("photoUrl", "")}
                        data-testid="button-remove-commercial-product-photo"
                      >
                        Quitar fotografía
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-3xl border border-border/70 bg-card p-4">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3">
                      <div>
                        <p className="font-medium">Disponible para vender</p>
                        <p className="text-sm text-muted-foreground">Si lo desactivas, dejará de aparecer en Cobrar, pero conservará su historial.</p>
                      </div>
                      <Switch checked={form.isActive} onCheckedChange={(value) => setField("isActive", value)} data-testid="switch-commercial-product-active" />
                    </div>
                    <div className="rounded-2xl border border-border/60 p-3">
                      <div>
                        <p className="font-medium">Visibilidad pública futura</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Este campo queda reservado para una fase posterior. Hoy este módulo no publica el producto en un catálogo visible para clientes.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3">
                      <div>
                        <p className="font-medium">Controlar existencias</p>
                        <p className="text-sm text-muted-foreground">Actívalo cuando necesites registrar entradas, salidas, stock mínimo y existencias disponibles.</p>
                        <p className="mt-1 text-xs text-muted-foreground">Déjalo desactivado para servicios o productos que se venden sin controlar unidades.</p>
                      </div>
                      <Switch checked={form.usesInventory} onCheckedChange={(value) => setField("usesInventory", value)} data-testid="switch-commercial-product-inventory" />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Vista rápida</p>
                    <div className="mt-3 space-y-2">
                      <p className="text-lg font-semibold">{form.name.trim() || "Nombre del producto"}</p>
                      <p className="text-sm text-muted-foreground">{form.category.trim() || "Categoría pendiente"}</p>
                      <div className="flex flex-wrap gap-2">
                        <ProductStatusBadge isActive={form.isActive} />
                        <ProductInventoryBadge usesInventory={form.usesInventory} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Costo</p>
                          <p className="font-medium">{formatCurrency(Number.parseFloat(form.costAmount) || 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Venta</p>
                          <p className="font-medium text-primary">{formatCurrency(Number.parseFloat(form.salePriceAmount) || 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-background/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-commercial-product">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-save-commercial-product">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingProduct ? "Guardar cambios" : "Crear producto"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={performanceDialogOpen} onOpenChange={(open) => !open && closePerformanceDialog()}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Desempeño del producto</DialogTitle>
            <DialogDescription>
              Consulta ventas, utilidad estimada e inventario actual sin alterar el producto ni su inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 pb-2">
            <Button variant={performancePreset === "current_month" ? "default" : "outline"} size="sm" onClick={() => setPerformancePreset("current_month")}>
              Mes actual
            </Button>
            <Button variant={performancePreset === "previous_month" ? "default" : "outline"} size="sm" onClick={() => setPerformancePreset("previous_month")}>
              Mes anterior
            </Button>
            <Button variant={performancePreset === "ninety_days" ? "default" : "outline"} size="sm" onClick={() => setPerformancePreset("ninety_days")}>
              Últimos 90 días
            </Button>
          </div>

          {isLoadingPerformance || !performance ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ventas</p><p className="mt-2 text-2xl font-semibold">{performance.salesCount}</p><p className="text-sm text-muted-foreground">tickets con este producto</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Unidades</p><p className="mt-2 text-2xl font-semibold">{performance.unitsSold}</p><p className="text-sm text-muted-foreground">piezas vendidas</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ingreso</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(performance.revenueAmount)}</p><p className="text-sm text-muted-foreground">ingreso generado</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Utilidad bruta</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(performance.grossProfitAmount)}</p><p className="text-sm text-muted-foreground">{performance.grossMarginPercent == null ? "margen no disponible" : `${performance.grossMarginPercent}% de margen`}</p></CardContent></Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Ventas recientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {performance.recentSales.length ? performance.recentSales.map((sale) => (
                      <div key={sale.saleId} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">{sale.folio}</p>
                            <p className="text-sm text-muted-foreground">{sale.clientDisplayName || "Mostrador"} · {sale.sellerName || "Sin vendedor"}</p>
                          </div>
                          <Badge variant="outline">{sale.quantitySold} pza(s)</Badge>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                          <p>Fecha: {formatDateTime(sale.saleDate)}</p>
                          <p>Ingreso: {formatCurrency(sale.revenueAmount)}</p>
                          <p>Utilidad: {formatCurrency(sale.grossProfitAmount)}</p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Pago: {sale.paymentMethods.length ? sale.paymentMethods.map((method) => formatPaymentMethodLabel(method)).join(", ") : "Sin pagos"}
                        </p>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center">
                        <p className="text-sm font-medium">Sin ventas en este periodo</p>
                        <p className="mt-1 text-sm text-muted-foreground">Cambia el rango o registra ventas nuevas para ver desempeño aquí.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Estado de inventario</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estatus</p>
                          <div className="mt-2"><InventoryStatusBadge status={performance.inventoryStatus} /></div>
                        </div>
                        {performance.inventoryStatus === "low_stock" || performance.inventoryStatus === "out_of_stock" ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Package2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div className="rounded-xl border p-3">
                          <p className="text-muted-foreground">Stock actual</p>
                          <p className="mt-1 font-semibold">{performance.quantityOnHand == null ? "No aplica" : `${performance.quantityOnHand} pzas`}</p>
                        </div>
                        <div className="rounded-xl border p-3">
                          <p className="text-muted-foreground">Stock mínimo</p>
                          <p className="mt-1 font-semibold">{performance.minimumStock == null ? "No aplica" : `${performance.minimumStock} pzas`}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
                        Última venta: {performance.lastSaleAt ? formatDateTime(performance.lastSaleAt) : "Sin ventas registradas"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Resumen comercial</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p><span className="font-medium text-foreground">Costo estimado vendido:</span> {formatCurrency(performance.costAmountSold)}</p>
                      <p><span className="font-medium text-foreground">Periodo:</span> {performance.from || "—"} al {performance.to || "—"}</p>
                      <p><span className="font-medium text-foreground">Categoría:</span> {performance.category || "Sin categoría"}</p>
                      <p><span className="font-medium text-foreground">Producto:</span> {performance.productName}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={inventoryDialogOpen} onOpenChange={(open) => !open && closeInventoryDialog()}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-3xl" data-testid="dialog-commercial-product-inventory">
          <div className="flex h-full max-h-[100dvh] flex-col bg-background">
            <DialogHeader className="border-b px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] pr-12 text-left sm:px-6 sm:pt-6">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Warehouse className="h-5 w-5 text-primary" />
                Inventario del producto
              </DialogTitle>
              <DialogDescription>
                {inventoryProduct
                  ? `Administra existencias y revisa el libro de movimientos de ${inventoryProduct.name}.`
                  : "Administra existencias y revisa el libro de movimientos del producto."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                          {inventoryProduct?.photoUrl ? (
                            <img src={inventoryProduct.photoUrl} alt={inventoryProduct.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Package2 className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="break-words font-semibold">{inventoryProduct?.name || "Producto"}</p>
                          <p className="text-sm text-muted-foreground">{inventoryProduct?.category || "Sin categoria"}</p>
                          <div className="flex flex-wrap gap-2">
                            <InventoryStatusBadge status={inventoryStatus} />
                            {inventoryProduct ? <ProductStatusBadge isActive={inventoryProduct.isActive} /> : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-card p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resumen actual</p>
                        {isFetchingInventorySummary ? (
                          <span className="text-xs text-muted-foreground">Actualizando...</span>
                        ) : null}
                      </div>

                      {isLoadingInventorySummary ? (
                        <div className="mt-4 space-y-3">
                          <Skeleton className="h-6 w-full rounded-xl" />
                          <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Existencia actual</p>
                              <p className="mt-2 text-2xl font-semibold">{formatQuantity(inventoryBalance?.quantityOnHand ?? 0)}</p>
                              <p className="text-sm text-muted-foreground">piezas disponibles</p>
                            </div>
                            <div className="rounded-2xl border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Minimo</p>
                              <p className="mt-2 text-2xl font-semibold">{formatQuantity(inventoryBalance?.minimumStock ?? 0)}</p>
                              <p className="text-sm text-muted-foreground">alerta interna</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Estado</p>
                              <div className="mt-2">
                                <InventoryStatusBadge status={inventoryStatus} />
                              </div>
                            </div>
                            <div className="rounded-2xl border border-border/60 p-3">
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ultimo cambio</p>
                              <p className="mt-2 font-medium">{inventoryBalance?.updatedAt ? formatDateTime(inventoryBalance.updatedAt) : "Sin movimientos"}</p>
                              <p className="text-sm text-muted-foreground">{inventorySummary?.movementCount ?? 0} movimientos registrados</p>
                            </div>
                          </div>
                          {!inventoryHasBalance ? (
                            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                              Este producto usa inventario, pero aún no tiene una existencia inicial configurada.
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border/70 bg-card p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Acciones</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Las compras recibidas desde Proveedores y compras aumentan automáticamente las existencias.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button
                          variant={inventoryAction === "initial" ? "default" : "outline"}
                          onClick={() => setInventoryAction("initial")}
                          disabled={!!inventoryHasBalance}
                          data-testid="button-commercial-product-inventory-action-initial"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Inventario inicial
                        </Button>
                        <Button
                          variant={inventoryAction === "entry" ? "default" : "outline"}
                          onClick={() => setInventoryAction("entry")}
                          disabled={!inventoryHasBalance}
                          data-testid="button-commercial-product-inventory-action-entry"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Registrar entrada
                        </Button>
                        <Button
                          variant={inventoryAction === "adjust" ? "default" : "outline"}
                          onClick={() => setInventoryAction("adjust")}
                          disabled={!inventoryHasBalance}
                          data-testid="button-commercial-product-inventory-action-adjust"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Ajustar existencia
                        </Button>
                        <Button
                          variant={inventoryAction === "waste" ? "default" : "outline"}
                          onClick={() => setInventoryAction("waste")}
                          disabled={!inventoryHasBalance}
                          data-testid="button-commercial-product-inventory-action-waste"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Registrar merma
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        className="mt-2 w-full"
                        onClick={() => setInventoryAction("movements")}
                        data-testid="button-commercial-product-inventory-action-movements"
                      >
                        <Warehouse className="mr-2 h-4 w-4" />
                        Ver movimientos
                      </Button>
                    </div>

                    {inventoryAction === "initial" ? (
                      <div className="rounded-3xl border border-border/70 bg-card p-4">
                        <p className="font-medium">Configurar inventario inicial</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          El costo unitario inicial se toma del costo actual del producto. Modifícalo solo si este lote tuvo un costo diferente.
                        </p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="inventory-initial-quantity">Cantidad inicial</Label>
                            <Input
                              id="inventory-initial-quantity"
                              type="number"
                              min="1"
                              step="1"
                              value={inventoryInitialForm.quantity}
                              onChange={(event) => setInventoryInitialField("quantity", event.target.value)}
                              data-testid="input-commercial-product-inventory-initial-quantity"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="inventory-initial-minimum">Existencia minima</Label>
                            <Input
                              id="inventory-initial-minimum"
                              type="number"
                              min="0"
                              step="1"
                              value={inventoryInitialForm.minimumStock}
                              onChange={(event) => setInventoryInitialField("minimumStock", event.target.value)}
                              data-testid="input-commercial-product-inventory-initial-minimum"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-initial-unit-cost">Costo unitario inicial</Label>
                            <Input
                              id="inventory-initial-unit-cost"
                              type="number"
                              min="0"
                              step="0.01"
                              value={inventoryInitialForm.unitCost}
                              onChange={(event) => setInventoryInitialField("unitCost", event.target.value)}
                              placeholder={inventoryProduct?.costAmount ? inventoryProduct.costAmount.toFixed(2) : "Captura el costo del lote"}
                              data-testid="input-commercial-product-inventory-initial-unit-cost"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-initial-notes">Nota</Label>
                            <Textarea
                              id="inventory-initial-notes"
                              value={inventoryInitialForm.notes}
                              onChange={(event) => setInventoryInitialField("notes", event.target.value)}
                              rows={3}
                              placeholder="Observacion interna"
                              data-testid="input-commercial-product-inventory-initial-notes"
                            />
                          </div>
                        </div>
                        <Button
                          className="mt-4 w-full"
                          onClick={handleSubmitInventoryInitial}
                          disabled={isSubmittingInventory}
                          data-testid="button-commercial-product-inventory-initial-submit"
                        >
                          {inventoryInitialMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Guardar inventario inicial
                        </Button>
                      </div>
                    ) : null}

                    {inventoryAction === "entry" ? (
                      <div className="rounded-3xl border border-border/70 bg-card p-4">
                        <p className="font-medium">Registrar entrada manual</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="inventory-entry-quantity">Cantidad</Label>
                            <Input
                              id="inventory-entry-quantity"
                              type="number"
                              min="1"
                              step="1"
                              value={inventoryEntryForm.quantity}
                              onChange={(event) => setInventoryEntryField("quantity", event.target.value)}
                              data-testid="input-commercial-product-inventory-entry-quantity"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="inventory-entry-minimum">Nueva minima</Label>
                            <Input
                              id="inventory-entry-minimum"
                              type="number"
                              min="0"
                              step="1"
                              value={inventoryEntryForm.minimumStock}
                              onChange={(event) => setInventoryEntryField("minimumStock", event.target.value)}
                              placeholder="Opcional"
                              data-testid="input-commercial-product-inventory-entry-minimum"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-entry-unit-cost">Costo unitario</Label>
                            <Input
                              id="inventory-entry-unit-cost"
                              type="number"
                              min="0"
                              step="0.01"
                              value={inventoryEntryForm.unitCost}
                              onChange={(event) => setInventoryEntryField("unitCost", event.target.value)}
                              placeholder="Opcional"
                              data-testid="input-commercial-product-inventory-entry-unit-cost"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-entry-reason">Razon</Label>
                            <Input
                              id="inventory-entry-reason"
                              value={inventoryEntryForm.reason}
                              onChange={(event) => setInventoryEntryField("reason", event.target.value)}
                              placeholder="Ej. compra al proveedor"
                              data-testid="input-commercial-product-inventory-entry-reason"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-entry-notes">Nota</Label>
                            <Textarea
                              id="inventory-entry-notes"
                              value={inventoryEntryForm.notes}
                              onChange={(event) => setInventoryEntryField("notes", event.target.value)}
                              rows={3}
                              placeholder="Observacion interna"
                              data-testid="input-commercial-product-inventory-entry-notes"
                            />
                          </div>
                        </div>
                        <Button
                          className="mt-4 w-full"
                          onClick={handleSubmitInventoryEntry}
                          disabled={isSubmittingInventory}
                          data-testid="button-commercial-product-inventory-entry-submit"
                        >
                          {inventoryEntryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Registrar entrada
                        </Button>
                      </div>
                    ) : null}

                    {inventoryAction === "adjust" ? (
                      <div className="rounded-3xl border border-border/70 bg-card p-4">
                        <p className="font-medium">Ajustar existencia</p>
                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <Label>Modo de ajuste</Label>
                            <Select
                              value={inventoryAdjustForm.mode}
                              onValueChange={(value) => setInventoryAdjustField("mode", value as InventoryAdjustFormState["mode"])}
                            >
                              <SelectTrigger data-testid="select-commercial-product-inventory-adjust-mode">
                                <SelectValue placeholder="Selecciona un modo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="set">Definir existencia final</SelectItem>
                                <SelectItem value="delta">Aplicar diferencia</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            {inventoryAdjustForm.mode === "set" ? (
                              <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="inventory-adjust-new-quantity">Nueva existencia</Label>
                                <Input
                                  id="inventory-adjust-new-quantity"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={inventoryAdjustForm.newQuantity}
                                  onChange={(event) => setInventoryAdjustField("newQuantity", event.target.value)}
                                  data-testid="input-commercial-product-inventory-adjust-new-quantity"
                                />
                              </div>
                            ) : (
                              <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="inventory-adjust-delta">Diferencia</Label>
                                <Input
                                  id="inventory-adjust-delta"
                                  type="number"
                                  step="1"
                                  value={inventoryAdjustForm.quantityDelta}
                                  onChange={(event) => setInventoryAdjustField("quantityDelta", event.target.value)}
                                  placeholder="Ej. -2 o 5"
                                  data-testid="input-commercial-product-inventory-adjust-delta"
                                />
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label htmlFor="inventory-adjust-minimum">Nueva minima</Label>
                              <Input
                                id="inventory-adjust-minimum"
                                type="number"
                                min="0"
                                step="1"
                                value={inventoryAdjustForm.minimumStock}
                                onChange={(event) => setInventoryAdjustField("minimumStock", event.target.value)}
                                placeholder="Opcional"
                                data-testid="input-commercial-product-inventory-adjust-minimum"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="inventory-adjust-unit-cost">Costo unitario</Label>
                              <Input
                                id="inventory-adjust-unit-cost"
                                type="number"
                                min="0"
                                step="0.01"
                                value={inventoryAdjustForm.unitCost}
                                onChange={(event) => setInventoryAdjustField("unitCost", event.target.value)}
                                placeholder="Opcional"
                                data-testid="input-commercial-product-inventory-adjust-unit-cost"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor="inventory-adjust-reason">Motivo</Label>
                              <Input
                                id="inventory-adjust-reason"
                                value={inventoryAdjustForm.reason}
                                onChange={(event) => setInventoryAdjustField("reason", event.target.value)}
                                placeholder="Ej. conteo fisico"
                                data-testid="input-commercial-product-inventory-adjust-reason"
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor="inventory-adjust-notes">Nota</Label>
                              <Textarea
                                id="inventory-adjust-notes"
                                value={inventoryAdjustForm.notes}
                                onChange={(event) => setInventoryAdjustField("notes", event.target.value)}
                                rows={3}
                                placeholder="Observacion interna"
                                data-testid="input-commercial-product-inventory-adjust-notes"
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          className="mt-4 w-full"
                          onClick={handleSubmitInventoryAdjust}
                          disabled={isSubmittingInventory}
                          data-testid="button-commercial-product-inventory-adjust-submit"
                        >
                          {inventoryAdjustMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Guardar ajuste
                        </Button>
                      </div>
                    ) : null}

                    {inventoryAction === "waste" ? (
                      <div className="rounded-3xl border border-border/70 bg-card p-4">
                        <p className="font-medium">Registrar merma o dano</p>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Tipo de salida</Label>
                            <Select
                              value={inventoryWasteForm.movementType}
                              onValueChange={(value) => setInventoryWasteField("movementType", value as InventoryWasteFormState["movementType"])}
                            >
                              <SelectTrigger data-testid="select-commercial-product-inventory-waste-type">
                                <SelectValue placeholder="Selecciona un tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waste">Merma</SelectItem>
                                <SelectItem value="damaged">Danado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="inventory-waste-quantity">Cantidad</Label>
                            <Input
                              id="inventory-waste-quantity"
                              type="number"
                              min="1"
                              step="1"
                              value={inventoryWasteForm.quantity}
                              onChange={(event) => setInventoryWasteField("quantity", event.target.value)}
                              data-testid="input-commercial-product-inventory-waste-quantity"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-waste-reason">Motivo</Label>
                            <Input
                              id="inventory-waste-reason"
                              value={inventoryWasteForm.reason}
                              onChange={(event) => setInventoryWasteField("reason", event.target.value)}
                              placeholder="Ej. producto vencido"
                              data-testid="input-commercial-product-inventory-waste-reason"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="inventory-waste-notes">Nota</Label>
                            <Textarea
                              id="inventory-waste-notes"
                              value={inventoryWasteForm.notes}
                              onChange={(event) => setInventoryWasteField("notes", event.target.value)}
                              rows={3}
                              placeholder="Observacion interna"
                              data-testid="input-commercial-product-inventory-waste-notes"
                            />
                          </div>
                        </div>
                        <Button
                          className="mt-4 w-full"
                          onClick={handleSubmitInventoryWaste}
                          disabled={isSubmittingInventory}
                          data-testid="button-commercial-product-inventory-waste-submit"
                        >
                          {inventoryWasteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Registrar salida
                        </Button>
                      </div>
                    ) : null}

                    {inventoryAction === "movements" ? (
                      <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        Revisa abajo el libro de movimientos mas reciente de este producto.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/70 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Libro de movimientos</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {inventorySummary?.movementCount ?? displayedInventoryMovements.length} registros acumulados
                      </p>
                    </div>
                    {isFetchingInventoryMovements ? (
                      <span className="text-xs text-muted-foreground">Actualizando...</span>
                    ) : null}
                  </div>

                  {isLoadingInventoryMovements && !displayedInventoryMovements.length ? (
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-20 w-full rounded-2xl" />
                      <Skeleton className="h-20 w-full rounded-2xl" />
                    </div>
                  ) : displayedInventoryMovements.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                      Aún no hay movimientos de inventario para este producto.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {displayedInventoryMovements.map((movement) => (
                        <div
                          key={movement.id}
                          className="rounded-2xl border border-border/60 bg-muted/20 p-4"
                          data-testid={`commercial-product-inventory-movement-${movement.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium">{getInventoryMovementLabel(movement.movementType)}</p>
                              <p className="text-sm text-muted-foreground">{movement.reason}</p>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${movement.quantityDelta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                {movement.quantityDelta >= 0 ? "+" : ""}
                                {formatQuantity(movement.quantityDelta)} pzas
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(movement.createdAt)}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                            <p>Antes: <span className="font-medium text-foreground">{formatQuantity(movement.quantityBefore)}</span></p>
                            <p>Despues: <span className="font-medium text-foreground">{formatQuantity(movement.quantityAfter)}</span></p>
                            <p>Costo: <span className="font-medium text-foreground">{movement.unitCostSnapshot != null ? formatCurrency(movement.unitCostSnapshot) : "Sin snapshot"}</span></p>
                          </div>
                          {movement.notes ? (
                            <p className="mt-3 text-sm text-muted-foreground">{movement.notes}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-background/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
              <Button variant="outline" onClick={closeInventoryDialog} data-testid="button-close-commercial-product-inventory">
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={saleDialogOpen} onOpenChange={(open) => !open && closeSaleDialog()}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-2xl" data-testid="dialog-commercial-product-sale">
          <div className="flex h-full max-h-[100dvh] flex-col bg-background">
            <DialogHeader className="border-b px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] pr-12 text-left sm:px-6 sm:pt-6">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Registrar venta
              </DialogTitle>
              <DialogDescription>
                Confirma esta operación comercial sin alterar otros flujos de la sucursal.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Producto</p>
                    <div className="mt-3 flex items-start gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                        {saleProduct?.photoUrl ? (
                          <img src={saleProduct.photoUrl} alt={saleProduct.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Package2 className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-semibold">{saleProduct?.name || "Producto"}</p>
                        <p className="text-sm text-muted-foreground">{saleProduct?.category || "Sin categoría"}</p>
                        <p className="text-sm text-primary">{formatCurrency(saleProduct?.salePriceAmount ?? 0)} por unidad</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sale-quantity">Cantidad</Label>
                      <Input
                        id="commercial-product-sale-quantity"
                        type="number"
                        min="1"
                        step="1"
                        value={saleForm.quantity}
                        onChange={(event) => setSaleField("quantity", event.target.value)}
                        data-testid="input-commercial-product-sale-quantity"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sale-discount">Descuento</Label>
                      <Input
                        id="commercial-product-sale-discount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={saleForm.discountAmount}
                        onChange={(event) => setSaleField("discountAmount", event.target.value)}
                        data-testid="input-commercial-product-sale-discount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Impuestos</Label>
                      <Select value={saleForm.taxMode} onValueChange={(value) => setSaleField("taxMode", value as SaleFormState["taxMode"])}>
                        <SelectTrigger data-testid="select-commercial-product-sale-tax-mode">
                          <SelectValue placeholder="Selecciona el tratamiento fiscal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tax_exempt">Sin IVA</SelectItem>
                          <SelectItem value="tax_included">Precio incluye IVA</SelectItem>
                          <SelectItem value="tax_added">Agregar IVA al precio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sale-tax-rate">Tasa de IVA (%)</Label>
                      <Input
                        id="commercial-product-sale-tax-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={saleForm.taxRate}
                        onChange={(event) => setSaleField("taxRate", event.target.value)}
                        disabled={saleForm.taxMode === "tax_exempt"}
                        data-testid="input-commercial-product-sale-tax-rate"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Cliente (opcional)</Label>
                      <Select value={saleForm.clientUserId} onValueChange={(value) => setSaleField("clientUserId", value)}>
                        <SelectTrigger data-testid="select-commercial-product-sale-client">
                          <SelectValue placeholder="Venta de mostrador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={WALK_IN_CLIENT_VALUE}>Venta de mostrador</SelectItem>
                          {branchClients.map((client) => {
                            const displayName = `${client.name}${client.lastName ? ` ${client.lastName}` : ""}`.trim();
                            const secondaryLine = client.phone || client.email || "Sin contacto";
                            return (
                              <SelectItem key={client.userId} value={client.userId}>
                                {`${displayName} · ${secondaryLine}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {isLoadingBranchClients ? (
                        <p className="text-xs text-muted-foreground">Cargando clientes de la sucursal…</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Proyecto relacionado (opcional)</Label>
                      <Select value={saleForm.projectId} onValueChange={(value) => setSaleField("projectId", value)}>
                        <SelectTrigger data-testid="select-commercial-product-sale-project">
                          <SelectValue placeholder="Sin proyecto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PROJECT_VALUE}>Sin proyecto</SelectItem>
                          {commercialProjectOptions.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.code} - {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Solo agrupa la venta para rentabilidad; no crea otro ingreso.</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label>Vendedor (opcional)</Label>
                        <p className="text-xs text-muted-foreground">Atribuye la venta sin mezclarla con profesores.</p>
                      </div>
                      {branchSalespeople.length > 6 ? (
                        <Input
                          value={saleSellerSearch}
                          onChange={(event) => setSaleSellerSearch(event.target.value)}
                          placeholder="Buscar vendedor por nombre, código o rol"
                          data-testid="input-commercial-product-sale-seller-search"
                        />
                      ) : null}
                      <Select value={saleForm.sellerId} onValueChange={(value) => setSaleField("sellerId", value)}>
                        <SelectTrigger data-testid="select-commercial-product-sale-seller">
                          <SelectValue placeholder="Sin vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_SALESPERSON_VALUE}>Sin vendedor</SelectItem>
                          {filteredSalespeople.map((person) => {
                            const displayName = [person.name, person.lastName].filter(Boolean).join(" ").trim();
                            const secondaryLine = [person.employeeCode, person.roleLabel].filter(Boolean).join(" · ");
                            return (
                              <SelectItem key={person.id} value={person.id}>
                                {secondaryLine ? `${displayName} · ${secondaryLine}` : displayName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {isLoadingBranchSalespeople ? (
                        <p className="text-xs text-muted-foreground">Cargando vendedores activos...</p>
                      ) : filteredSalespeople.length === 0 && branchSalespeople.length > 0 ? (
                        <p className="text-xs text-muted-foreground">No encontramos vendedores con ese criterio.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Puedes dejar la venta sin vendedor o atribuirla a un asesor activo.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Método de pago</Label>
                      <Select value={saleForm.paymentMethod} onValueChange={(value) => setSaleField("paymentMethod", value as SaleFormState["paymentMethod"])}>
                        <SelectTrigger data-testid="select-commercial-product-sale-payment-method">
                          <SelectValue placeholder="Selecciona un método" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="commercial-product-sale-payment-reference">Referencia de pago</Label>
                      <Input
                        id="commercial-product-sale-payment-reference"
                        value={saleForm.paymentReference}
                        onChange={(event) => setSaleField("paymentReference", event.target.value)}
                        placeholder="Opcional"
                        data-testid="input-commercial-product-sale-payment-reference"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="commercial-product-sale-notes">Nota</Label>
                      <Textarea
                        id="commercial-product-sale-notes"
                        value={saleForm.notes}
                        onChange={(event) => setSaleField("notes", event.target.value)}
                        placeholder="Observaciones internas de esta venta."
                        rows={3}
                        data-testid="input-commercial-product-sale-notes"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-border/70 bg-card p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resumen final</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Cantidad</span>
                        <span className="font-medium">{saleSummary.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Precio unitario</span>
                        <span className="font-medium">{formatCurrency(saleSummary.unitPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">{formatCurrency(saleSummary.subtotalBeforeTax)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Descuento</span>
                        <span className="font-medium">{formatCurrency(saleSummary.discount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Base gravable</span>
                        <span className="font-medium">{formatCurrency(saleSummary.taxableSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          IVA {saleForm.taxMode === "tax_exempt" ? "" : `(${saleSummary.appliedTaxRate.toFixed(2).replace(/\.00$/, "")}%)`}
                        </span>
                        <span className="font-medium">{formatCurrency(saleSummary.taxTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t pt-3 text-base">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold text-primary">{formatCurrency(saleSummary.total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm">
                    <p className="font-medium">Cliente asociado</p>
                    <p className="mt-2 text-muted-foreground">
                      {selectedSaleClient
                        ? `${selectedSaleClient.name}${selectedSaleClient.lastName ? ` ${selectedSaleClient.lastName}` : ""}`
                        : "Venta de mostrador, sin ligar esta operación a un cliente."}
                    </p>
                    {selectedSaleClient ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedSaleClient.phone || selectedSaleClient.email || "Sin contacto registrado"}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm">
                    <p className="font-medium">Vendedor atribuido</p>
                    <p className="mt-2 text-muted-foreground">
                      {selectedSalesperson
                        ? [selectedSalesperson.name, selectedSalesperson.lastName].filter(Boolean).join(" ").trim()
                        : "Sin vendedor en esta venta."}
                    </p>
                    {selectedSalesperson ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[selectedSalesperson.employeeCode, selectedSalesperson.roleLabel].filter(Boolean).join(" · ") || "Asesor activo"}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="space-y-1">
                      {saleAutomationLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t bg-background/95 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-6">
              <Button variant="outline" onClick={closeSaleDialog} data-testid="button-cancel-commercial-product-sale">
                Cancelar
              </Button>
              <Button onClick={handleSubmitSale} disabled={isSubmittingSale || !saleProduct} data-testid="button-save-commercial-product-sale">
                {isSubmittingSale ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Confirmar venta
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar producto</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Este producto dejará de aparecer para nuevas ventas, pero su historial comercial e inventario se conservarán.`
                : "Este producto dejará de aparecer para nuevas ventas, pero su historial comercial e inventario se conservarán."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
