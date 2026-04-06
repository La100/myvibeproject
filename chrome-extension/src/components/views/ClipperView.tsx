import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product, Project, ShoppingSet, Team } from "../../types";
import { CONFIG } from "../../config";
import { ACTIONS, isObjectMessage } from "../../lib/messages";
import { authenticatedFetch } from "../../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  ImagePlus,
  Loader2,
  Package,
  RefreshCw,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";

interface ClipperViewProps {
  team: Team;
  project: Project;
  onBack: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

interface DetectResponse {
  success: boolean;
  product?: Partial<Product>;
  error?: string;
}

interface PickerActivationResponse {
  success?: boolean;
  count?: number;
  error?: string;
}

const NO_SECTION_VALUE = "__none";
const NO_SET_VALUE = "__no_set";

function isSupportedUrl(url?: string): boolean {
  return Boolean(url && /^https?:\/\//.test(url));
}

function parseNumber(value?: string): number | null {
  if (!value) return null;

  const cleaned = value.replace(/\s+/g, "").replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (commaCount > 0) {
    if (commaCount > 1) {
      normalized = cleaned.replace(/,/g, "");
    } else {
      const [whole = "", fraction = ""] = cleaned.split(",");
      normalized =
        fraction.length === 3 && whole.length > 0
          ? `${whole}${fraction}`
          : cleaned.replace(",", ".");
    }
  } else if (dotCount > 1) {
    normalized = cleaned.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const ClipperView = ({
  team,
  project,
  onBack,
  showToast,
}: ClipperViewProps) => {
  const [sections, setSections] = useState(project.sections ?? []);
  const [shoppingSets, setShoppingSets] = useState<ShoppingSet[]>([]);
  const [selectedSection, setSelectedSection] = useState(NO_SECTION_VALUE);
  const [selectedSetId, setSelectedSetId] = useState(NO_SET_VALUE);
  const [product, setProduct] = useState<Partial<Product>>({ quantity: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isImagePickerActive, setIsImagePickerActive] = useState(false);
  const [isScreenshotPickerActive, setIsScreenshotPickerActive] =
    useState(false);

  const isIframeMode = useMemo(() => window.self !== window.top, []);

  const handleProductChange = (
    field: keyof Product,
    value: string | number,
  ) => {
    setProduct((prev) => ({ ...prev, [field]: value }));
  };

  const getActiveTab =
    useCallback(async (): Promise<chrome.tabs.Tab | null> => {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0] ?? null;
    }, []);

  const sendMessageToActiveTab = useCallback(
    async <T,>(payload: unknown, timeoutMs = 10000): Promise<T> => {
      const tab = await getActiveTab();
      if (!tab?.id) {
        throw new Error("Active tab unavailable");
      }

      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Tab communication timeout"));
        }, timeoutMs);

        chrome.tabs.sendMessage(tab.id as number, payload, (response: T) => {
          clearTimeout(timeout);

          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }

          resolve(response);
        });
      });
    },
    [getActiveTab],
  );

  const refreshSections = useCallback(async () => {
    try {
      const response = await authenticatedFetch(
        `${CONFIG.API_BASE}/clipper?teamId=${encodeURIComponent(team._id)}&projectId=${encodeURIComponent(project._id)}`,
        undefined,
        {
          retryOnAuthFailure: true,
        },
      );

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        sections?: Team["projects"][number]["sections"];
        sets?: ShoppingSet[];
      };

      setSections(Array.isArray(data.sections) ? data.sections : []);
      setShoppingSets(Array.isArray(data.sets) ? data.sets : []);
    } catch {
      // Non-blocking: keep currently available sections.
    }
  }, [project._id, team._id]);

  const detectProductFromPage = useCallback(async () => {
    setIsDetecting(true);

    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isSupportedUrl(tab.url)) {
        showToast("Product detection works only on http/https pages.", "info");
        return;
      }

      await sendMessageToActiveTab<{ status: "ready" }>({
        action: ACTIONS.PING,
      });

      const response = await sendMessageToActiveTab<DetectResponse>({
        action: ACTIONS.DETECT_PRODUCT,
      });

      if (!response.success || !response.product) {
        return;
      }

      setProduct((prev) => ({
        ...prev,
        name: response.product?.name ?? prev.name ?? "",
        price:
          response.product?.unitPrice ??
          response.product?.price ??
          prev.price ??
          "",
        productLink:
          response.product?.productLink ?? tab.url ?? prev.productLink ?? "",
        supplier:
          response.product?.supplier ??
          extractDomain(tab.url ?? "") ??
          prev.supplier ??
          "",
        catalogNumber:
          response.product?.catalogNumber ?? prev.catalogNumber ?? "",
        // Notes stay manual-only: never auto-fill from page detection.
        notes: prev.notes ?? "",
        imageUrl: response.product?.imageUrl ?? prev.imageUrl ?? "",
        quantity: prev.quantity ?? 1,
      }));
    } catch {
      // Non-blocking: user can fill fields manually.
    } finally {
      setIsDetecting(false);
    }
  }, [getActiveTab, sendMessageToActiveTab, showToast]);

  useEffect(() => {
    void refreshSections();
    void detectProductFromPage();
  }, [detectProductFromPage, refreshSections]);

  useEffect(() => {
    setSelectedSection((current) =>
      current === NO_SECTION_VALUE ||
      sections.some((section) => section._id === current)
        ? current
        : NO_SECTION_VALUE,
    );
  }, [sections]);

  useEffect(() => {
    setSelectedSetId((current) =>
      current === NO_SET_VALUE || shoppingSets.some((set) => set._id === current)
        ? current
        : NO_SET_VALUE,
    );
  }, [shoppingSets]);

  useEffect(() => {
    const runtimeMessageListener = (message: unknown) => {
      if (!isObjectMessage(message)) return;

      if (message.action === ACTIONS.IMAGE_SELECTED) {
        const incoming = message as { imageUrl?: string };
        if (
          typeof incoming.imageUrl === "string" &&
          incoming.imageUrl.length > 0
        ) {
          setProduct((prev) => ({ ...prev, imageUrl: incoming.imageUrl }));
          setIsImagePickerActive(false);
          setIsScreenshotPickerActive(false);
          showToast("Image updated.", "success");
        }
      }
    };

    chrome.runtime.onMessage.addListener(runtimeMessageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(runtimeMessageListener);
    };
  }, [showToast]);

  const handleOpenProductLink = () => {
    if (!product.productLink) {
      return;
    }

    void chrome.tabs.create({ url: product.productLink });
  };

  const handleImagePicker = async () => {
    if (isImagePickerActive || isScreenshotPickerActive) return;

    try {
      const response = await sendMessageToActiveTab<PickerActivationResponse>({
        action: ACTIONS.ENABLE_IMAGE_PICKER,
      });

      if (!response?.success) {
        setIsImagePickerActive(false);
        setIsScreenshotPickerActive(false);
        showToast("No selectable images found on this page.", "info");
        return;
      }

      setIsImagePickerActive(true);
      setIsScreenshotPickerActive(false);
      showToast("Click an image on the page to select it.", "info");
    } catch {
      setIsImagePickerActive(false);
      setIsScreenshotPickerActive(false);
      showToast("Could not start image picker on this page.", "error");
    }
  };

  const handleScreenshotPicker = async () => {
    if (isScreenshotPickerActive || isImagePickerActive) return;

    try {
      const response = await sendMessageToActiveTab<PickerActivationResponse>({
        action: ACTIONS.ENABLE_SCREENSHOT_PICKER,
      });

      if (!response?.success) {
        setIsScreenshotPickerActive(false);
        setIsImagePickerActive(false);
        showToast(response?.error ?? "Could not start area capture.", "error");
        return;
      }

      setIsScreenshotPickerActive(true);
      setIsImagePickerActive(false);
      showToast("Drag on the page to capture an area.", "info");
    } catch {
      setIsScreenshotPickerActive(false);
      setIsImagePickerActive(false);
      showToast("Could not start area capture on this page.", "error");
    }
  };

  const handleCloseIframe = async () => {
    try {
      await sendMessageToActiveTab(
        { action: ACTIONS.CLOSE_IFRAME_POPUP },
        3000,
      );
    } catch {
      // If message failed, user can still close manually.
    }
  };

  const handleSave = async () => {
    if (!product.name?.trim()) {
      showToast("Product name is required.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const quantity = Number(product.quantity ?? 1);
      const unitPriceNumber = parseNumber(product.price);
      const totalPrice =
        unitPriceNumber !== null ? unitPriceNumber * quantity : undefined;

      const body = {
        name: product.name.trim(),
        projectId: project._id,
        sectionId:
          selectedSection === NO_SECTION_VALUE ? undefined : selectedSection,
        setId: selectedSetId === NO_SET_VALUE ? undefined : selectedSetId,
        unitPrice: unitPriceNumber ?? undefined,
        quantity,
        totalPrice,
        supplier: product.supplier?.trim() || undefined,
        catalogNumber: product.catalogNumber?.trim() || undefined,
        notes: product.notes?.trim() || undefined,
        productLink: product.productLink?.trim() || undefined,
        imageUrl: product.imageUrl?.trim() || undefined,
        priority: "medium",
        realizationStatus: "PLANNED",
      };

      const response = await authenticatedFetch(
        `${CONFIG.API_BASE}/clipper`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        {
          retryOnAuthFailure: true,
        },
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Session expired. Please sign in again.");
        }

        const errorPayload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;

        throw new Error(errorPayload?.message ?? "Failed to save product");
      }

      showToast("Product added to shopping list.", "success");

      if (isIframeMode) {
        await handleCloseIframe();
      } else {
        window.close();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message === "AUTH_REQUIRED"
            ? "Session expired. Please sign in again."
            : error.message
          : "Unknown error";
      showToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="clean-panel mb-3 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="vp-title">Active project</p>
            <h1 className="mt-1 flex items-center gap-2 text-base font-semibold">
              <Package className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{project.name}</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">{team.name}</p>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 rounded-full border border-border/80 bg-background/80 p-0 text-foreground shadow-sm hover:bg-accent/60"
              onClick={onBack}
              title="Back"
            >
              <ArrowLeft className="h-5 w-5 stroke-[2.4]" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={detectProductFromPage}
              disabled={isDetecting}
              title="Refresh data"
            >
              {isDetecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            {isIframeMode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleCloseIframe}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="vp-scrollbar flex-1 pr-1">
        <div className="space-y-3 pb-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Product image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {product.imageUrl ? (
                <div className="h-40 overflow-hidden rounded-xl border border-border/85 bg-background/80">
                  <img
                    src={product.imageUrl}
                    alt={product.name ?? "Product"}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-input/90 bg-background/65 text-xs text-muted-foreground">
                  No image selected
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={handleImagePicker}
                  disabled={isImagePickerActive || isScreenshotPickerActive}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  {isImagePickerActive
                    ? "Image picker active"
                    : "Pick existing"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleScreenshotPicker}
                  disabled={isScreenshotPickerActive || isImagePickerActive}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {isScreenshotPickerActive
                    ? "Area picker active"
                    : "Capture area"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Product details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-name">Product name *</Label>
                <Input
                  id="product-name"
                  value={product.name ?? ""}
                  onChange={(event) =>
                    handleProductChange("name", event.target.value)
                  }
                  placeholder="e.g. Ceramic tiles"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="product-price">Price</Label>
                  <Input
                    id="product-price"
                    value={product.price ?? ""}
                    onChange={(event) =>
                      handleProductChange("price", event.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="product-quantity">Quantity</Label>
                  <Input
                    id="product-quantity"
                    type="number"
                    min="1"
                    value={product.quantity ?? 1}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10);
                      handleProductChange(
                        "quantity",
                        Number.isFinite(next) && next > 0 ? next : 1,
                      );
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Shopping list section</Label>
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Uncategorized (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SECTION_VALUE}>
                      Uncategorized (default)
                    </SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section._id} value={section._id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Set</Label>
                <Select value={selectedSetId} onValueChange={setSelectedSetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No set (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SET_VALUE}>
                      No set (default)
                    </SelectItem>
                    {shoppingSets.map((set) => (
                      <SelectItem key={set._id} value={set._id}>
                        {set.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Additional information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="product-link">Product link</Label>
                <div className="flex">
                  <Input
                    id="product-link"
                    value={product.productLink ?? ""}
                    onChange={(event) =>
                      handleProductChange("productLink", event.target.value)
                    }
                    placeholder="https://..."
                    className="rounded-r-none"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none border-l-0 px-3"
                    onClick={handleOpenProductLink}
                    disabled={!product.productLink}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-supplier">Supplier</Label>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="product-supplier"
                    value={product.supplier ?? ""}
                    onChange={(event) =>
                      handleProductChange("supplier", event.target.value)
                    }
                    placeholder="Supplier name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-catalog-number">Catalog number</Label>
                <Input
                  id="product-catalog-number"
                  value={product.catalogNumber ?? ""}
                  onChange={(event) =>
                    handleProductChange("catalogNumber", event.target.value)
                  }
                  placeholder="e.g. BU1K367PH-3BC1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="product-notes">Notes</Label>
                <Textarea
                  id="product-notes"
                  rows={3}
                  value={product.notes ?? ""}
                  onChange={(event) =>
                    handleProductChange("notes", event.target.value)
                  }
                  placeholder="Additional details"
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <div className="clean-panel mt-3 p-2">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={isLoading || !product.name?.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to shopping list
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export default ClipperView;
