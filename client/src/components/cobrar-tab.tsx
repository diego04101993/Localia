import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  Loader2,
  Minus,
  Package2,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { branchFinancePaymentMethodValues } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateBranchClientQueries, invalidateBranchCommercialQueries, invalidateBranchFinanceQueries } from "@/lib/branch-dashboard-cache";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type PaymentMethod = typeof branchFinancePaymentMethodValues[number];
type BranchSaleTaxMode = "tax_included" | "tax_added" | "tax_exempt";

type CommercialProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  photoUrl: string | null;
  sku: string | null;
  salePriceAmount: number;
  costAmount: number;
  isActive: boolean;
  usesInventory: boolean;
  inventoryQuantityOnHand?: number | null;
  inventoryStatus?: "not_tracked" | "uninitialized" | "available" | "low_stock" | "out_of_stock" | null;
};

type BranchClientOption = {
  userId: string;
  name: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
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

type CheckoutPaymentForm = {
  paymentMethod: PaymentMethod;
  amount: string;
  reference: string;
};

type CheckoutResponse = {
  id: string;
  folio: string;
  totalAmount: number;
  paidAmount: number;
  items: Array<{
    id: string;
    commercialProductId: string | null;
    nameSnapshot: string;
    quantity: number;
    lineTotalAmount: number;
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    reference: string | null;
  }>;
};

const COMMERCIAL_PRODUCTS_QUERY_KEY = ["/api/branch/commercial-products"];
const BRANCH_CLIENTS_QUERY_KEY = ["/api/branch/clients"];
const BRANCH_SALESPEOPLE_QUERY_KEY = ["/api/branch/salespeople?status=active"];
const COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY = ["/api/branch/commercial-projects/options"];
const WALK_IN_CLIENT_VALUE = "walk-in";
const NO_SALESPERSON_VALUE = "none";
const NO_PROJECT_VALUE = "none";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function computeTaxPreview(params: {
  subtotalAmount: number;
  discountAmount: number;
  taxMode: BranchSaleTaxMode;
  taxRate: number;
}) {
  const subtotalAmount = roundMoney(Math.max(0, params.subtotalAmount || 0));
  const discountAmount = roundMoney(Math.max(0, params.discountAmount || 0));
  const discountedSubtotal = roundMoney(Math.max(0, subtotalAmount - discountAmount));
  const taxRate = params.taxMode === "tax_exempt" ? 0 : roundMoney(Math.max(0, params.taxRate || 0));
  const taxFactor = taxRate > 0 ? taxRate / 100 : 0;

  if (params.taxMode === "tax_included" && taxFactor > 0) {
    const subtotalBeforeTax = roundMoney(subtotalAmount / (1 + taxFactor));
    const taxableSubtotal = roundMoney(discountedSubtotal / (1 + taxFactor));
    const taxTotal = roundMoney(discountedSubtotal - taxableSubtotal);
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
    const taxTotal = roundMoney(taxableSubtotal * taxFactor);
    return {
      subtotalBeforeTax,
      taxableSubtotal,
      taxTotal,
      grandTotal: roundMoney(taxableSubtotal + taxTotal),
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function createPaymentFormState(): CheckoutPaymentForm {
  return {
    paymentMethod: "efectivo",
    amount: "",
    reference: "",
  };
}

export default function CobrarTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [clientUserId, setClientUserId] = useState(WALK_IN_CLIENT_VALUE);
  const [sellerId, setSellerId] = useState(NO_SALESPERSON_VALUE);
  const [projectId, setProjectId] = useState(NO_PROJECT_VALUE);
  const [taxMode, setTaxMode] = useState<BranchSaleTaxMode>("tax_exempt");
  const [taxRate, setTaxRate] = useState("16");
  const [payments, setPayments] = useState<CheckoutPaymentForm[]>([createPaymentFormState()]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [lastSale, setLastSale] = useState<CheckoutResponse | null>(null);

  const { data: products = [], isLoading: productsLoading } = useQuery<CommercialProduct[]>({
    queryKey: COMMERCIAL_PRODUCTS_QUERY_KEY,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<BranchClientOption[]>({
    queryKey: BRANCH_CLIENTS_QUERY_KEY,
  });

  const { data: salespeople = [], isLoading: salespeopleLoading } = useQuery<BranchSalespersonOption[]>({
    queryKey: BRANCH_SALESPEOPLE_QUERY_KEY,
  });

  const { data: commercialProjectOptions = [] } = useQuery<CommercialProjectOption[]>({
    queryKey: COMMERCIAL_PROJECT_OPTIONS_QUERY_KEY,
  });

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const needle = normalizeSearchText(search);
    if (!needle) {
      return activeProducts;
    }

    return activeProducts.filter((product) =>
      normalizeSearchText([
        product.name,
        product.category,
        product.description || "",
        product.sku || "",
      ].join(" ")).includes(needle),
    );
  }, [activeProducts, search]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((item) => item.id === productId);
        if (!product || quantity <= 0) return null;
        return { product, quantity };
      })
      .filter(Boolean) as Array<{ product: CommercialProduct; quantity: number }>;
  }, [cart, products]);

  const subtotalAmount = useMemo(
    () => roundMoney(cartItems.reduce((sum, item) => sum + (item.product.salePriceAmount * item.quantity), 0)),
    [cartItems],
  );

  const normalizedDiscount = Math.max(0, Number.parseFloat(discountAmount) || 0);
  const normalizedTaxRate = Math.max(0, Number.parseFloat(taxRate) || 0);
  const taxPreview = useMemo(
    () => computeTaxPreview({
      subtotalAmount,
      discountAmount: normalizedDiscount,
      taxMode,
      taxRate: normalizedTaxRate,
    }),
    [subtotalAmount, normalizedDiscount, taxMode, normalizedTaxRate],
  );
  const totalAmount = taxPreview.grandTotal;
  const paymentTotal = roundMoney(
    payments.reduce((sum, payment) => sum + (Number.parseFloat(payment.amount) || 0), 0),
  );

  const selectedClient = useMemo(() => {
    if (clientUserId === WALK_IN_CLIENT_VALUE) return null;
    return clients.find((client) => client.userId === clientUserId) ?? null;
  }, [clientUserId, clients]);

  const selectedSalesperson = useMemo(() => {
    if (sellerId === NO_SALESPERSON_VALUE) return null;
    return salespeople.find((salesperson) => salesperson.id === sellerId) ?? null;
  }, [sellerId, salespeople]);

  useEffect(() => {
    if (payments.length === 1) {
      setPayments((current) => current.map((payment, index) => (
        index === 0
          ? { ...payment, amount: totalAmount > 0 ? totalAmount.toFixed(2) : "" }
          : payment
      )));
    }
  }, [totalAmount, payments.length]);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cartItems.length) {
        throw new Error("Agrega al menos un producto al carrito");
      }
      if (normalizedDiscount > subtotalAmount) {
        throw new Error("El descuento no puede ser mayor al subtotal");
      }

      const normalizedPayments = payments.map((payment) => ({
        paymentMethod: payment.paymentMethod,
        amount: roundMoney(Number.parseFloat(payment.amount) || 0),
        reference: payment.reference.trim() || null,
      }));

      if (normalizedPayments.some((payment) => payment.amount <= 0)) {
        throw new Error("Todos los pagos deben tener un monto mayor a 0");
      }
      if (Math.abs(paymentTotal - totalAmount) > 0.009) {
        throw new Error("La suma de pagos debe ser igual al total");
      }

      const response = await apiRequest("POST", "/api/branch/sales/checkout", {
        items: cartItems.map((item) => ({
          commercialProductId: item.product.id,
          quantity: item.quantity,
        })),
        clientUserId: clientUserId === WALK_IN_CLIENT_VALUE ? null : clientUserId,
        sellerId: sellerId === NO_SALESPERSON_VALUE ? null : sellerId,
        projectId: projectId === NO_PROJECT_VALUE ? null : projectId,
        discountAmount: normalizedDiscount,
        taxMode,
        taxRate: normalizedTaxRate,
        notes: notes.trim() || null,
        payments: normalizedPayments,
        idempotencyKey,
      });

      return response.json() as Promise<CheckoutResponse>;
    },
    onSuccess: async (sale) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: COMMERCIAL_PRODUCTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["/api/branch/dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/branch/stats"] }),
        invalidateBranchClientQueries(selectedClient?.userId ?? null),
        invalidateBranchFinanceQueries(),
        invalidateBranchCommercialQueries({
          clientId: selectedClient?.userId ?? null,
          projectId: projectId === NO_PROJECT_VALUE ? null : projectId,
          saleId: sale.id,
          salespersonId: selectedSalesperson?.id ?? null,
        }),
      ]);
      setLastSale(sale);
      setCart({});
      setDiscountAmount("0");
      setNotes("");
      setClientUserId(WALK_IN_CLIENT_VALUE);
      setSellerId(NO_SALESPERSON_VALUE);
      setProjectId(NO_PROJECT_VALUE);
      setTaxMode("tax_exempt");
      setTaxRate("16");
      setPayments([createPaymentFormState()]);
      setIdempotencyKey(crypto.randomUUID());
      toast({
        title: "Venta completada",
        description: `${sale.folio} · ${formatCurrency(sale.totalAmount)}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "No se pudo completar la venta"),
        variant: "destructive",
      });
    },
  });

  function addToCart(product: CommercialProduct) {
    setCart((current) => ({
      ...current,
      [product.id]: (current[product.id] ?? 0) + 1,
    }));
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    setCart((current) => {
      if (nextQuantity <= 0) {
        const updated = { ...current };
        delete updated[productId];
        return updated;
      }

      return {
        ...current,
        [productId]: nextQuantity,
      };
    });
  }

  function updatePayment(index: number, patch: Partial<CheckoutPaymentForm>) {
    setPayments((current) => current.map((payment, currentIndex) => (
      currentIndex === index ? { ...payment, ...patch } : payment
    )));
  }

  function addPaymentRow() {
    setPayments((current) => [...current, createPaymentFormState()]);
  }

  function removePaymentRow(index: number) {
    setPayments((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index));
  }

  function clearCheckout() {
    setCart({});
    setDiscountAmount("0");
    setNotes("");
    setClientUserId(WALK_IN_CLIENT_VALUE);
    setSellerId(NO_SALESPERSON_VALUE);
    setProjectId(NO_PROJECT_VALUE);
    setTaxMode("tax_exempt");
    setTaxRate("16");
    setPayments([createPaymentFormState()]);
    setIdempotencyKey(crypto.randomUUID());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cobrar</h3>
          <p className="text-sm text-muted-foreground">
            Vende productos comerciales con carrito, pagos mixtos y registro automático en Caja.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          Productos · cliente opcional · vendedor opcional
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] xl:items-start">
        <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package2 className="h-4 w-4 text-primary" />
              Productos disponibles
            </CardTitle>
            <CardDescription>Busca y agrega productos al carrito.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, categoría o SKU"
                className="pl-9"
              />
            </div>

            {productsLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index}>
                    <CardContent className="space-y-3 p-4">
                      <Skeleton className="h-28 w-full rounded-xl" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No encontramos productos con ese criterio.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredProducts.map((product) => {
                  const quantityInCart = cart[product.id] ?? 0;
                  const inventoryBlocked = product.usesInventory && (
                    product.inventoryStatus === "uninitialized" || product.inventoryStatus === "out_of_stock"
                  );

                  return (
                    <div
                      key={product.id}
                      className="flex min-h-[180px] flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                    >
                      {product.photoUrl ? (
                        <img
                          src={product.photoUrl}
                          alt={product.name}
                          className="mb-3 h-28 w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
                          <Package2 className="h-8 w-8" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.category}</p>
                          </div>
                          <Badge variant="outline">{formatCurrency(product.salePriceAmount)}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {product.sku ? <Badge variant="secondary">SKU {product.sku}</Badge> : null}
                          {product.usesInventory ? (
                            <Badge variant={inventoryBlocked ? "destructive" : "outline"}>
                              {product.inventoryStatus === "uninitialized"
                                ? "Inventario pendiente"
                                : `Stock ${product.inventoryQuantityOnHand ?? 0}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Sin control de existencias</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        {quantityInCart > 0 ? (
                          <div className="flex flex-1 items-center justify-between rounded-xl border border-border/70 px-2 py-2">
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(product.id, quantityInCart - 1)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium">{quantityInCart}</span>
                            <Button variant="ghost" size="icon" onClick={() => updateQuantity(product.id, quantityInCart + 1)} disabled={inventoryBlocked}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button className="w-full" onClick={() => addToCart(product)} disabled={inventoryBlocked}>
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 xl:sticky xl:top-24">
          <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Carrito y cobro
              </CardTitle>
              <CardDescription>Confirma productos, cliente, vendedor y pagos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  Agrega productos para comenzar a cobrar.
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(({ product, quantity }) => (
                    <div key={product.id} className="rounded-2xl border border-border/70 bg-card px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(product.salePriceAmount)} c/u</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => updateQuantity(product.id, 0)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl border border-border/70">
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(product.id, quantity - 1)}>
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="min-w-[2rem] text-center text-sm font-medium">{quantity}</span>
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(product.id, quantity + 1)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(product.salePriceAmount * quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={clientUserId} onValueChange={setClientUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder={clientsLoading ? "Cargando clientes..." : "Selecciona cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WALK_IN_CLIENT_VALUE}>Venta de mostrador</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.userId} value={client.userId}>
                          {[client.name, client.lastName].filter(Boolean).join(" ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedClient
                      ? `${selectedClient.email || "Sin correo"} · ${selectedClient.phone || "Sin teléfono"}`
                      : "Cliente opcional para productos comerciales."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select value={sellerId} onValueChange={setSellerId}>
                    <SelectTrigger>
                      <SelectValue placeholder={salespeopleLoading ? "Cargando vendedores..." : "Selecciona vendedor"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SALESPERSON_VALUE}>Sin vendedor</SelectItem>
                      {salespeople
                        .filter((salesperson) => salesperson.isActive)
                        .map((salesperson) => (
                          <SelectItem key={salesperson.id} value={salesperson.id}>
                            {[salesperson.name, salesperson.lastName].filter(Boolean).join(" ")}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedSalesperson
                      ? `${selectedSalesperson.employeeCode || "Sin código"} · ${selectedSalesperson.roleLabel || "Vendedor activo"}`
                      : "Asocia la venta a un vendedor solo cuando aplique."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Proyecto relacionado</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
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
                  <p className="text-xs text-muted-foreground">Opcional. Agrupa la venta para rentabilidad sin duplicar el ingreso.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descuento</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4 md:grid-cols-[minmax(0,1.3fr)_180px]">
                <div className="space-y-2">
                  <Label>Impuestos</Label>
                  <Select value={taxMode} onValueChange={(value) => setTaxMode(value as BranchSaleTaxMode)}>
                    <SelectTrigger data-testid="select-branch-checkout-tax-mode">
                      <SelectValue placeholder="Selecciona el tratamiento fiscal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_exempt">Sin IVA</SelectItem>
                      <SelectItem value="tax_included">Precio incluye IVA</SelectItem>
                      <SelectItem value="tax_added">Agregar IVA al precio</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El subtotal del carrito se interpreta segun este modo y el servidor guarda el snapshot fiscal en la venta.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Tasa de IVA (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                    disabled={taxMode === "tax_exempt"}
                    data-testid="input-branch-checkout-tax-rate"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Pagos</Label>
                  <Button variant="outline" size="sm" onClick={addPaymentRow}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar pago
                  </Button>
                </div>

                {payments.map((payment, index) => (
                  <div key={`payment-${index}`} className="rounded-2xl border border-border/70 bg-card p-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto] xl:grid-cols-1">
                      <div className="space-y-2">
                        <Label>Método</Label>
                        <Select value={payment.paymentMethod} onValueChange={(value) => updatePayment(index, { paymentMethod: value as PaymentMethod })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {branchFinancePaymentMethodValues.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Monto</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={payment.amount}
                          onChange={(event) => updatePayment(index, { amount: event.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-rose-600"
                          onClick={() => removePaymentRow(index)}
                          disabled={payments.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>Referencia</Label>
                      <Input
                        value={payment.reference}
                        onChange={(event) => updatePayment(index, { reference: event.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observaciones internas de esta venta"
                />
              </div>

              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(taxPreview.subtotalBeforeTax)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Descuento</span>
                    <span>-{formatCurrency(normalizedDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Base gravable</span>
                    <span>{formatCurrency(taxPreview.taxableSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      IVA {taxMode === "tax_exempt" ? "" : `(${taxPreview.appliedTaxRate.toFixed(2).replace(/\.00$/, "")}%)`}
                    </span>
                    <span>{formatCurrency(taxPreview.taxTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pagado</span>
                    <span>{formatCurrency(paymentTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-primary/10 pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={clearCheckout}>
                  Limpiar
                </Button>
                <Button onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending || cartItems.length === 0}>
                  {checkoutMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                  Confirmar cobro
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-primary" />
                Resultado
              </CardTitle>
              <CardDescription>Resumen de la última venta registrada desde Cobrar.</CardDescription>
            </CardHeader>
            <CardContent>
              {lastSale ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Folio</span>
                    <Badge>{lastSale.folio}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{formatCurrency(lastSale.totalAmount)}</span>
                  </div>
                  <div className="space-y-2">
                    {lastSale.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{item.quantity} x {item.nameSnapshot}</span>
                        <span>{formatCurrency(item.lineTotalAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center text-sm text-muted-foreground">
                  Cuando completes una venta, aquí verás el folio y el resumen final.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/95 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/85">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Mostrador</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Vende sin cliente cuando aplique.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Cliente opcional</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Asocia la compra al historial si ya existe.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Pagos mixtos</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Cada pago genera un ingreso separado en Caja.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
