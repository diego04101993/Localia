import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Supplier = {
  id: string;
  branchId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type CommercialProduct = {
  id: string;
  name: string;
  category: string;
  sku: string | null;
  costAmount: number;
  isActive: boolean;
  usesInventory: boolean;
};

type CommercialProjectOption = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type PurchaseItem = {
  id: string;
  purchaseId: string;
  branchId: string;
  commercialProductId: string | null;
  nameSnapshot: string;
  skuSnapshot: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type Purchase = {
  id: string;
  branchId: string;
  folio: string;
  supplierId: string | null;
  supplierName: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  purchaseDate: string;
  expectedDate: string | null;
  receivedAt: string | null;
  paymentStatus: "unpaid" | "partial" | "paid";
  paymentMethod: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  taxMode?: "tax_included" | "tax_added" | "tax_exempt" | null;
  taxRate?: number | null;
  subtotalBeforeTax?: number | null;
  taxableSubtotal?: number | null;
  taxTotal?: number | null;
  grandTotal?: number | null;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  totalUnitsOrdered: number;
  totalUnitsReceived: number;
};

type PurchaseDetail = Purchase & {
  items: PurchaseItem[];
};

type SupplierFormState = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  taxId: string;
  address: string;
  paymentTerms: string;
  notes: string;
  isActive: boolean;
};

type PurchaseItemDraft = {
  commercialProductId: string;
  quantityOrdered: string;
  unitCost: string;
  updateReferenceCost: boolean;
};

type PurchaseFormState = {
  supplierId: string;
  projectId: string;
  status: "draft" | "ordered";
  purchaseDate: string;
  expectedDate: string;
  paymentMethod: string;
  paidAmount: string;
  discountAmount: string;
  taxMode: "tax_included" | "tax_added" | "tax_exempt";
  taxRate: string;
  reference: string;
  notes: string;
  items: PurchaseItemDraft[];
};

type PurchaseFilters = {
  status: string;
  supplierId: string;
  from: string;
  to: string;
};

type PurchaseFocusRequest = {
  supplierId?: string | null;
  purchaseId?: string | null;
  nonce: number;
};

type SupplierSummary = {
  supplierId: string;
  supplierName: string;
  totalPurchasedAmount: number;
  purchasesCount: number;
  averageTicketAmount: number;
  lastPurchaseAt: string | null;
  productsSuppliedCount: number;
  receivedPurchasesCount: number;
  pendingPurchasesCount: number;
  topProducts: Array<{
    commercialProductId: string | null;
    name: string;
    unitsOrdered: number;
    unitsReceived: number;
    totalPurchasedAmount: number;
  }>;
};

const SUPPLIERS_QUERY_KEY = ["/api/branch/suppliers"];
const COMMERCIAL_PRODUCTS_QUERY_KEY = ["/api/branch/commercial-products"];
const COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY = ["/api/branch/commercial-projects/options"];

const PURCHASE_STATUS_OPTIONS: Array<{ value: Purchase["status"]; label: string }> = [
  { value: "draft", label: "Borrador" },
  { value: "ordered", label: "Pedida" },
  { value: "partially_received", label: "Parcial" },
  { value: "received", label: "Recibida" },
  { value: "cancelled", label: "Cancelada" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mercado_pago", label: "Mercado Pago" },
  { value: "otro", label: "Otro" },
] as const;

function getTodayIsoDate() {
  const now = new Date();
  const tz = new Date(now.toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
  return `${tz.getFullYear()}-${String(tz.getMonth() + 1).padStart(2, "0")}-${String(tz.getDate()).padStart(2, "0")}`;
}

function createInitialSupplierFormState(): SupplierFormState {
  return {
    name: "",
    contactName: "",
    phone: "",
    email: "",
    taxId: "",
    address: "",
    paymentTerms: "",
    notes: "",
    isActive: true,
  };
}

function createInitialPurchaseItemDraft(): PurchaseItemDraft {
  return {
    commercialProductId: "",
    quantityOrdered: "1",
    unitCost: "",
    updateReferenceCost: false,
  };
}

function createInitialPurchaseFormState(): PurchaseFormState {
  return {
    supplierId: "none",
    projectId: "none",
    status: "draft",
    purchaseDate: getTodayIsoDate(),
    expectedDate: "",
    paymentMethod: "none",
    paidAmount: "0",
    discountAmount: "0",
    taxMode: "tax_exempt",
    taxRate: "16",
    reference: "",
    notes: "",
    items: [createInitialPurchaseItemDraft()],
  };
}

function computePurchaseTaxPreview(params: {
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
    const subtotalBeforeTax = subtotalAmount;
    const taxableSubtotal = discountedSubtotal;
    const taxTotal = Number((taxableSubtotal * taxFactor).toFixed(2));
    return {
      subtotalBeforeTax,
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

function formatCurrencyMx(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function parseMutationErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;

  const rawMessage = error.message.trim();
  const jsonMatch = rawMessage.match(/^\d+\s*:\s*(\{.*\})$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      return fallback;
    }
  }

  const prefixedMatch = rawMessage.match(/^\d+\s*:\s*(.+)$/);
  return prefixedMatch?.[1] || rawMessage || fallback;
}

function getPurchaseProductModeLabel(product: CommercialProduct | null | undefined) {
  if (!product) return "Sin categoría";
  return product.usesInventory ? "Controla existencias" : "Compra bajo pedido / sin inventario";
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
  if (!value) return "Pendiente";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPurchasesQuery(filters: PurchaseFilters) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.supplierId && filters.supplierId !== "all") params.set("supplierId", filters.supplierId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return query ? `/api/branch/purchases?${query}` : "/api/branch/purchases";
}

function getStatusBadgeVariant(status: Purchase["status"]) {
  if (status === "received") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "partially_received") return "secondary";
  return "outline";
}

function getStatusLabel(status: Purchase["status"]) {
  return PURCHASE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function isQueryForPurchases(queryKey: readonly unknown[]) {
  return Array.isArray(queryKey) && typeof queryKey[0] === "string" && queryKey[0].startsWith("/api/branch/purchases");
}

export default function ProveedoresComprasTab({ focusRequest }: { focusRequest?: PurchaseFocusRequest | null } = {}) {
  const { toast } = useToast();
  const [section, setSection] = useState<"purchases" | "suppliers">("purchases");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [purchaseFilters, setPurchaseFilters] = useState<PurchaseFilters>({
    status: "all",
    supplierId: "all",
    from: "",
    to: "",
  });
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(createInitialSupplierFormState());
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(createInitialPurchaseFormState());
  const [purchaseDetailId, setPurchaseDetailId] = useState<string | null>(null);
  const [supplierSummaryId, setSupplierSummaryId] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [purchaseToReceive, setPurchaseToReceive] = useState<Purchase | null>(null);
  const [purchaseToCancel, setPurchaseToCancel] = useState<Purchase | null>(null);

  const purchasesUrl = useMemo(() => buildPurchasesQuery(purchaseFilters), [purchaseFilters]);
  const purchaseDetailUrl = purchaseDetailId ? `/api/branch/purchases/${purchaseDetailId}` : "";

  const suppliersQuery = useQuery<Supplier[]>({ queryKey: SUPPLIERS_QUERY_KEY });
  const productsQuery = useQuery<CommercialProduct[]>({ queryKey: COMMERCIAL_PRODUCTS_QUERY_KEY });
  const projectOptionsQuery = useQuery<CommercialProjectOption[]>({ queryKey: COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY });
  const purchasesQuery = useQuery<Purchase[]>({ queryKey: [purchasesUrl] });
  const purchaseDetailQuery = useQuery<PurchaseDetail>({
    queryKey: [purchaseDetailUrl],
    enabled: !!purchaseDetailId,
  });
  const supplierSummaryQuery = useQuery<SupplierSummary>({
    queryKey: supplierSummaryId ? [`/api/branch/suppliers/${supplierSummaryId}/summary`] : ["/api/branch/suppliers/summary/idle"],
    enabled: !!supplierSummaryId,
  });

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.purchaseId) {
      setSection("purchases");
      setPurchaseDetailId(focusRequest.purchaseId);
      return;
    }
    if (focusRequest.supplierId) {
      setSection("suppliers");
      setSupplierSummaryId(focusRequest.supplierId);
    }
  }, [focusRequest]);

  const availableProducts = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.isActive),
    [productsQuery.data],
  );

  const inventoryProducts = useMemo(
    () => availableProducts.filter((product) => product.usesInventory),
    [availableProducts],
  );

  const productMap = useMemo(
    () => new Map(availableProducts.map((product) => [product.id, product])),
    [availableProducts],
  );

  const suppliers = suppliersQuery.data ?? [];
  const projectOptions = projectOptionsQuery.data ?? [];
  const visibleSuppliers = useMemo(() => {
    const term = supplierSearch.trim().toLowerCase();
    if (!term) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactName, supplier.email, supplier.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [supplierSearch, suppliers]);

  const purchaseTotals = useMemo(() => {
    const items = purchaseForm.items.map((item) => {
      const quantity = Number(item.quantityOrdered || 0);
      const unitCost = Number(item.unitCost || 0);
      return Number.isFinite(quantity * unitCost) ? quantity * unitCost : 0;
    });
    const subtotal = Number(items.reduce((sum, value) => sum + value, 0).toFixed(2));
    const discount = Number(purchaseForm.discountAmount || 0);
    const paid = Number(purchaseForm.paidAmount || 0);
    const taxRate = Math.max(0, Number.parseFloat(purchaseForm.taxRate) || 0);
    const taxPreview = computePurchaseTaxPreview({
      subtotalAmount: subtotal,
      discountAmount: Number.isFinite(discount) ? discount : 0,
      taxMode: purchaseForm.taxMode,
      taxRate,
    });
    const total = taxPreview.grandTotal;
    return {
      subtotal,
      discount: Number.isFinite(discount) ? discount : 0,
      total: Number.isFinite(total) ? Math.max(total, 0) : 0,
      paid: Number.isFinite(paid) ? paid : 0,
      balance: Number((Math.max(total, 0) - (Number.isFinite(paid) ? paid : 0)).toFixed(2)),
      taxRate,
      subtotalBeforeTax: taxPreview.subtotalBeforeTax,
      taxableSubtotal: taxPreview.taxableSubtotal,
      taxTotal: taxPreview.taxTotal,
      grandTotal: taxPreview.grandTotal,
      appliedTaxRate: taxPreview.appliedTaxRate,
    };
  }, [purchaseForm.discountAmount, purchaseForm.items, purchaseForm.paidAmount, purchaseForm.taxMode, purchaseForm.taxRate]);

  const purchaseValidation = useMemo(() => {
    const errors: string[] = [];
    const selectedProductIds = purchaseForm.items
      .map((item) => item.commercialProductId)
      .filter((value) => value);
    const duplicateProducts = selectedProductIds.length !== new Set(selectedProductIds).size;
    if (duplicateProducts) {
      errors.push("No puedes repetir el mismo producto en la compra.");
    }

    if (purchaseTotals.discount < 0) {
      errors.push("El descuento no puede ser negativo.");
    }
    if (purchaseTotals.discount > purchaseTotals.subtotal) {
      errors.push("El descuento no puede ser mayor al subtotal.");
    }
    if (purchaseTotals.paid < 0) {
      errors.push("El pago registrado no puede ser negativo.");
    }
    if (purchaseForm.paymentMethod === "none" && purchaseTotals.paid > 0) {
      errors.push('Si eliges "No registrar todavia", el pago debe quedar en cero.');
    }
    if (purchaseTotals.paid > purchaseTotals.total) {
      errors.push("El pago registrado no puede ser mayor al total de la compra.");
    }
    if (purchaseForm.items.some((item) => !item.commercialProductId)) {
      errors.push("Cada renglon debe tener un producto.");
    }
    if (purchaseForm.items.some((item) => Number(item.quantityOrdered || 0) <= 0)) {
      errors.push("La cantidad debe ser mayor a cero.");
    }
    if (purchaseForm.items.some((item) => Number(item.unitCost || 0) < 0)) {
      errors.push("El costo unitario no puede ser negativo.");
    }

    return {
      errors,
      isValid: errors.length === 0,
    };
  }, [purchaseForm.items, purchaseForm.paymentMethod, purchaseTotals.discount, purchaseTotals.paid, purchaseTotals.subtotal, purchaseTotals.total]);

  const invalidateSuppliers = async () => {
    await queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
  };

  const invalidatePurchases = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => isQueryForPurchases(query.queryKey),
    });
  };

  const createOrUpdateSupplierMutation = useMutation({
    mutationFn: async (payload: SupplierFormState) => {
      const body = {
        name: payload.name,
        contactName: payload.contactName || null,
        phone: payload.phone || null,
        email: payload.email || null,
        taxId: payload.taxId || null,
        address: payload.address || null,
        paymentTerms: payload.paymentTerms || null,
        notes: payload.notes || null,
        isActive: payload.isActive,
      };
      const response = editingSupplier
        ? await apiRequest("PATCH", `/api/branch/suppliers/${editingSupplier.id}`, body)
        : await apiRequest("POST", "/api/branch/suppliers", body);
      return response.json();
    },
    onSuccess: async () => {
      await invalidateSuppliers();
      setSupplierDialogOpen(false);
      setEditingSupplier(null);
      setSupplierForm(createInitialSupplierFormState());
      toast({ title: "Proveedor guardado" });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo guardar el proveedor",
        description: error?.message || "Revisa los datos e intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      await apiRequest("DELETE", `/api/branch/suppliers/${supplierId}`);
    },
    onSuccess: async () => {
      await invalidateSuppliers();
      setSupplierToDelete(null);
      toast({ title: "Proveedor eliminado" });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo eliminar el proveedor",
        description: parseMutationErrorMessage(error, "Intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: async (payload: PurchaseFormState) => {
      const body = {
        supplierId: payload.supplierId === "none" ? null : payload.supplierId,
        projectId: payload.projectId === "none" ? null : payload.projectId,
        status: payload.status,
        purchaseDate: payload.purchaseDate,
        expectedDate: payload.expectedDate || null,
        paymentMethod: payload.paymentMethod === "none" ? null : payload.paymentMethod,
        paidAmount: Number(payload.paidAmount || 0),
        discountAmount: Number(payload.discountAmount || 0),
        taxMode: payload.taxMode,
        taxRate: Math.max(0, Number.parseFloat(payload.taxRate) || 0),
        reference: payload.reference || null,
        notes: payload.notes || null,
        items: payload.items.map((item) => ({
          commercialProductId: item.commercialProductId,
          quantityOrdered: Number(item.quantityOrdered || 0),
          unitCost: Number(item.unitCost || 0),
          updateReferenceCost: item.updateReferenceCost,
        })),
      };
      const response = await apiRequest("POST", "/api/branch/purchases", body);
      return response.json();
    },
    onSuccess: async (purchase: PurchaseDetail) => {
      await Promise.all([
        invalidatePurchases(),
        invalidateBranchCommercialQueries({
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          projectId: purchase.projectId ?? null,
        }),
      ]);
      setPurchaseDialogOpen(false);
      setPurchaseForm(createInitialPurchaseFormState());
      setPurchaseDetailId(purchase.id);
      toast({ title: "Compra guardada", description: `Folio ${purchase.folio}` });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo crear la compra",
        description: parseMutationErrorMessage(error, "Revisa los datos e intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const receivePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const response = await apiRequest("POST", `/api/branch/purchases/${purchaseId}/receive`, {});
      return response.json();
    },
    onSuccess: async (purchase: PurchaseDetail) => {
      await Promise.all([
        invalidatePurchases(),
        queryClient.invalidateQueries({ queryKey: COMMERCIAL_PRODUCTS_QUERY_KEY }),
        invalidateBranchCommercialQueries({
          purchaseId: purchase.id,
          supplierId: purchase.supplierId,
          projectId: purchase.projectId ?? null,
        }),
      ]);
      await queryClient.invalidateQueries({ queryKey: [`/api/branch/purchases/${purchase.id}`] });
      setPurchaseToReceive(null);
      setPurchaseDetailId(purchase.id);
      toast({
        title: "Mercancia recibida",
        description: "La compra quedo recibida. Solo los productos que controlan existencias actualizaron inventario.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo recibir la compra",
        description: parseMutationErrorMessage(error, "Intenta de nuevo."),
        variant: "destructive",
      });
    },
  });

  const cancelPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const response = await apiRequest("POST", `/api/branch/purchases/${purchaseId}/cancel`, {});
      return response.json();
    },
    onSuccess: async (purchase: PurchaseDetail) => {
      await invalidatePurchases();
      await invalidateBranchCommercialQueries({
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        projectId: purchase.projectId ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/branch/purchases/${purchase.id}`] });
      setPurchaseToCancel(null);
      setPurchaseDetailId(purchase.id);
      toast({ title: "Compra cancelada", description: `El folio ${purchase.folio} quedo marcado como cancelado.` });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo cancelar la compra",
        description: parseMutationErrorMessage(error, "Solo los borradores pueden cancelarse."),
        variant: "destructive",
      });
    },
  });

  const openCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(createInitialSupplierFormState());
    setSupplierDialogOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      taxId: supplier.taxId ?? "",
      address: supplier.address ?? "",
      paymentTerms: supplier.paymentTerms ?? "",
      notes: supplier.notes ?? "",
      isActive: supplier.isActive,
    });
    setSupplierDialogOpen(true);
  };

  const updatePurchaseItem = (index: number, patch: Partial<PurchaseItemDraft>) => {
    setPurchaseForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.commercialProductId) {
          const product = productMap.get(patch.commercialProductId);
          if (product && (!next.unitCost || next.unitCost === "0")) {
            next.unitCost = String(product.costAmount || 0);
          }
        }
        return next;
      }),
    }));
  };

  const handlePurchasePaymentMethodChange = (value: string) => {
    setPurchaseForm((current) => ({
      ...current,
      paymentMethod: value,
      paidAmount: value === "none" ? "0" : current.paidAmount,
      reference: value === "none" ? "" : current.reference,
    }));
  };

  const handlePurchaseDiscountChange = (value: string) => {
    setPurchaseForm((current) => {
      const subtotal = Number(current.items.reduce((sum, item) => {
        const quantity = Number(item.quantityOrdered || 0);
        const unitCost = Number(item.unitCost || 0);
        return sum + (Number.isFinite(quantity * unitCost) ? quantity * unitCost : 0);
      }, 0).toFixed(2));
      const previousDiscount = Number(current.discountAmount || 0);
      const previousTotal = Math.max(Number((subtotal - (Number.isFinite(previousDiscount) ? previousDiscount : 0)).toFixed(2)), 0);
      const nextDiscount = Number(value || 0);
      const nextTotal = Math.max(Number((subtotal - (Number.isFinite(nextDiscount) ? nextDiscount : 0)).toFixed(2)), 0);
      const currentPaid = Number(current.paidAmount || 0);

      return {
        ...current,
        discountAmount: value,
        paidAmount: current.paymentMethod === "none"
          ? "0"
          : Math.abs(currentPaid - previousTotal) < 0.005
            ? nextTotal.toFixed(2)
            : current.paidAmount,
      };
    });
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? current.items
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  return (
    <div className="space-y-4" data-testid="tab-proveedores-compras">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Núcleo comercial</p>
            <h2 className="text-2xl font-semibold tracking-tight">Proveedores y compras</h2>
            <p className="text-sm text-muted-foreground">
              Registra proveedores, crea compras y recibe mercancía sin tocar Caja en esta fase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={section === "purchases" ? "default" : "outline"}
              onClick={() => setSection("purchases")}
              className="min-w-[150px]"
            >
              <Truck className="mr-2 h-4 w-4" />
              Compras
            </Button>
            <Button
              variant={section === "suppliers" ? "default" : "outline"}
              onClick={() => setSection("suppliers")}
              className="min-w-[150px]"
            >
              <Store className="mr-2 h-4 w-4" />
              Proveedores
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Proveedores activos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{suppliers.filter((supplier) => supplier.isActive).length}</span>
              <Badge variant="secondary">Se conserva el historial</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Compras registradas</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{purchasesQuery.data?.length ?? 0}</span>
              <Badge variant="outline">No afecta Caja</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Productos disponibles para compra</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="text-3xl font-semibold">{availableProducts.length}</span>
              <Badge variant="outline">Catalogo comercial</Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {section === "suppliers" ? (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Proveedores</CardTitle>
                <CardDescription>Directorio simple por sucursal para futuras compras y reposiciones.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={supplierSearch}
                    onChange={(event) => setSupplierSearch(event.target.value)}
                    placeholder="Buscar proveedor"
                    className="pl-9"
                  />
                </div>
                <Button onClick={openCreateSupplier}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo proveedor
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {suppliersQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              ) : visibleSuppliers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                  <p className="text-sm font-medium">Aún no hay proveedores registrados</p>
                  <p className="mt-1 text-sm text-muted-foreground">Crea tu primer proveedor para empezar a registrar compras.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {visibleSuppliers.map((supplier) => (
                      <Card key={supplier.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{supplier.name}</p>
                              <p className="truncate text-sm text-muted-foreground">{supplier.contactName || "Sin contacto principal"}</p>
                            </div>
                            <Badge variant={supplier.isActive ? "default" : "secondary"}>
                              {supplier.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <p className="truncate">{supplier.phone || "Sin teléfono"}</p>
                            <p className="truncate">{supplier.email || "Sin correo"}</p>
                            <p className="truncate">{supplier.paymentTerms || "Sin condiciones de pago"}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <Button variant="outline" onClick={() => setSupplierSummaryId(supplier.id)}>
                              Resumen
                            </Button>
                            <Button variant="outline" onClick={() => openEditSupplier(supplier)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                            <Button variant="outline" className="text-destructive" onClick={() => setSupplierToDelete(supplier)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Contacto</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Correo</TableHead>
                          <TableHead>Condiciones</TableHead>
                          <TableHead>Estatus</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleSuppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium">{supplier.name}</TableCell>
                            <TableCell>{supplier.contactName || "—"}</TableCell>
                            <TableCell>{supplier.phone || "—"}</TableCell>
                            <TableCell>{supplier.email || "—"}</TableCell>
                            <TableCell>{supplier.paymentTerms || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={supplier.isActive ? "default" : "secondary"}>
                                {supplier.isActive ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => setSupplierSummaryId(supplier.id)}>Resumen</Button>
                                <Button size="sm" variant="outline" onClick={() => openEditSupplier(supplier)}>Editar</Button>
                                <Button size="sm" variant="outline" className="text-destructive" onClick={() => setSupplierToDelete(supplier)}>Eliminar</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Compras de mercancía</CardTitle>
                  <CardDescription>
                    Crea borradores o compras pedidas. El stock solo aumenta cuando recibes la mercancía.
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setPurchaseForm(createInitialPurchaseFormState());
                  setPurchaseDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva compra
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Estatus</Label>
                  <Select value={purchaseFilters.status} onValueChange={(value) => setPurchaseFilters((current) => ({ ...current, status: value }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {PURCHASE_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={purchaseFilters.supplierId} onValueChange={(value) => setPurchaseFilters((current) => ({ ...current, supplierId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input type="date" value={purchaseFilters.from} onChange={(event) => setPurchaseFilters((current) => ({ ...current, from: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input type="date" value={purchaseFilters.to} onChange={(event) => setPurchaseFilters((current) => ({ ...current, to: event.target.value }))} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {purchasesQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full rounded-2xl" />
                  <Skeleton className="h-28 w-full rounded-2xl" />
                </div>
              ) : (purchasesQuery.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                  <p className="text-sm font-medium">Aún no hay compras registradas</p>
                  <p className="mt-1 text-sm text-muted-foreground">Registra la llegada de mercancía desde proveedores sin afectar Caja en esta fase.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {(purchasesQuery.data ?? []).map((purchase) => (
                      <Card key={purchase.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium">{purchase.folio}</p>
                              <p className="truncate text-sm text-muted-foreground">{purchase.supplierName || "Sin proveedor"}</p>
                              {purchase.projectName ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  Proyecto {purchase.projectCode ? `${purchase.projectCode} - ` : ""}{purchase.projectName}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant={getStatusBadgeVariant(purchase.status)}>{getStatusLabel(purchase.status)}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-muted-foreground">Fecha</p>
                              <p>{formatShortDate(purchase.purchaseDate)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total</p>
                              <p>{formatCurrencyMx(purchase.totalAmount)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Productos</p>
                              <p>{purchase.totalItems}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Recibido</p>
                              <p>{purchase.totalUnitsReceived}/{purchase.totalUnitsOrdered}</p>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Button variant="outline" onClick={() => setPurchaseDetailId(purchase.id)}>
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Ver detalle
                            </Button>
                            {purchase.status !== "received" && purchase.status !== "cancelled" ? (
                              <Button onClick={() => setPurchaseToReceive(purchase)}>
                                <PackageCheck className="mr-2 h-4 w-4" />
                                Recibir mercancía
                              </Button>
                            ) : null}
                            {purchase.status === "draft" ? (
                              <Button variant="outline" className="text-destructive" onClick={() => setPurchaseToCancel(purchase)}>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Cancelar borrador
                              </Button>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-2xl border border-border/70 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folio</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Estatus</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Recibido</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(purchasesQuery.data ?? []).map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <p>{purchase.folio}</p>
                                {purchase.projectName ? (
                                  <p className="text-xs font-normal text-muted-foreground">
                                    Proyecto {purchase.projectCode ? `${purchase.projectCode} - ` : ""}{purchase.projectName}
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>{purchase.supplierName || "Sin proveedor"}</TableCell>
                            <TableCell>{formatShortDate(purchase.purchaseDate)}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(purchase.status)}>{getStatusLabel(purchase.status)}</Badge>
                            </TableCell>
                            <TableCell>{purchase.paymentStatus}</TableCell>
                            <TableCell>{purchase.totalItems}</TableCell>
                            <TableCell>{formatCurrencyMx(purchase.totalAmount)}</TableCell>
                            <TableCell>{purchase.totalUnitsReceived}/{purchase.totalUnitsOrdered}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => setPurchaseDetailId(purchase.id)}>Detalle</Button>
                                {purchase.status !== "received" && purchase.status !== "cancelled" ? (
                                  <Button size="sm" onClick={() => setPurchaseToReceive(purchase)}>Recibir</Button>
                                ) : null}
                                {purchase.status === "draft" ? (
                                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setPurchaseToCancel(purchase)}>Cancelar</Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={supplierDialogOpen} onOpenChange={(open) => {
        setSupplierDialogOpen(open);
        if (!open) {
          setEditingSupplier(null);
          setSupplierForm(createInitialSupplierFormState());
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSupplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
            <DialogDescription>Directorio interno por sucursal. No afecta Caja ni inventario automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input value={supplierForm.contactName} onChange={(event) => setSupplierForm((current) => ({ ...current, contactName: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Correo</Label>
                <Input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>RFC / Tax ID</Label>
                <Input value={supplierForm.taxId} onChange={(event) => setSupplierForm((current) => ({ ...current, taxId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Condiciones de pago</Label>
                <Input value={supplierForm.paymentTerms} onChange={(event) => setSupplierForm((current) => ({ ...current, paymentTerms: event.target.value }))} placeholder="Ej. 15 días" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-muted-foreground">
              El pago queda registrado dentro de la compra. En esta fase no genera un gasto autom?tico en Caja.
            </div>

            {purchaseValidation.errors.length > 0 ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    {purchaseValidation.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Proveedor activo</p>
                <p className="text-xs text-muted-foreground">Puedes inactivarlo sin borrar historial.</p>
              </div>
              <Switch checked={supplierForm.isActive} onCheckedChange={(checked) => setSupplierForm((current) => ({ ...current, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createOrUpdateSupplierMutation.mutate(supplierForm)}
              disabled={!supplierForm.name.trim() || createOrUpdateSupplierMutation.isPending}
            >
              {createOrUpdateSupplierMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingSupplier ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!supplierSummaryId} onOpenChange={(open) => !open && setSupplierSummaryId(null)}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resumen del proveedor</DialogTitle>
            <DialogDescription>
              Vista comercial de compras recibidas y productos suministrados sin tocar Caja ni cuentas por pagar.
            </DialogDescription>
          </DialogHeader>

          {supplierSummaryQuery.isLoading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-52 w-full rounded-2xl" />
            </div>
          ) : !supplierSummaryQuery.data ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium">No pudimos cargar el resumen del proveedor</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Revisa si el proveedor sigue activo o intenta abrirlo de nuevo.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proveedor</p>
                    <p className="mt-2 text-lg font-semibold">{supplierSummaryQuery.data.supplierName}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total comprado</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(supplierSummaryQuery.data.totalPurchasedAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Ticket promedio</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrencyMx(supplierSummaryQuery.data.averageTicketAmount)}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compras registradas</p>
                    <p className="mt-2 text-lg font-semibold">{supplierSummaryQuery.data.purchasesCount}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recibidas / pendientes</p>
                    <p className="mt-2 text-lg font-semibold">
                      {supplierSummaryQuery.data.receivedPurchasesCount} / {supplierSummaryQuery.data.pendingPurchasesCount}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Productos surtidos</p>
                    <p className="mt-2 text-lg font-semibold">{supplierSummaryQuery.data.productsSuppliedCount}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Última compra {formatDateTime(supplierSummaryQuery.data.lastPurchaseAt)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="text-base">Productos más surtidos</CardTitle>
                  <CardDescription>
                    Top 5 por monto comprado con este proveedor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {supplierSummaryQuery.data.topProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 text-center">
                      <p className="text-sm font-medium">Sin productos vinculados todavía</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Cuando registres compras con renglones, aquí verás qué artículos te surte más.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {supplierSummaryQuery.data.topProducts.map((product) => (
                        <div
                          key={`${supplierSummaryQuery.data.supplierId}-${product.commercialProductId ?? product.name}`}
                          className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Ordenado {product.unitsOrdered} · Recibido {product.unitsReceived}
                            </p>
                          </div>
                          <div className="text-sm font-semibold text-foreground">
                            {formatCurrencyMx(product.totalPurchasedAmount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseDialogOpen} onOpenChange={(open) => {
        setPurchaseDialogOpen(open);
        if (!open) {
          setPurchaseForm(createInitialPurchaseFormState());
        }
      }}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nueva compra</DialogTitle>
            <DialogDescription>Guarda un borrador o una compra pedida. El inventario sube hasta recibir mercancía.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Select value={purchaseForm.supplierId} onValueChange={(value) => setPurchaseForm((current) => ({ ...current, supplierId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Sin proveedor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Proyecto relacionado</Label>
                <Select value={purchaseForm.projectId} onValueChange={(value) => setPurchaseForm((current) => ({ ...current, projectId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proyecto</SelectItem>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Opcional. Solo agrupa costos para rentabilidad; no crea otro gasto.</p>
              </div>
              <div className="space-y-2">
                <Label>Estatus inicial</Label>
                <Select value={purchaseForm.status} onValueChange={(value: "draft" | "ordered") => setPurchaseForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="ordered">Pedida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de compra</Label>
                <Input type="date" value={purchaseForm.purchaseDate} onChange={(event) => setPurchaseForm((current) => ({ ...current, purchaseDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Fecha esperada</Label>
                <Input type="date" value={purchaseForm.expectedDate} onChange={(event) => setPurchaseForm((current) => ({ ...current, expectedDate: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Renglones de compra</Label>
                  <p className="text-xs text-muted-foreground">Puedes mezclar productos con inventario y productos bajo pedido en la misma compra.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPurchaseForm((current) => ({ ...current, items: [...current.items, createInitialPurchaseItemDraft()] }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar producto
                </Button>
              </div>

              <div className="space-y-3">
                {purchaseForm.items.map((item, index) => {
                  const product = productMap.get(item.commercialProductId);
                  const lineTotal = Number(item.quantityOrdered || 0) * Number(item.unitCost || 0);
                  return (
                    <Card key={`purchase-item-${index}`} className="border-border/60">
                      <CardContent className="grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
                        <div className="space-y-2">
                          <Label>Producto</Label>
                          <Select value={item.commercialProductId || "none"} onValueChange={(value) => updatePurchaseItem(index, { commercialProductId: value === "none" ? "" : value })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecciona un producto</SelectItem>
                              {availableProducts.map((productOption) => (
                                <SelectItem key={productOption.id} value={productOption.id}>
                                  {productOption.name}{productOption.sku ? ` - ${productOption.sku}` : ""} - {getPurchaseProductModeLabel(productOption)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">{product?.category || "Sin categoria"} - {getPurchaseProductModeLabel(product)} - costo de referencia {formatCurrencyMx(product?.costAmount || 0)}</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Cantidad</Label>
                          <Input type="number" min="1" value={item.quantityOrdered} onChange={(event) => updatePurchaseItem(index, { quantityOrdered: event.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Costo unitario</Label>
                          <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updatePurchaseItem(index, { unitCost: event.target.value })} />
                          <p className="text-xs font-medium text-muted-foreground">Total: {formatCurrencyMx(lineTotal)}</p>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full text-destructive md:w-auto"
                            disabled={purchaseForm.items.length === 1}
                            onClick={() => removePurchaseItem(index)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Quitar
                          </Button>
                        </div>
                        <div className="md:col-span-4 rounded-xl border border-border/60 bg-muted/20 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Actualizar el costo de referencia del producto</p>
                              <p className="text-xs text-muted-foreground">
                                El costo de esta compra siempre quedar&aacute; guardado. Activa esta opci&oacute;n &uacute;nicamente para usarlo como costo predeterminado en compras y c&aacute;lculos futuros.
                              </p>
                            </div>
                            <Switch
                              checked={item.updateReferenceCost}
                              onCheckedChange={(value) => updatePurchaseItem(index, { updateReferenceCost: value })}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>Metodo de pago</Label>
                <Select value={purchaseForm.paymentMethod} onValueChange={handlePurchasePaymentMethodChange}>
                  <SelectTrigger><SelectValue placeholder="No registrar todavia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No registrar todavia</SelectItem>
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pago registrado</Label>
                <Input type="number" min="0" step="0.01" value={purchaseForm.paidAmount} onChange={(event) => setPurchaseForm((current) => ({ ...current, paidAmount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Descuento</Label>
                <Input type="number" min="0" step="0.01" value={purchaseForm.discountAmount} onChange={(event) => handlePurchaseDiscountChange(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Impuestos</Label>
                <Select value={purchaseForm.taxMode} onValueChange={(value: PurchaseFormState["taxMode"]) => setPurchaseForm((current) => ({ ...current, taxMode: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el tratamiento fiscal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tax_exempt">Sin IVA</SelectItem>
                    <SelectItem value="tax_included">Costo incluye IVA</SelectItem>
                    <SelectItem value="tax_added">Agregar IVA al costo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tasa de IVA (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={purchaseForm.taxRate}
                  onChange={(event) => setPurchaseForm((current) => ({ ...current, taxRate: event.target.value }))}
                  disabled={purchaseForm.taxMode === "tax_exempt"}
                />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-2">
                <Label>Referencia / factura</Label>
                <Input value={purchaseForm.reference} onChange={(event) => setPurchaseForm((current) => ({ ...current, reference: event.target.value }))} />
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-muted-foreground">
              El pago queda registrado dentro de la compra. En esta fase no genera un gasto autom&aacute;tico en Caja.
            </div>

            {purchaseValidation.errors.length > 0 ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    {purchaseValidation.errors.map((error) => (
                      <p key={error}>{error}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={purchaseForm.notes} onChange={(event) => setPurchaseForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
            </div>

            <Card className="border-border/60 bg-muted/20">
              <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-7">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subtotal</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.subtotalBeforeTax)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Descuento</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.discount)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Base gravable</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.taxableSubtotal)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    IVA {purchaseForm.taxMode === "tax_exempt" ? "" : `(${purchaseTotals.appliedTaxRate.toFixed(2).replace(/\.00$/, "")}%)`}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.taxTotal)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pago capturado</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(purchaseTotals.paid)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Saldo pendiente</p>
                  <p className="mt-1 text-lg font-semibold">{formatCurrencyMx(Math.max(purchaseTotals.balance, 0))}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createPurchaseMutation.mutate(purchaseForm)}
              disabled={
                createPurchaseMutation.isPending ||
                !purchaseForm.purchaseDate ||
                !purchaseValidation.isValid
              }
            >
              {createPurchaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!purchaseDetailId} onOpenChange={(open) => !open && setPurchaseDetailId(null)}>
        <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle de compra</DialogTitle>
            <DialogDescription>Recepción transaccional enlazada a movimientos de inventario.</DialogDescription>
          </DialogHeader>

          {purchaseDetailQuery.isLoading || !purchaseDetailQuery.data ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folio</p>
                    <p className="mt-2 text-lg font-semibold">{purchaseDetailQuery.data.folio}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proveedor</p>
                    <p className="mt-2 text-lg font-semibold">{purchaseDetailQuery.data.supplierName || "Sin proveedor"}</p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Proyecto</p>
                    <p className="mt-2 text-lg font-semibold">
                      {purchaseDetailQuery.data.projectName
                        ? `${purchaseDetailQuery.data.projectCode ? `${purchaseDetailQuery.data.projectCode} - ` : ""}${purchaseDetailQuery.data.projectName}`
                        : "Sin proyecto"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estatus</p>
                    <div className="mt-2">
                      <Badge variant={getStatusBadgeVariant(purchaseDetailQuery.data.status)}>{getStatusLabel(purchaseDetailQuery.data.status)}</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recibido</p>
                    <p className="mt-2 text-lg font-semibold">{purchaseDetailQuery.data.totalUnitsReceived}/{purchaseDetailQuery.data.totalUnitsOrdered}</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/60">
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha de compra</p>
                    <p className="font-medium">{formatShortDate(purchaseDetailQuery.data.purchaseDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha esperada</p>
                    <p className="font-medium">{formatShortDate(purchaseDetailQuery.data.expectedDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recibida el</p>
                    <p className="font-medium">{formatDateTime(purchaseDetailQuery.data.receivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pago</p>
                    <p className="font-medium">{purchaseDetailQuery.data.paymentStatus}{purchaseDetailQuery.data.paymentMethod ? ` · ${purchaseDetailQuery.data.paymentMethod}` : ""}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {purchaseDetailQuery.data.items.map((item) => (
                  <Card key={item.id} className="border-border/60">
                    <CardContent className="grid gap-3 p-4 md:grid-cols-5">
                      <div className="md:col-span-2">
                        <p className="font-medium">{item.nameSnapshot}</p>
                        <p className="text-sm text-muted-foreground">{item.skuSnapshot || "Sin SKU"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ordenado</p>
                        <p className="font-medium">{item.quantityOrdered}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recibido</p>
                        <p className="font-medium">{item.quantityReceived}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Costo</p>
                        <p className="font-medium">{formatCurrencyMx(item.unitCost)}</p>
                        <p className="text-xs text-muted-foreground">Línea {formatCurrencyMx(item.lineTotal)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-border/60 bg-muted/20">
                <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Subtotal</p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.subtotalBeforeTax ?? purchaseDetailQuery.data.subtotalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Descuento</p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.discountAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Base gravable</p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.taxableSubtotal ?? purchaseDetailQuery.data.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      IVA {purchaseDetailQuery.data.taxMode === "tax_exempt" ? "" : `(${(purchaseDetailQuery.data.taxRate ?? 0).toFixed(2).replace(/\.00$/, "")}%)`}
                    </p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.taxTotal ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.grandTotal ?? purchaseDetailQuery.data.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pago capturado</p>
                    <p className="mt-1 font-semibold">{formatCurrencyMx(purchaseDetailQuery.data.paidAmount)}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-2">
                {purchaseDetailQuery.data.status !== "received" && purchaseDetailQuery.data.status !== "cancelled" ? (
                  <Button onClick={() => setPurchaseToReceive(purchaseDetailQuery.data)}>
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Recibir mercancía
                  </Button>
                ) : null}
                {purchaseDetailQuery.data.status === "draft" ? (
                  <Button variant="outline" className="text-destructive" onClick={() => setPurchaseToCancel(purchaseDetailQuery.data)}>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Cancelar borrador
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              Se ocultará del módulo, pero el historial de compras seguirá existiendo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => supplierToDelete && deleteSupplierMutation.mutate(supplierToDelete.id)}>
              {deleteSupplierMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!purchaseToReceive} onOpenChange={(open) => !open && setPurchaseToReceive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recibir mercancía</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción aumentará el inventario y creará movimientos auditables por cada renglón de la compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => purchaseToReceive && receivePurchaseMutation.mutate(purchaseToReceive.id)}>
              {receivePurchaseMutation.isPending ? "Recibiendo..." : "Confirmar recepción"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!purchaseToCancel} onOpenChange={(open) => !open && setPurchaseToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar borrador</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se cancelan compras en borrador. No se tocará inventario ni Caja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => purchaseToCancel && cancelPurchaseMutation.mutate(purchaseToCancel.id)}>
              {cancelPurchaseMutation.isPending ? "Cancelando..." : "Cancelar compra"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
